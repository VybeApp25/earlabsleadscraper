import os
import base64
import json
import httpx
import logging
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID", "")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET", "")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN", "")


async def get_access_token() -> str | None:
    if not GMAIL_REFRESH_TOKEN:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "client_id": GMAIL_CLIENT_ID,
            "client_secret": GMAIL_CLIENT_SECRET,
            "refresh_token": GMAIL_REFRESH_TOKEN,
            "grant_type": "refresh_token",
        })
        return resp.json().get("access_token")


async def send_email(to: str, subject: str, body: str) -> dict:
    token = await get_access_token()
    if not token:
        return {"error": "Gmail not configured — add GMAIL_REFRESH_TOKEN to .env"}

    msg = MIMEText(body, "plain")
    msg["To"] = to
    msg["Subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            json={"raw": raw},
            headers=headers,
        )
        if resp.status_code == 200:
            return {"success": True, "message_id": resp.json().get("id")}
        return {"error": resp.text}
