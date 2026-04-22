import httpx
import os
import logging

logger = logging.getLogger(__name__)

GHL_API_KEY = os.getenv("GHL_API_KEY", "")
GHL_LOCATION_ID = os.getenv("GHL_LOCATION_ID", "")
GHL_BASE = "https://services.leadconnectorhq.com"


async def push_contact(business: dict, analysis: dict) -> dict:
    """Create or update a contact in GoHighLevel."""
    if not GHL_API_KEY:
        return {"error": "GoHighLevel API key not configured"}

    emails = business.get("emails", [])
    payload = {
        "locationId": GHL_LOCATION_ID,
        "firstName": business.get("name", "").split()[0] if business.get("name") else "",
        "lastName": " ".join(business.get("name", "").split()[1:]) if business.get("name") else "",
        "companyName": business.get("name"),
        "phone": business.get("phone"),
        "email": emails[0] if emails else None,
        "address1": business.get("address"),
        "city": business.get("city"),
        "website": business.get("website"),
        "customField": {
            "opportunity_score": analysis.get("opportunity_score", 0),
            "pain_points": ", ".join(analysis.get("pain_points", [])),
            "niche": business.get("niche"),
        },
        "tags": ["ear-labs-weops", business.get("niche", ""), "needs-website" if analysis.get("website_is_outdated") else ""],
    }

    headers = {
        "Authorization": f"Bearer {GHL_API_KEY}",
        "Content-Type": "application/json",
        "Version": "2021-07-28",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{GHL_BASE}/contacts/", json=payload, headers=headers)
        if resp.status_code in (200, 201):
            return {"success": True, "contact_id": resp.json().get("contact", {}).get("id")}
        return {"error": resp.text, "status": resp.status_code}
