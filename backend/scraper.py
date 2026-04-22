import httpx
import re
import asyncio
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
import whois
from datetime import datetime
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)
ua = UserAgent()

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
YELP_API_KEY = os.getenv("YELP_API_KEY", "")


# ─── Google Places ─────────────────────────────────────────────────────────────

async def search_businesses(niche: str, location: str, radius_km: int = 10, sources: list[str] | None = None) -> list[dict]:
    if sources is None:
        sources = ["google"]

    tasks = []
    if "google" in sources:
        tasks.append(_search_google(niche, location, radius_km))
    if "yelp" in sources and YELP_API_KEY:
        tasks.append(_search_yelp(niche, location, radius_km))
    elif "yelp" in sources:
        tasks.append(_scrape_yelp(niche, location))

    results_nested = await asyncio.gather(*tasks, return_exceptions=True)
    combined = []
    seen_names = set()

    for results in results_nested:
        if isinstance(results, Exception):
            logger.error(f"Source search failed: {results}")
            continue
        for biz in results:
            key = biz.get("name", "").lower().strip()
            if key not in seen_names:
                seen_names.add(key)
                combined.append(biz)

    return combined


async def _search_google(niche: str, location: str, radius_km: int) -> list[dict]:
    if not GOOGLE_API_KEY:
        logger.warning("No Google Places API key — using mock data")
        return _mock_businesses(niche, location)

    results = []
    seen_ids = set()
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"

    async with httpx.AsyncClient(timeout=30) as client:
        params = {"query": f"{niche} in {location}", "key": GOOGLE_API_KEY}
        while True:
            resp = await client.get(url, params=params)
            data = resp.json()

            for place in data.get("results", []):
                pid = place.get("place_id")
                if pid in seen_ids:
                    continue
                seen_ids.add(pid)
                detail = await _get_place_details(client, pid)
                results.append({
                    "source": "google",
                    "google_place_id": pid,
                    "name": place.get("name"),
                    "address": place.get("formatted_address"),
                    "google_rating": place.get("rating"),
                    "google_review_count": place.get("user_ratings_total"),
                    "website": detail.get("website"),
                    "phone": detail.get("formatted_phone_number"),
                    "social_links": {},
                })

            next_token = data.get("next_page_token")
            if not next_token:
                break
            await asyncio.sleep(2)
            params = {"pagetoken": next_token, "key": GOOGLE_API_KEY}

    return results


async def _get_place_details(client: httpx.AsyncClient, place_id: str) -> dict:
    resp = await client.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        params={"place_id": place_id, "fields": "website,formatted_phone_number", "key": GOOGLE_API_KEY},
    )
    return resp.json().get("result", {})


# ─── Yelp API ──────────────────────────────────────────────────────────────────

async def _search_yelp(niche: str, location: str, radius_km: int) -> list[dict]:
    results = []
    headers = {"Authorization": f"Bearer {YELP_API_KEY}"}
    params = {
        "term": niche,
        "location": location,
        "radius": min(radius_km * 1000, 40000),
        "limit": 50,
    }
    async with httpx.AsyncClient(timeout=20, headers=headers) as client:
        resp = await client.get("https://api.yelp.com/v3/businesses/search", params=params)
        data = resp.json()
        for biz in data.get("businesses", []):
            results.append({
                "source": "yelp",
                "google_place_id": f"yelp_{biz.get('id')}",
                "name": biz.get("name"),
                "address": ", ".join(filter(None, [
                    biz.get("location", {}).get("address1"),
                    biz.get("location", {}).get("city"),
                    biz.get("location", {}).get("state"),
                ])),
                "google_rating": biz.get("rating"),
                "google_review_count": biz.get("review_count"),
                "website": biz.get("url"),
                "phone": biz.get("display_phone"),
                "social_links": {},
                "yelp_url": biz.get("url"),
            })
    return results


async def _scrape_yelp(niche: str, location: str) -> list[dict]:
    """Fallback Yelp scrape when no API key."""
    encoded_niche = niche.replace(" ", "+")
    encoded_loc = location.replace(" ", "+")
    url = f"https://www.yelp.com/search?find_desc={encoded_niche}&find_loc={encoded_loc}"
    headers = {"User-Agent": ua.random, "Accept-Language": "en-US,en;q=0.9"}
    results = []

    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "lxml")

            for biz_card in soup.select('[data-testid="serp-ia-card"]')[:20]:
                name_el = biz_card.select_one("a.css-1422juy")
                phone_el = biz_card.select_one('[data-testid="biz-details-phone"]')
                rating_el = biz_card.select_one('[aria-label*="star rating"]')
                review_el = biz_card.select_one('[class*="reviewCount"]')

                if name_el:
                    results.append({
                        "source": "yelp",
                        "google_place_id": f"yelp_{name_el.get_text(strip=True).lower().replace(' ', '_')}",
                        "name": name_el.get_text(strip=True),
                        "address": "",
                        "google_rating": float(rating_el["aria-label"].split()[0]) if rating_el else None,
                        "google_review_count": int(re.search(r"\d+", review_el.get_text()) .group()) if review_el else None,
                        "website": None,
                        "phone": phone_el.get_text(strip=True) if phone_el else None,
                        "social_links": {},
                    })
    except Exception as e:
        logger.warning(f"Yelp scrape failed: {e}")

    return results


# ─── Website Analysis ──────────────────────────────────────────────────────────

async def scrape_website(url: str) -> dict:
    if not url:
        return {}
    if not url.startswith("http"):
        url = f"https://{url}"

    headers = {"User-Agent": ua.random}
    result = {"url": url, "emails": [], "social_links": {}, "text_content": "", "title": "", "tech_hints": []}

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "lxml")

            result["title"] = soup.title.string.strip() if soup.title else ""
            result["text_content"] = soup.get_text(separator=" ", strip=True)[:5000]
            result["emails"] = list(set(re.findall(
                r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", resp.text
            )))

            social_patterns = {
                "instagram": r"instagram\.com/([^/\"'\s?#]+)",
                "facebook": r"facebook\.com/([^/\"'\s?#]+)",
                "twitter": r"(?:twitter|x)\.com/([^/\"'\s?#]+)",
                "linkedin": r"linkedin\.com/(?:company|in)/([^/\"'\s?#]+)",
                "tiktok": r"tiktok\.com/@([^/\"'\s?#]+)",
                "youtube": r"youtube\.com/(?:channel|@|user)/([^/\"'\s?#]+)",
            }
            for platform, pattern in social_patterns.items():
                match = re.search(pattern, resp.text, re.IGNORECASE)
                if match:
                    result["social_links"][platform] = f"https://{platform}.com/{match.group(1)}"

            # Tech hints for outdated detection
            tech_hints = []
            if "wp-content" in resp.text or "wordpress" in resp.text.lower():
                version = re.search(r"WordPress (\d+\.\d+)", resp.text)
                tech_hints.append(f"WordPress {version.group(1) if version else ''}")
            if "jquery" in resp.text.lower():
                jq = re.search(r"jquery[/-](\d+\.\d+)", resp.text, re.IGNORECASE)
                tech_hints.append(f"jQuery {jq.group(1) if jq else ''}")
            if re.search(r"<table[^>]*cellpadding|<frameset|<font\s", resp.text, re.IGNORECASE):
                tech_hints.append("Legacy HTML (table layout / font tags)")
            if "bootstrap" in resp.text.lower():
                bs = re.search(r"bootstrap[/@](\d+)", resp.text, re.IGNORECASE)
                tech_hints.append(f"Bootstrap {bs.group(1) if bs else ''}")
            result["tech_hints"] = tech_hints

    except Exception as e:
        logger.warning(f"Website scrape failed for {url}: {e}")

    return result


async def get_domain_age(website: str) -> Optional[float]:
    if not website:
        return None
    try:
        domain = re.sub(r"https?://(www\.)?", "", website).split("/")[0]
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, whois.whois, domain)
        creation = info.creation_date
        if isinstance(creation, list):
            creation = creation[0]
        if creation:
            return round((datetime.now() - creation).days / 365.25, 1)
    except Exception:
        pass
    return None


async def get_traffic_estimate(website: str) -> dict:
    if not website:
        return {}
    try:
        domain = re.sub(r"https?://(www\.)?", "", website).split("/")[0]
        url = f"https://www.similarweb.com/website/{domain}/"
        headers = {"User-Agent": ua.random, "Accept-Language": "en-US,en;q=0.9"}
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            text = resp.text
            monthly_match = re.search(r'"totalVisits"\s*:\s*"?([\d.]+[KMB]?)"?', text)
            if monthly_match:
                monthly = _parse_traffic_num(monthly_match.group(1))
                return {"monthly": monthly, "weekly": monthly // 4, "daily": monthly // 30, "yearly": monthly * 12}
    except Exception as e:
        logger.warning(f"Traffic estimate failed for {website}: {e}")
    return {}


def _parse_traffic_num(val: str) -> int:
    val = str(val).strip().upper()
    for suffix, mult in {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}.items():
        if val.endswith(suffix):
            return int(float(val[:-1]) * mult)
    try:
        return int(float(val))
    except Exception:
        return 0


def detect_website_outdated(tech_hints: list, domain_age_years: float) -> bool:
    for tech in tech_hints:
        t = tech.lower()
        if any(sig in t for sig in ["jquery 1.", "jquery 2.", "flash", "legacy html", "bootstrap 2", "bootstrap 3"]):
            return True
    return bool(domain_age_years and domain_age_years > 5)


def check_duplicate(new_name: str, existing_names: list[str]) -> bool:
    new_clean = re.sub(r"[^a-z0-9]", "", new_name.lower())
    for existing in existing_names:
        existing_clean = re.sub(r"[^a-z0-9]", "", existing.lower())
        if new_clean == existing_clean:
            return True
        if len(new_clean) > 5 and (new_clean in existing_clean or existing_clean in new_clean):
            return True
    return False


def _mock_businesses(niche: str, location: str) -> list[dict]:
    return [
        {
            "source": "google",
            "google_place_id": f"mock_{i}",
            "name": f"{niche.title()} Business #{i} ({location})",
            "address": f"{100 + i} Main St, {location}",
            "google_rating": round(3.5 + (i % 3) * 0.5, 1),
            "google_review_count": 10 + i * 7,
            "website": f"https://example{i}.com",
            "phone": f"+1 (555) {100 + i:03d}-{1000 + i:04d}",
            "social_links": {},
        }
        for i in range(1, 8)
    ]
