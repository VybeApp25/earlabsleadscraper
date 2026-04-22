import asyncio
import os
import json
import logging
import hmac
import hashlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import AsyncGenerator

import httpx
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, RedirectResponse
from urllib.parse import urlencode
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, desc

from database import get_db, init_db, SessionLocal
from models import (
    Business, Analysis, SearchJob, OwnerContact, LeadNote,
    SearchHistory, EmailSequence, EmailSequenceStep,
    EmailSequenceEnrollment, WebhookConfig, User, OTPCode, AppSetting
)
from auth import generate_otp, create_token, get_current_user, OTP_EXPIRE_MINUTES
from pipeline import run_search_pipeline, analyze_single_business, _broadcast_queue, _biz_to_dict, _analysis_to_dict
from scheduler import start_scheduler, stop_scheduler, add_search_job, remove_search_job
from integrations.ghl import push_contact
from integrations.gmail import send_email as send_via_gmail
from integrations.instantly import send_email_via_instantly, list_campaigns
from owner_finder import find_owner_contact

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "gmail")  # gmail | instantly
from export import generate_csv, generate_excel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory settings cache (DB overrides env vars at runtime)
_settings_cache: dict[str, str] = {}


async def get_setting(key: str, default: str = "") -> str:
    if key in _settings_cache:
        return _settings_cache[key]
    return os.getenv(key, default)


async def load_settings_cache(db: AsyncSession):
    result = await db.execute(select(AppSetting))
    for row in result.scalars().all():
        _settings_cache[row.key] = row.value


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with SessionLocal() as db:
        await load_settings_cache(db)
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="EAR Labs Scraper API — Powered by WeOps", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth ────────────────────────────────────────────────────────────────────

ALLOW_REGISTRATION = os.getenv("ALLOW_REGISTRATION", "true").lower() == "true"


class OTPRequest(BaseModel):
    email: str


class OTPVerify(BaseModel):
    email: str
    code: str


@app.post("/auth/send-otp")
async def send_otp(req: OTPRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()

    # Check registration gate
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()

    if not user and not ALLOW_REGISTRATION:
        raise HTTPException(403, "Registration is closed. Contact your admin.")

    # Create user if first time
    if not user:
        user = User(email=email, name=email.split("@")[0].replace(".", " ").title())
        db.add(user)
        await db.flush()

    # Invalidate old codes
    await db.execute(
        update(OTPCode).where(OTPCode.email == email, OTPCode.used == False).values(used=True)
    )

    # Generate new OTP
    code = generate_otp()
    expires = datetime.now() + timedelta(minutes=OTP_EXPIRE_MINUTES)
    otp = OTPCode(email=email, code=code, expires_at=expires)
    db.add(otp)
    await db.commit()

    # Send via configured email provider
    subject = "Your EAR Labs Scraper Login Code"
    body = f"""Your EAR Labs Scraper verification code is:

{code}

This code expires in {OTP_EXPIRE_MINUTES} minutes.

— EAR Labs by WeOps"""

    if EMAIL_PROVIDER == "instantly":
        await send_email_via_instantly(email, subject, body)
    else:
        await send_via_gmail(email, subject, body)

    logger.info(f"OTP sent to {email} (code: {code})")  # Remove in prod
    return {"ok": True, "message": f"Code sent to {email}"}


@app.post("/auth/verify-otp")
async def verify_otp(req: OTPVerify, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()

    # Find valid OTP
    otp_result = await db.execute(
        select(OTPCode).where(
            OTPCode.email == email,
            OTPCode.code == req.code,
            OTPCode.used == False,
            OTPCode.expires_at > datetime.now(),
        )
    )
    otp = otp_result.scalar_one_or_none()
    if not otp:
        raise HTTPException(401, "Invalid or expired code")

    # Mark used
    otp.used = True

    # Update user last login
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.last_login = datetime.now()
    await db.commit()

    token = create_token(str(user.id), user.email)
    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    }


@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/auth/logout")
async def logout():
    return {"ok": True}


@app.get("/auth/google")
async def google_login():
    client_id = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GMAIL_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@app.get("/auth/google/callback")
async def google_callback(code: str = None, error: str = None, db: AsyncSession = Depends(get_db)):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    if error or not code:
        return RedirectResponse(f"{frontend_url}/login?error=google_cancelled")

    client_id = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GMAIL_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET") or os.getenv("GMAIL_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse(f"{frontend_url}/login?error=google_token_failed")

        access_token = token_res.json().get("access_token")
        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            return RedirectResponse(f"{frontend_url}/login?error=google_userinfo_failed")
        user_info = userinfo_res.json()

    email = user_info.get("email", "").lower()
    if not email:
        return RedirectResponse(f"{frontend_url}/login?error=google_no_email")

    name = user_info.get("name") or email.split("@")[0].replace(".", " ").title()

    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()

    if not user:
        if not ALLOW_REGISTRATION:
            return RedirectResponse(f"{frontend_url}/login?error=registration_closed")
        user = User(email=email, name=name)
        db.add(user)
        await db.flush()

    user.last_login = datetime.now()
    await db.commit()

    token = create_token(str(user.id), user.email)
    return RedirectResponse(f"{frontend_url}/login?token={token}")


@app.get("/users")
async def list_users(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [
        {"id": u.id, "email": u.email, "name": u.name, "role": u.role,
         "is_active": u.is_active, "last_login": u.last_login.isoformat() if u.last_login else None}
        for u in result.scalars().all()
    ]


# ─── SSE ─────────────────────────────────────────────────────────────────────

@app.get("/events")
async def sse_events():
    async def stream() -> AsyncGenerator[str, None]:
        yield 'data: {"type":"connected"}\n\n'
        while True:
            try:
                msg = await asyncio.wait_for(_broadcast_queue.get(), timeout=30)
                yield f"data: {json.dumps(msg)}\n\n"
            except asyncio.TimeoutError:
                yield 'data: {"type":"ping"}\n\n'
    return StreamingResponse(stream(), media_type="text/event-stream")


# ─── Search ───────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    niche: str
    location: str
    radius_km: int = 10
    sources: list[str] = ["google"]


@app.post("/search")
async def search(req: SearchRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    # Log to search history
    history = SearchHistory(niche=req.niche, location=req.location, radius_km=req.radius_km)
    db.add(history)
    await db.commit()

    background_tasks.add_task(_run_pipeline, req.niche, req.location, req.radius_km, None, False, req.sources, str(history.id))
    return {"status": "started", "history_id": str(history.id)}


async def _run_pipeline(niche, location, radius_km, job_id, autonomous, sources=None, history_id=None):
    async with SessionLocal() as db:
        results = await run_search_pipeline(db, niche, location, radius_km, job_id, autonomous, sources or ["google"])
        if history_id:
            await db.execute(
                update(SearchHistory).where(SearchHistory.id == history_id).values(results_count=len(results))
            )
            await db.commit()


# ─── Businesses ───────────────────────────────────────────────────────────────

@app.get("/businesses")
async def list_businesses(
    status: str | None = None,
    niche: str | None = None,
    source: str | None = None,
    min_score: int = 0,
    is_new: bool | None = None,
    is_analyzed: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Business).order_by(desc(Business.found_at))
    if status:
        q = q.where(Business.status == status)
    if niche:
        q = q.where(Business.niche == niche)
    if source:
        q = q.where(Business.source == source)
    if is_new is not None:
        q = q.where(Business.is_new == is_new)
    if is_analyzed is not None:
        q = q.where(Business.is_analyzed == is_analyzed)

    result = await db.execute(q)
    businesses = result.scalars().all()

    if min_score > 0:
        filtered = []
        for b in businesses:
            analysis_result = await db.execute(select(Analysis).where(Analysis.business_id == b.id))
            a = analysis_result.scalar_one_or_none()
            if a and (a.opportunity_score or 0) >= min_score:
                filtered.append(b)
        businesses = filtered

    return [_biz_to_dict(b) for b in businesses]


@app.get("/businesses/{business_id}")
async def get_business(business_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Business).where(Business.id == business_id))
    biz = result.scalar_one_or_none()
    if not biz:
        raise HTTPException(404, "Not found")
    return _biz_to_dict(biz)


@app.patch("/businesses/{business_id}/status")
async def update_status(business_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    status = body.get("status")
    extra = {}
    if status == "contacted":
        extra["contacted_at"] = datetime.now()
    await db.execute(update(Business).where(Business.id == business_id).values(status=status, **extra))
    await db.commit()
    await _fire_webhooks(db, "status_change", {"business_id": business_id, "status": status})
    return {"ok": True}


@app.post("/businesses/{business_id}/mark-seen")
async def mark_seen(business_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(update(Business).where(Business.id == business_id).values(is_new=False))
    await db.commit()
    return {"ok": True}


@app.post("/businesses/mark-all-seen")
async def mark_all_seen(db: AsyncSession = Depends(get_db)):
    await db.execute(update(Business).values(is_new=False))
    await db.commit()
    return {"ok": True}


@app.delete("/businesses/{business_id}")
async def delete_business(business_id: str, db: AsyncSession = Depends(get_db)):
    for model in [Analysis, OwnerContact, LeadNote, EmailSequenceEnrollment]:
        await db.execute(delete(model).where(model.business_id == business_id))
    await db.execute(delete(Business).where(Business.id == business_id))
    await db.commit()
    return {"ok": True}


# ─── Bulk Actions ─────────────────────────────────────────────────────────────

class BulkRequest(BaseModel):
    business_ids: list[str]


@app.post("/businesses/bulk-analyze")
async def bulk_analyze(req: BulkRequest, background_tasks: BackgroundTasks):
    for bid in req.business_ids:
        background_tasks.add_task(_run_analysis, bid)
    return {"status": "queued", "count": len(req.business_ids)}


@app.post("/businesses/bulk-export-ghl")
async def bulk_export_ghl(req: BulkRequest, db: AsyncSession = Depends(get_db)):
    results = []
    for bid in req.business_ids:
        biz_r = await db.execute(select(Business).where(Business.id == bid))
        biz = biz_r.scalar_one_or_none()
        ana_r = await db.execute(select(Analysis).where(Analysis.business_id == bid))
        ana = ana_r.scalar_one_or_none()
        if biz:
            res = await push_contact(_biz_to_dict(biz), _analysis_to_dict(ana) if ana else {})
            results.append({"id": bid, **res})
    return results


@app.post("/businesses/bulk-delete")
async def bulk_delete(req: BulkRequest, db: AsyncSession = Depends(get_db)):
    for bid in req.business_ids:
        for model in [Analysis, OwnerContact, LeadNote, EmailSequenceEnrollment]:
            await db.execute(delete(model).where(model.business_id == bid))
        await db.execute(delete(Business).where(Business.id == bid))
    await db.commit()
    return {"ok": True, "deleted": len(req.business_ids)}


# ─── Analysis ─────────────────────────────────────────────────────────────────

@app.post("/businesses/{business_id}/analyze")
async def analyze(business_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_analysis, business_id)
    return {"status": "analyzing"}


async def _run_analysis(business_id: str):
    async with SessionLocal() as db:
        await analyze_single_business(db, business_id)


@app.get("/businesses/{business_id}/analysis")
async def get_analysis(business_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Analysis).where(Analysis.business_id == business_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, "No analysis yet")
    return _analysis_to_dict(analysis)


# ─── Owner Contact ─────────────────────────────────────────────────────────────

@app.post("/businesses/{business_id}/find-owner")
async def find_owner(business_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_owner_search, business_id)
    return {"status": "searching"}


async def _run_owner_search(business_id: str):
    async with SessionLocal() as db:
        biz_r = await db.execute(select(Business).where(Business.id == business_id))
        biz = biz_r.scalar_one_or_none()
        if not biz:
            return

        owner_data = await find_owner_contact(_biz_to_dict(biz))

        existing = await db.execute(select(OwnerContact).where(OwnerContact.business_id == business_id))
        owner = existing.scalar_one_or_none()

        if owner:
            for k, v in owner_data.items():
                setattr(owner, k, v)
        else:
            owner = OwnerContact(business_id=business_id, **owner_data)
            db.add(owner)

        await db.commit()
        await _broadcast_queue.put({"type": "owner_found", "business_id": business_id, "data": _owner_to_dict(owner)})


@app.get("/businesses/{business_id}/owner")
async def get_owner(business_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OwnerContact).where(OwnerContact.business_id == business_id))
    owner = result.scalar_one_or_none()
    if not owner:
        raise HTTPException(404, "No owner contact found yet")
    return _owner_to_dict(owner)


def _owner_to_dict(o: OwnerContact) -> dict:
    return {
        "id": o.id,
        "business_id": o.business_id,
        "owner_name": o.owner_name,
        "owner_title": o.owner_title,
        "personal_phone": o.personal_phone,
        "personal_email": o.personal_email,
        "linkedin_url": o.linkedin_url,
        "facebook_url": o.facebook_url,
        "sources": o.sources,
        "confidence": o.confidence,
        "found_at": o.found_at.isoformat() if o.found_at else None,
    }


# ─── Notes ────────────────────────────────────────────────────────────────────

class NoteRequest(BaseModel):
    content: str


@app.get("/businesses/{business_id}/notes")
async def get_notes(business_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LeadNote).where(LeadNote.business_id == business_id).order_by(desc(LeadNote.created_at))
    )
    return [{"id": n.id, "content": n.content, "created_at": n.created_at.isoformat()} for n in result.scalars().all()]


@app.post("/businesses/{business_id}/notes")
async def add_note(business_id: str, req: NoteRequest, db: AsyncSession = Depends(get_db)):
    note = LeadNote(business_id=business_id, content=req.content)
    db.add(note)
    await db.commit()
    return {"id": note.id, "content": note.content, "created_at": note.created_at.isoformat()}


@app.delete("/notes/{note_id}")
async def delete_note(note_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(LeadNote).where(LeadNote.id == note_id))
    await db.commit()
    return {"ok": True}


# ─── Export ───────────────────────────────────────────────────────────────────

@app.get("/export/csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
    businesses, analyses, owners = await _gather_export_data(db)
    data = generate_csv(businesses, analyses, owners)
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="ear-labs-leads-{datetime.now().strftime("%Y%m%d")}.csv"'},
    )


@app.get("/export/excel")
async def export_excel(db: AsyncSession = Depends(get_db)):
    businesses, analyses, owners = await _gather_export_data(db)
    data = generate_excel(businesses, analyses, owners)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="ear-labs-leads-{datetime.now().strftime("%Y%m%d")}.xlsx"'},
    )


async def _gather_export_data(db: AsyncSession):
    biz_result = await db.execute(select(Business).order_by(desc(Business.found_at)))
    businesses = [_biz_to_dict(b) for b in biz_result.scalars().all()]

    analysis_result = await db.execute(select(Analysis))
    analyses = {a.business_id: _analysis_to_dict(a) for a in analysis_result.scalars().all()}

    owner_result = await db.execute(select(OwnerContact))
    owners = {o.business_id: _owner_to_dict(o) for o in owner_result.scalars().all()}

    return businesses, analyses, owners


# ─── Integrations ─────────────────────────────────────────────────────────────

@app.post("/businesses/{business_id}/export-ghl")
async def export_to_ghl(business_id: str, db: AsyncSession = Depends(get_db)):
    biz_r = await db.execute(select(Business).where(Business.id == business_id))
    biz = biz_r.scalar_one_or_none()
    if not biz:
        raise HTTPException(404, "Not found")
    ana_r = await db.execute(select(Analysis).where(Analysis.business_id == business_id))
    ana = ana_r.scalar_one_or_none()
    return await push_contact(_biz_to_dict(biz), _analysis_to_dict(ana) if ana else {})


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str


@app.get("/email-provider")
async def get_email_provider():
    return {"provider": EMAIL_PROVIDER}


@app.get("/instantly/campaigns")
async def get_instantly_campaigns():
    return await list_campaigns()


@app.post("/send-email")
async def send_email_route(req: SendEmailRequest):
    if EMAIL_PROVIDER == "instantly":
        return await send_email_via_instantly(req.to, req.subject, req.body)
    return await send_via_gmail(req.to, req.subject, req.body)


# ─── Email Sequences ──────────────────────────────────────────────────────────

class SequenceRequest(BaseModel):
    name: str
    description: str = ""
    steps: list[dict]


@app.post("/sequences")
async def create_sequence(req: SequenceRequest, db: AsyncSession = Depends(get_db)):
    seq = EmailSequence(name=req.name, description=req.description)
    db.add(seq)
    await db.flush()
    for i, step in enumerate(req.steps):
        s = EmailSequenceStep(
            sequence_id=str(seq.id),
            step_number=i + 1,
            subject_template=step.get("subject"),
            body_template=step.get("body"),
            delay_days=step.get("delay_days", 0),
        )
        db.add(s)
    await db.commit()
    return {"id": seq.id, "name": seq.name}


@app.get("/sequences")
async def list_sequences(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmailSequence))
    sequences = result.scalars().all()
    output = []
    for seq in sequences:
        steps_r = await db.execute(
            select(EmailSequenceStep).where(EmailSequenceStep.sequence_id == str(seq.id)).order_by(EmailSequenceStep.step_number)
        )
        steps = [{"step_number": s.step_number, "subject": s.subject_template, "body": s.body_template, "delay_days": s.delay_days}
                 for s in steps_r.scalars().all()]
        output.append({"id": seq.id, "name": seq.name, "description": seq.description, "is_active": seq.is_active, "steps": steps})
    return output


@app.delete("/sequences/{seq_id}")
async def delete_sequence(seq_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(EmailSequenceStep).where(EmailSequenceStep.sequence_id == seq_id))
    await db.execute(delete(EmailSequence).where(EmailSequence.id == seq_id))
    await db.commit()
    return {"ok": True}


@app.post("/sequences/{seq_id}/enroll/{business_id}")
async def enroll_in_sequence(seq_id: str, business_id: str, db: AsyncSession = Depends(get_db)):
    enrollment = EmailSequenceEnrollment(
        sequence_id=seq_id,
        business_id=business_id,
        next_send_at=datetime.now(),
    )
    db.add(enrollment)
    await db.commit()
    return {"id": enrollment.id, "status": "active"}


# ─── Webhooks ─────────────────────────────────────────────────────────────────

class WebhookRequest(BaseModel):
    name: str
    url: str
    trigger: str
    secret: str = ""


@app.get("/webhooks")
async def list_webhooks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WebhookConfig))
    return [{"id": w.id, "name": w.name, "url": w.url, "trigger": w.trigger, "is_active": w.is_active}
            for w in result.scalars().all()]


@app.post("/webhooks")
async def create_webhook(req: WebhookRequest, db: AsyncSession = Depends(get_db)):
    w = WebhookConfig(name=req.name, url=req.url, trigger=req.trigger, secret=req.secret)
    db.add(w)
    await db.commit()
    return {"id": w.id}


@app.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(WebhookConfig).where(WebhookConfig.id == webhook_id))
    await db.commit()
    return {"ok": True}


async def _fire_webhooks(db: AsyncSession, trigger: str, payload: dict):
    result = await db.execute(
        select(WebhookConfig).where(WebhookConfig.trigger == trigger, WebhookConfig.is_active == True)
    )
    webhooks = result.scalars().all()
    for wh in webhooks:
        try:
            body = json.dumps(payload).encode()
            headers = {"Content-Type": "application/json"}
            if wh.secret:
                sig = hmac.new(wh.secret.encode(), body, hashlib.sha256).hexdigest()
                headers["X-EAR-Signature"] = sig
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(wh.url, content=body, headers=headers)
        except Exception as e:
            logger.warning(f"Webhook {wh.url} failed: {e}")


# ─── Scheduled Jobs ───────────────────────────────────────────────────────────

class JobRequest(BaseModel):
    niche: str
    location: str
    radius_km: int = 10
    interval_minutes: int = 60
    is_autonomous: bool = False
    sources: list[str] = ["google"]


@app.post("/jobs")
async def create_job(req: JobRequest, db: AsyncSession = Depends(get_db)):
    job = SearchJob(
        niche=req.niche, location=req.location, radius_km=req.radius_km,
        interval_minutes=req.interval_minutes, is_autonomous=req.is_autonomous,
    )
    db.add(job)
    await db.commit()
    await add_search_job(str(job.id), job.niche, job.location, job.radius_km, job.interval_minutes, SessionLocal)
    return {"id": job.id, "status": "scheduled"}


@app.get("/jobs")
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SearchJob))
    return [
        {"id": j.id, "niche": j.niche, "location": j.location, "interval_minutes": j.interval_minutes,
         "is_active": j.is_active, "is_autonomous": j.is_autonomous,
         "last_run": j.last_run.isoformat() if j.last_run else None, "total_found": j.total_found}
        for j in result.scalars().all()
    ]


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    remove_search_job(job_id)
    await db.execute(delete(SearchJob).where(SearchJob.id == job_id))
    await db.commit()
    return {"ok": True}


@app.patch("/jobs/{job_id}/toggle")
async def toggle_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SearchJob).where(SearchJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Not found")
    job.is_active = not job.is_active
    if job.is_active:
        await add_search_job(str(job.id), job.niche, job.location, job.radius_km, job.interval_minutes, SessionLocal)
    else:
        remove_search_job(str(job.id))
    await db.commit()
    return {"is_active": job.is_active}


# ─── Search History ───────────────────────────────────────────────────────────

@app.get("/search-history")
async def get_search_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SearchHistory).order_by(desc(SearchHistory.searched_at)).limit(50))
    return [
        {"id": h.id, "niche": h.niche, "location": h.location,
         "radius_km": h.radius_km, "results_count": h.results_count,
         "searched_at": h.searched_at.isoformat()}
        for h in result.scalars().all()
    ]


@app.delete("/search-history/{history_id}")
async def delete_history(history_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(SearchHistory).where(SearchHistory.id == history_id))
    await db.commit()
    return {"ok": True}


# ─── Stats & Dashboard ────────────────────────────────────────────────────────

@app.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_r = await db.execute(select(func.count()).select_from(Business))
    analyzed_r = await db.execute(select(func.count()).select_from(Business).where(Business.is_analyzed == True))
    new_r = await db.execute(select(func.count()).select_from(Business).where(Business.is_new == True))
    won_r = await db.execute(select(func.count()).select_from(Business).where(Business.status == "won"))
    contacted_r = await db.execute(select(func.count()).select_from(Business).where(Business.status.in_(["contacted", "replied", "proposal", "won"])))
    with_email_r = await db.execute(select(Business).where(Business.emails != "[]"))

    return {
        "total": total_r.scalar(),
        "analyzed": analyzed_r.scalar(),
        "new": new_r.scalar(),
        "won": won_r.scalar(),
        "contacted": contacted_r.scalar(),
        "with_email": sum(1 for b in (await db.execute(select(Business))).scalars().all() if b.emails),
    }


@app.get("/stats/timeline")
async def get_timeline(days: int = 30, db: AsyncSession = Depends(get_db)):
    since = datetime.now() - timedelta(days=days)
    result = await db.execute(select(Business).where(Business.found_at >= since).order_by(Business.found_at))
    businesses = result.scalars().all()

    by_day: dict[str, int] = {}
    for b in businesses:
        if b.found_at:
            day = b.found_at.strftime("%Y-%m-%d")
            by_day[day] = by_day.get(day, 0) + 1

    return [{"date": k, "count": v} for k, v in sorted(by_day.items())]


@app.get("/stats/by-niche")
async def get_by_niche(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Business.niche, func.count()).group_by(Business.niche))
    return [{"niche": row[0] or "Unknown", "count": row[1]} for row in result.all()]


@app.get("/stats/by-status")
async def get_by_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Business.status, func.count()).group_by(Business.status))
    return [{"status": row[0] or "new", "count": row[1]} for row in result.all()]


# ─── AI Chat ─────────────────────────────────────────────────────────────────

class ChatMessageItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessageItem] = []


@app.post("/chat")
async def chat_with_zap(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    import anthropic

    # Gather live DB context
    total = await db.scalar(select(func.count(Business.id))) or 0
    new_ct = await db.scalar(select(func.count(Business.id)).where(Business.is_new == True)) or 0
    analyzed_ct = await db.scalar(select(func.count(Business.id)).where(Business.is_analyzed == True)) or 0
    won_ct = await db.scalar(select(func.count(Business.id)).where(Business.status == "won")) or 0

    recent_result = await db.execute(select(Business).order_by(desc(Business.found_at)).limit(8))
    recent = [b.name for b in recent_result.scalars().all()]

    niches_result = await db.execute(
        select(Business.niche, func.count()).group_by(Business.niche).order_by(desc(func.count())).limit(5)
    )
    top_niches = [row[0] for row in niches_result.all() if row[0]]

    system_prompt = f"""You are ZAP, the AI assistant embedded in EAR Labs Scraper — an autonomous lead generation and outreach platform powered by WeOps.

Current database snapshot:
- Total leads: {total}
- New (unseen) leads: {new_ct}
- AI-analyzed leads: {analyzed_ct}
- Won deals: {won_ct}
- Recent leads: {", ".join(recent) if recent else "none yet"}
- Top niches: {", ".join(top_niches) if top_niches else "none yet"}

You can assist with:
- Searching for businesses (niche + location)
- Filtering leads by score, status, or niche
- Running AI analysis on unanalyzed leads
- Navigating to specific views (leads, pipeline, dashboard, sequences)
- Exporting lead data
- Advising on outreach strategy

When you want to trigger an action, append a JSON line after your response in this exact format:
ACTION: {{"type": "navigate", "view": "leads"}}
ACTION: {{"type": "search", "niche": "restaurants", "location": "Austin TX"}}
ACTION: {{"type": "filter", "minScore": 70}}
ACTION: {{"type": "analyze"}}
ACTION: {{"type": "export"}}

Keep responses concise (2-4 sentences). You are a sharp sales intelligence assistant."""

    messages = [{"role": m.role, "content": m.content} for m in request.history]
    messages.append({"role": "user", "content": request.message})

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        system=system_prompt,
        messages=messages,
    )

    content = response.content[0].text
    action = None

    if "ACTION:" in content:
        parts = content.split("ACTION:")
        content = parts[0].strip()
        try:
            action = json.loads(parts[1].strip())
        except Exception:
            pass

    return {"response": content, "action": action}


# ─── App Settings (API Keys editable from UI) ─────────────────────────────────

# Which keys are allowed to be set via the UI (never expose raw secrets in GET)
SETTING_KEYS = [
    "GOOGLE_PLACES_API_KEY", "ANTHROPIC_API_KEY",
    "EMAIL_PROVIDER",
    "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN",
    "INSTANTLY_API_KEY", "INSTANTLY_CAMPAIGN_ID",
    "GHL_API_KEY", "GHL_LOCATION_ID",
    "YELP_API_KEY",
    "HUNTER_API_KEY", "PDL_API_KEY",
    "GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_CX",
]


def _mask(value: str) -> str:
    if not value or len(value) < 8:
        return "" if not value else "••••••••"
    return "••••••••" + value[-4:]


@app.get("/settings/keys")
async def get_settings_keys(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(select(AppSetting))
    db_settings = {row.key: row.value for row in result.scalars().all()}

    out = {}
    for key in SETTING_KEYS:
        raw = db_settings.get(key) or os.getenv(key, "")
        out[key] = {"masked": _mask(raw), "is_set": bool(raw)}
    return out


class SettingsUpdateRequest(BaseModel):
    settings: dict[str, str]


@app.post("/settings/keys")
async def update_settings_keys(
    req: SettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    for key, value in req.settings.items():
        if key not in SETTING_KEYS:
            continue
        value = value.strip()
        if not value:
            continue
        existing = await db.get(AppSetting, key)
        if existing:
            existing.value = value
        else:
            db.add(AppSetting(key=key, value=value))
        _settings_cache[key] = value

    await db.commit()
    return {"saved": list(req.settings.keys())}
