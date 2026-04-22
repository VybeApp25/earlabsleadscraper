import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()
_job_registry: dict[str, str] = {}  # job_id -> apscheduler job id


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()


async def add_search_job(job_id: str, niche: str, location: str, radius_km: int, interval_minutes: int, db_session_factory):
    from pipeline import run_search_pipeline

    async def _run():
        async with db_session_factory() as db:
            await run_search_pipeline(db, niche, location, radius_km, job_id=job_id, autonomous=True)

    if job_id in _job_registry:
        try:
            scheduler.remove_job(_job_registry[job_id])
        except Exception:
            pass

    apjob = scheduler.add_job(
        _run,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id=f"search_{job_id}",
        replace_existing=True,
        next_run_time=datetime.now(),
    )
    _job_registry[job_id] = apjob.id
    logger.info(f"Scheduled job {job_id} every {interval_minutes}m")


def remove_search_job(job_id: str):
    apjob_id = _job_registry.pop(job_id, None)
    if apjob_id:
        try:
            scheduler.remove_job(apjob_id)
        except Exception:
            pass
