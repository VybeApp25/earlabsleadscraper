"""
Instantly.ai integration — add leads to campaigns and send via Instantly's
email infrastructure. Instantly handles warmup, rotation, and deliverability.
"""

import httpx
import os
import logging

logger = logging.getLogger(__name__)

INSTANTLY_API_KEY = os.getenv("INSTANTLY_API_KEY", "")
INSTANTLY_BASE = "https://api.instantly.ai/api/v1"


async def add_lead_to_campaign(
    email: str,
    first_name: str,
    last_name: str,
    company_name: str,
    campaign_id: str,
    custom_variables: dict | None = None,
) -> dict:
    """Add a single lead to an Instantly campaign."""
    if not INSTANTLY_API_KEY:
        return {"error": "Instantly API key not configured"}
    if not campaign_id:
        return {"error": "INSTANTLY_CAMPAIGN_ID not set in .env"}

    payload = {
        "api_key": INSTANTLY_API_KEY,
        "campaign_id": campaign_id,
        "skip_if_in_workspace": True,
        "leads": [
            {
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "company_name": company_name,
                **(custom_variables or {}),
            }
        ],
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{INSTANTLY_BASE}/lead/add", json=payload)
        if resp.status_code == 200:
            return {"success": True, "data": resp.json()}
        return {"error": resp.text, "status": resp.status_code}


async def list_campaigns() -> list[dict]:
    """Fetch all Instantly campaigns for the account."""
    if not INSTANTLY_API_KEY:
        return []
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{INSTANTLY_BASE}/campaign/list",
            params={"api_key": INSTANTLY_API_KEY, "limit": 100, "skip": 0},
        )
        if resp.status_code == 200:
            return resp.json()
    return []


async def send_email_via_instantly(
    to_email: str,
    subject: str,
    body: str,
    campaign_id: str | None = None,
    from_name: str = "EAR Labs",
) -> dict:
    """
    Send a one-off email through Instantly by adding the lead to a campaign
    with personalized email content as custom variables.
    Note: Instantly is campaign-based — this adds the lead and triggers the sequence.
    """
    cid = campaign_id or os.getenv("INSTANTLY_CAMPAIGN_ID", "")
    if not cid:
        return {"error": "No Instantly campaign ID configured. Set INSTANTLY_CAMPAIGN_ID in .env"}

    name_parts = to_email.split("@")[0].split(".")
    first = name_parts[0].capitalize() if name_parts else "there"
    last = name_parts[1].capitalize() if len(name_parts) > 1 else ""

    return await add_lead_to_campaign(
        email=to_email,
        first_name=first,
        last_name=last,
        company_name="",
        campaign_id=cid,
        custom_variables={"custom_subject": subject, "custom_body": body},
    )
