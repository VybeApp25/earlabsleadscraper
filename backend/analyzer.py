import os
import json
import anthropic
from typing import Optional
import logging

logger = logging.getLogger(__name__)
client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


async def analyze_business(business: dict, website_data: dict, traffic: dict, domain_age: Optional[float]) -> dict:
    """Run full Claude-powered analysis on a business."""

    prompt = f"""You are an expert business analyst and digital marketing strategist. Analyze the following local business and return a detailed JSON analysis.

BUSINESS DATA:
- Name: {business.get('name')}
- Niche: {business.get('niche')}
- Location: {business.get('city')}
- Phone: {business.get('phone')}
- Website: {business.get('website')}
- Google Rating: {business.get('google_rating')}/5 ({business.get('google_review_count')} reviews)
- Social Links: {json.dumps(business.get('social_links', {}))}

WEBSITE DATA:
- Title: {website_data.get('title', 'N/A')}
- Domain Age: {domain_age} years
- Text Content (excerpt): {website_data.get('text_content', '')[:2000]}
- Tech/Social detected: {json.dumps(website_data.get('social_links', {}))}

TRAFFIC ESTIMATES:
- Monthly visits: {traffic.get('monthly', 'unknown')}
- Weekly: {traffic.get('weekly', 'unknown')}
- Daily: {traffic.get('daily', 'unknown')}
- Yearly: {traffic.get('yearly', 'unknown')}

Return ONLY a valid JSON object with these exact keys:
{{
  "social_proof_score": <integer 0-100>,
  "social_proof_breakdown": {{
    "google_reviews": <score 0-25>,
    "social_media_presence": <score 0-25>,
    "website_credibility": <score 0-25>,
    "overall_reputation": <score 0-25>
  }},
  "website_is_outdated": <true/false>,
  "website_tech_notes": "<brief note on tech stack / age>",
  "pain_points": ["<specific pain point 1>", "<pain point 2>", "<pain point 3>"],
  "opportunity_score": <integer 0-100>,
  "website_summary": "<2-3 sentence summary of current web presence>",
  "recommended_services": ["<service 1>", "<service 2>"]
}}"""

    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return {
            "social_proof_score": 0,
            "social_proof_breakdown": {},
            "website_is_outdated": domain_age is not None and domain_age > 5,
            "website_tech_notes": "",
            "pain_points": ["Analysis unavailable"],
            "opportunity_score": 0,
            "website_summary": "Analysis failed.",
            "recommended_services": [],
        }


async def generate_lovable_prompt(business: dict, analysis: dict, website_data: dict) -> str:
    prompt = f"""You are a web design brief writer. Create a detailed, copy-paste-ready prompt for Lovable.ai to build a modern website for this business.

BUSINESS:
- Name: {business.get('name')}
- Industry: {business.get('niche')}
- Location: {business.get('city')}
- Phone: {business.get('phone')}
- Existing website: {business.get('website') or 'None'}
- Current site summary: {analysis.get('website_summary', '')}
- Pain points: {', '.join(analysis.get('pain_points', []))}
- Website content: {website_data.get('text_content', '')[:1500]}

Write a complete Lovable.ai prompt that:
1. Specifies a modern, professional design for their industry
2. Includes their business name, phone, location, and key services
3. Requests mobile-first responsive design
4. Asks for clear CTAs (call now, book appointment, get quote)
5. Includes color palette suggestions based on their industry
6. Asks for SEO-optimized copy based on their services
7. Requests sections: Hero, Services, About, Social Proof/Reviews, Contact

Write the prompt as if you are the business owner briefing a designer. Be specific. Output ONLY the Lovable prompt, no preamble."""

    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as e:
        logger.error(f"Lovable prompt generation failed: {e}")
        return f"Create a modern, professional website for {business.get('name')}, a {business.get('niche')} business in {business.get('city')}. Include services, contact info, and mobile-responsive design."


async def generate_email_template(business: dict, analysis: dict) -> str:
    pain_points = analysis.get("pain_points", [])
    opportunity = analysis.get("opportunity_score", 50)

    prompt = f"""Write a personalized cold outreach email for this local business. Be conversational, not salesy.

BUSINESS: {business.get('name')} — {business.get('niche')} in {business.get('city')}
PAIN POINTS IDENTIFIED: {', '.join(pain_points)}
OPPORTUNITY SCORE: {opportunity}/100
WEBSITE STATUS: {'Outdated — needs redesign' if analysis.get('website_is_outdated') else 'Has a website'}
GOOGLE RATING: {business.get('google_rating')} ({business.get('google_review_count')} reviews)

Write a short (150-200 word) email that:
1. Opens with a specific observation about their business (not generic)
2. Mentions one specific pain point you noticed
3. Offers to help with website + digital presence
4. Has a soft CTA — ask for a quick 15-min call
5. Subject line included at top as "Subject: ..."
6. Signed off professionally

Output ONLY the email. No explanation."""

    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as e:
        logger.error(f"Email generation failed: {e}")
        return f"Subject: Quick question about {business.get('name')}'s online presence\n\nHi there,\n\nI came across {business.get('name')} and noticed some opportunities to improve your digital presence...\n\nWould love to chat for 15 minutes.\n\nBest,"


async def generate_dm_template(business: dict, analysis: dict) -> str:
    prompt = f"""Write a short, personalized social media DM for Instagram or Facebook to this local business owner.

BUSINESS: {business.get('name')} — {business.get('niche')} in {business.get('city')}
PAIN POINTS: {', '.join(analysis.get('pain_points', [])[:2])}
WEBSITE OUTDATED: {analysis.get('website_is_outdated', False)}

Write a DM that is:
- Casual and friendly, NOT spammy
- 3-4 sentences max
- Opens with a genuine compliment or observation
- One specific value offer
- Ends with a soft question (not "buy my service")

Output ONLY the DM message."""

    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as e:
        logger.error(f"DM generation failed: {e}")
        return f"Hey! Just discovered {business.get('name')} and love what you're doing. I help local businesses like yours get more customers online — would love to show you what's possible. Mind if I share a quick idea?"
