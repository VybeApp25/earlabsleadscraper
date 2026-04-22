import asyncio
import logging
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from models import Business, Analysis, SearchJob
from scraper import search_businesses, scrape_website, get_domain_age, get_traffic_estimate, detect_website_outdated
from analyzer import analyze_business, generate_lovable_prompt, generate_email_template, generate_dm_template

logger = logging.getLogger(__name__)
_broadcast_queue: asyncio.Queue = asyncio.Queue()


async def run_search_pipeline(
    db: AsyncSession,
    niche: str,
    location: str,
    radius_km: int = 10,
    job_id: str | None = None,
    autonomous: bool = False,
    sources: list[str] | None = None,
) -> list[dict]:
    scan_id = str(uuid.uuid4())
    logger.info(f"Starting scan {scan_id} — {niche} in {location}")

    raw_businesses = await search_businesses(niche, location, radius_km, sources or ["google"])
    new_businesses = []

    for biz_data in raw_businesses:
        # Check if already exists
        existing = await db.execute(
            select(Business).where(Business.google_place_id == biz_data.get("google_place_id"))
        )
        if existing.scalar_one_or_none():
            continue

        city = location
        biz = Business(
            name=biz_data["name"],
            phone=biz_data.get("phone"),
            website=biz_data.get("website"),
            address=biz_data.get("address"),
            city=city,
            niche=niche,
            google_place_id=biz_data.get("google_place_id"),
            google_rating=biz_data.get("google_rating"),
            google_review_count=biz_data.get("google_review_count"),
            social_links=biz_data.get("social_links", {}),
            emails=[],
            is_new=True,
            is_analyzed=False,
            scan_id=scan_id,
        )
        db.add(biz)
        await db.flush()

        # Scrape website for emails + social links
        if biz.website:
            site_data = await scrape_website(biz.website)
            biz.emails = site_data.get("emails", [])
            if site_data.get("social_links"):
                biz.social_links = {**biz.social_links, **site_data["social_links"]}

        new_businesses.append(biz)
        await _broadcast_queue.put({"type": "new_business", "business": _biz_to_dict(biz)})

    await db.commit()

    # Update job stats
    if job_id:
        await db.execute(
            update(SearchJob)
            .where(SearchJob.id == job_id)
            .values(last_run=datetime.now(), total_found=SearchJob.total_found + len(new_businesses))
        )
        await db.commit()

    # Auto-analyze in autonomous mode
    if autonomous and new_businesses:
        asyncio.create_task(_analyze_batch(db, new_businesses))

    logger.info(f"Scan {scan_id} complete — {len(new_businesses)} new businesses")
    return [_biz_to_dict(b) for b in new_businesses]


async def _analyze_batch(db: AsyncSession, businesses: list[Business]):
    for biz in businesses:
        try:
            await analyze_single_business(db, str(biz.id))
            await asyncio.sleep(1)  # rate limit
        except Exception as e:
            logger.error(f"Auto-analysis failed for {biz.id}: {e}")


async def analyze_single_business(db: AsyncSession, business_id: str) -> dict:
    result = await db.execute(select(Business).where(Business.id == business_id))
    biz = result.scalar_one_or_none()
    if not biz:
        return {"error": "Business not found"}

    site_data = {}
    domain_age = None
    traffic = {}

    if biz.website:
        site_data, domain_age, traffic = await asyncio.gather(
            scrape_website(biz.website),
            get_domain_age(biz.website),
            get_traffic_estimate(biz.website),
        )

    biz_dict = _biz_to_dict(biz)
    analysis_data = await analyze_business(biz_dict, site_data, traffic, domain_age)
    lovable_prompt = await generate_lovable_prompt(biz_dict, analysis_data, site_data)
    email_template = await generate_email_template(biz_dict, analysis_data)
    dm_template = await generate_dm_template(biz_dict, analysis_data)

    analysis = Analysis(
        business_id=business_id,
        social_proof_score=analysis_data.get("social_proof_score", 0),
        social_proof_breakdown=analysis_data.get("social_proof_breakdown", {}),
        website_age_years=domain_age,
        website_tech_stack=analysis_data.get("website_tech_notes", ""),
        website_is_outdated=analysis_data.get("website_is_outdated", False),
        traffic_monthly=traffic.get("monthly", 0),
        traffic_weekly=traffic.get("weekly", 0),
        traffic_daily=traffic.get("daily", 0),
        traffic_yearly=traffic.get("yearly", 0),
        pain_points=analysis_data.get("pain_points", []),
        opportunity_score=analysis_data.get("opportunity_score", 0),
        lovable_prompt=lovable_prompt,
        email_template=email_template,
        dm_template=dm_template,
        website_summary=analysis_data.get("website_summary", ""),
    )
    db.add(analysis)

    biz.is_analyzed = True
    if site_data.get("emails"):
        biz.emails = list(set(biz.emails + site_data["emails"]))

    await db.commit()
    await _broadcast_queue.put({"type": "analysis_complete", "business_id": business_id})
    return _analysis_to_dict(analysis)


def _biz_to_dict(b: Business) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "phone": b.phone,
        "emails": b.emails or [],
        "website": b.website,
        "address": b.address,
        "city": b.city,
        "niche": b.niche,
        "google_place_id": b.google_place_id,
        "google_rating": b.google_rating,
        "google_review_count": b.google_review_count,
        "social_links": b.social_links or {},
        "is_new": b.is_new,
        "is_analyzed": b.is_analyzed,
        "found_at": b.found_at.isoformat() if b.found_at else None,
        "scan_id": b.scan_id,
    }


def _analysis_to_dict(a: Analysis) -> dict:
    return {
        "id": a.id,
        "business_id": a.business_id,
        "social_proof_score": a.social_proof_score,
        "social_proof_breakdown": a.social_proof_breakdown,
        "website_age_years": a.website_age_years,
        "website_tech_stack": a.website_tech_stack,
        "website_is_outdated": a.website_is_outdated,
        "traffic_monthly": a.traffic_monthly,
        "traffic_weekly": a.traffic_weekly,
        "traffic_daily": a.traffic_daily,
        "traffic_yearly": a.traffic_yearly,
        "pain_points": a.pain_points,
        "opportunity_score": a.opportunity_score,
        "lovable_prompt": a.lovable_prompt,
        "email_template": a.email_template,
        "dm_template": a.dm_template,
        "website_summary": a.website_summary,
    }
