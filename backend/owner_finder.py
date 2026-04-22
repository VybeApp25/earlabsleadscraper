"""
Owner contact research module.
Finds publicly available owner name, personal phone, and personal email
by searching Google, Hunter.io, People Data Labs, LinkedIn public pages,
state business registries, and WHOIS registrant data.
All sources are public/opt-in data — same approach as Apollo.io / ZoomInfo.
"""

import os
import re
import httpx
import asyncio
import logging
import json
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
import anthropic

logger = logging.getLogger(__name__)
ua = UserAgent()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
HUNTER_API_KEY = os.getenv("HUNTER_API_KEY", "")
PDL_API_KEY = os.getenv("PDL_API_KEY", "")  # People Data Labs
GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY", "")
GOOGLE_SEARCH_CX = os.getenv("GOOGLE_SEARCH_CX", "")  # Custom Search Engine ID

ai = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


async def find_owner_contact(business: dict) -> dict:
    """
    Orchestrate all available sources to find owner contact info.
    Returns unified result with confidence rating.
    """
    name = business.get("name", "")
    city = business.get("city", "")
    website = business.get("website", "")
    niche = business.get("niche", "")

    results = {}
    sources = []

    tasks = [
        _search_google_for_owner(name, city, niche),
        _hunter_find_email(website),
        _whois_registrant(website),
    ]

    if PDL_API_KEY:
        tasks.append(_pdl_enrich(name, city, website))
    else:
        tasks.append(asyncio.sleep(0))

    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    google_data = raw_results[0] if not isinstance(raw_results[0], Exception) else {}
    hunter_data = raw_results[1] if not isinstance(raw_results[1], Exception) else {}
    whois_data = raw_results[2] if not isinstance(raw_results[2], Exception) else {}
    pdl_data = raw_results[3] if not isinstance(raw_results[3], Exception) else {}

    if google_data:
        sources.append("google_search")
    if hunter_data:
        sources.append("hunter_io")
    if whois_data:
        sources.append("whois")
    if pdl_data and isinstance(pdl_data, dict) and pdl_data:
        sources.append("people_data_labs")

    # Use Claude to synthesize all raw data into structured owner info
    synthesis = await _synthesize_owner_data(
        business_name=name,
        city=city,
        google_data=google_data,
        hunter_data=hunter_data,
        whois_data=whois_data,
        pdl_data=pdl_data if isinstance(pdl_data, dict) else {},
    )

    confidence = _calculate_confidence(synthesis, sources)

    return {
        "owner_name": synthesis.get("owner_name"),
        "owner_title": synthesis.get("owner_title"),
        "personal_phone": synthesis.get("personal_phone"),
        "personal_email": synthesis.get("personal_email"),
        "linkedin_url": synthesis.get("linkedin_url"),
        "facebook_url": synthesis.get("facebook_url"),
        "sources": sources,
        "confidence": confidence,
        "raw_data": {
            "google": google_data,
            "hunter": hunter_data,
            "whois": whois_data,
            "pdl": pdl_data if isinstance(pdl_data, dict) else {},
        },
    }


async def _search_google_for_owner(name: str, city: str, niche: str) -> dict:
    """Search Google Custom Search API for owner name and contact info."""
    if not GOOGLE_SEARCH_API_KEY or not GOOGLE_SEARCH_CX:
        return await _scrape_google_fallback(name, city, niche)

    queries = [
        f'"{name}" owner OR founder OR CEO "{city}"',
        f'"{name}" {niche} owner contact phone',
    ]

    results_text = []
    async with httpx.AsyncClient(timeout=15) as client:
        for q in queries:
            try:
                resp = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={"key": GOOGLE_SEARCH_API_KEY, "cx": GOOGLE_SEARCH_CX, "q": q, "num": 5},
                )
                data = resp.json()
                for item in data.get("items", []):
                    results_text.append(f"Title: {item.get('title')}\nSnippet: {item.get('snippet')}\nURL: {item.get('link')}")
            except Exception as e:
                logger.warning(f"Google search failed: {e}")

    return {"search_results": results_text[:8]} if results_text else {}


async def _scrape_google_fallback(name: str, city: str, niche: str) -> dict:
    """Fallback: scrape DuckDuckGo for owner info without API key."""
    query = f"{name} {city} owner founder contact"
    encoded = query.replace(" ", "+")
    url = f"https://html.duckduckgo.com/html/?q={encoded}"
    headers = {"User-Agent": ua.random, "Accept-Language": "en-US,en;q=0.9"}

    try:
        async with httpx.AsyncClient(timeout=15, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "lxml")
            snippets = []
            for result in soup.select(".result__snippet")[:6]:
                snippets.append(result.get_text(strip=True))
            titles = []
            for result in soup.select(".result__title")[:6]:
                titles.append(result.get_text(strip=True))
            return {"snippets": snippets, "titles": titles}
    except Exception as e:
        logger.warning(f"DuckDuckGo fallback failed: {e}")
        return {}


async def _hunter_find_email(website: str) -> dict:
    """Use Hunter.io to find emails and owner info for a domain."""
    if not HUNTER_API_KEY or not website:
        return {}

    domain = re.sub(r"https?://(www\.)?", "", website or "").split("/")[0]
    if not domain:
        return {}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.hunter.io/v2/domain-search",
                params={"domain": domain, "api_key": HUNTER_API_KEY, "limit": 10},
            )
            data = resp.json().get("data", {})
            emails = data.get("emails", [])
            owner_emails = [
                e for e in emails
                if any(t in (e.get("type") or "") for t in ["owner", "ceo", "founder", "president", "director"])
                or any(t in (e.get("value") or "").lower() for t in ["owner", "ceo", "founder", "info", "contact"])
            ]
            return {
                "domain": domain,
                "organization": data.get("organization"),
                "emails": [{"email": e.get("value"), "first": e.get("first_name"), "last": e.get("last_name"), "position": e.get("position")} for e in (owner_emails or emails[:3])],
            }
    except Exception as e:
        logger.warning(f"Hunter.io lookup failed for {website}: {e}")
        return {}


async def _whois_registrant(website: str) -> dict:
    """Extract registrant name/phone/email from WHOIS records."""
    if not website:
        return {}

    import whois as whois_lib
    domain = re.sub(r"https?://(www\.)?", "", website or "").split("/")[0]
    if not domain:
        return {}

    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, whois_lib.whois, domain)
        result = {}
        if info.get("registrant_name") or info.get("name"):
            result["registrant_name"] = info.get("registrant_name") or info.get("name")
        if info.get("registrant_email") or info.get("emails"):
            emails = info.get("registrant_email") or info.get("emails")
            result["registrant_email"] = emails[0] if isinstance(emails, list) else emails
        if info.get("registrant_phone"):
            result["registrant_phone"] = info.get("registrant_phone")
        if info.get("org"):
            result["org"] = info.get("org")
        return result
    except Exception as e:
        logger.warning(f"WHOIS lookup failed for {website}: {e}")
        return {}


async def _pdl_enrich(name: str, city: str, website: str) -> dict:
    """People Data Labs — person enrichment API."""
    if not PDL_API_KEY:
        return {}

    domain = re.sub(r"https?://(www\.)?", "", website or "").split("/")[0]
    params = {
        "company": name,
        "location_locality": city,
        "min_likelihood": 6,
        "pretty": True,
    }
    if domain:
        params["company_domain"] = domain

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.peopledatalabs.com/v5/person/enrich",
                params=params,
                headers={"X-Api-Key": PDL_API_KEY},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "full_name": data.get("full_name"),
                    "first_name": data.get("first_name"),
                    "last_name": data.get("last_name"),
                    "job_title": data.get("job_title"),
                    "mobile_phone": data.get("mobile_phone"),
                    "personal_emails": data.get("personal_emails", []),
                    "linkedin_url": data.get("linkedin_url"),
                    "facebook_url": data.get("facebook_url"),
                    "location_name": data.get("location_name"),
                }
    except Exception as e:
        logger.warning(f"PDL enrichment failed: {e}")
    return {}


async def _synthesize_owner_data(
    business_name: str,
    city: str,
    google_data: dict,
    hunter_data: dict,
    whois_data: dict,
    pdl_data: dict,
) -> dict:
    """Use Claude to parse all raw sources and extract structured owner contact info."""
    prompt = f"""You are extracting business owner contact information from multiple raw data sources.
Extract ONLY factual information that is explicitly present in the data. Do NOT guess or fabricate.

BUSINESS: {business_name} in {city}

GOOGLE SEARCH RESULTS:
{json.dumps(google_data, indent=2)[:2000]}

HUNTER.IO DATA:
{json.dumps(hunter_data, indent=2)[:1000]}

WHOIS REGISTRANT DATA:
{json.dumps(whois_data, indent=2)[:500]}

PEOPLE DATA LABS:
{json.dumps(pdl_data, indent=2)[:1000]}

Return ONLY a JSON object. Use null for any field not found:
{{
  "owner_name": "<full name of owner/founder/CEO or null>",
  "owner_title": "<title: Owner/CEO/Founder/etc or null>",
  "personal_phone": "<personal mobile number in E.164 format or null>",
  "personal_email": "<personal email address or null>",
  "linkedin_url": "<full linkedin.com URL or null>",
  "facebook_url": "<full facebook.com profile URL or null>"
}}"""

    try:
        msg = await ai.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        logger.error(f"Owner synthesis failed: {e}")
        return {}


def _calculate_confidence(synthesis: dict, sources: list) -> str:
    filled = sum(1 for v in synthesis.values() if v)
    score = filled * 15 + len(sources) * 10
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    return "low"
