from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey, Enum
from sqlalchemy.sql import func
from database import Base
import uuid
import enum


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    role = Column(String, default="user")  # admin | user
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


def gen_id():
    return str(uuid.uuid4())


class LeadStatus(str, enum.Enum):
    new = "new"
    researched = "researched"
    contacted = "contacted"
    replied = "replied"
    proposal = "proposal"
    won = "won"
    lost = "lost"


class Business(Base):
    __tablename__ = "businesses"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    phone = Column(String)
    emails = Column(JSON, default=list)
    website = Column(String)
    address = Column(String)
    city = Column(String)
    niche = Column(String)
    source = Column(String, default="google")  # google | yelp | manual
    google_place_id = Column(String, unique=True)
    google_rating = Column(Float)
    google_review_count = Column(Integer)
    social_links = Column(JSON, default=dict)
    is_new = Column(Boolean, default=True)
    is_analyzed = Column(Boolean, default=False)
    is_duplicate = Column(Boolean, default=False)
    status = Column(String, default=LeadStatus.new)
    found_at = Column(DateTime, server_default=func.now())
    contacted_at = Column(DateTime)
    scan_id = Column(String)


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=gen_id)
    business_id = Column(String, nullable=False)
    social_proof_score = Column(Integer)
    social_proof_breakdown = Column(JSON)
    website_age_years = Column(Float)
    website_tech_stack = Column(JSON)
    website_is_outdated = Column(Boolean)
    traffic_monthly = Column(Integer)
    traffic_weekly = Column(Integer)
    traffic_daily = Column(Integer)
    traffic_yearly = Column(Integer)
    pain_points = Column(JSON, default=list)
    opportunity_score = Column(Integer)
    lovable_prompt = Column(Text)
    email_template = Column(Text)
    dm_template = Column(Text)
    website_summary = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class OwnerContact(Base):
    __tablename__ = "owner_contacts"

    id = Column(String, primary_key=True, default=gen_id)
    business_id = Column(String, nullable=False)
    owner_name = Column(String)
    owner_title = Column(String)
    personal_phone = Column(String)
    personal_email = Column(String)
    linkedin_url = Column(String)
    facebook_url = Column(String)
    sources = Column(JSON, default=list)  # where each piece came from
    confidence = Column(String)  # high | medium | low
    raw_data = Column(JSON, default=dict)
    found_at = Column(DateTime, server_default=func.now())


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id = Column(String, primary_key=True, default=gen_id)
    business_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(String, primary_key=True, default=gen_id)
    niche = Column(String, nullable=False)
    location = Column(String, nullable=False)
    radius_km = Column(Integer, default=10)
    results_count = Column(Integer, default=0)
    searched_at = Column(DateTime, server_default=func.now())


class EmailSequence(Base):
    __tablename__ = "email_sequences"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class EmailSequenceStep(Base):
    __tablename__ = "email_sequence_steps"

    id = Column(String, primary_key=True, default=gen_id)
    sequence_id = Column(String, nullable=False)
    step_number = Column(Integer, nullable=False)
    subject_template = Column(Text)
    body_template = Column(Text)
    delay_days = Column(Integer, default=0)


class EmailSequenceEnrollment(Base):
    __tablename__ = "email_sequence_enrollments"

    id = Column(String, primary_key=True, default=gen_id)
    sequence_id = Column(String, nullable=False)
    business_id = Column(String, nullable=False)
    current_step = Column(Integer, default=0)
    status = Column(String, default="active")  # active | paused | completed | failed
    next_send_at = Column(DateTime)
    enrolled_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)


class SearchJob(Base):
    __tablename__ = "search_jobs"

    id = Column(String, primary_key=True, default=gen_id)
    niche = Column(String, nullable=False)
    location = Column(String, nullable=False)
    radius_km = Column(Integer, default=10)
    interval_minutes = Column(Integer, default=60)
    is_active = Column(Boolean, default=True)
    is_autonomous = Column(Boolean, default=False)
    last_run = Column(DateTime)
    total_found = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class WebhookConfig(Base):
    __tablename__ = "webhook_configs"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    trigger = Column(String, nullable=False)  # new_lead | analysis_complete | status_change
    is_active = Column(Boolean, default=True)
    secret = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
