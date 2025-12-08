"""Background scheduler worker for executing scheduled jobs"""

import asyncio
from datetime import datetime, timezone

from config.config_init import db, logger, SCHEDULER_POLL_SECONDS
from .scheduler_execution import handle_due_scheduler_job


async def scheduler_worker():
    """Background worker that polls for and executes due scheduler jobs
    
    Runs continuously, checking every SCHEDULER_POLL_SECONDS for jobs that
    are active and have a next_run_at time in the past.
    
    Initial delay of 5 seconds allows server to fully start up.
    """
    await asyncio.sleep(5)
    while True:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            jobs = await db.scheduler_jobs.find(
                {
                    "status": "active",
                    "next_run_at": {"$ne": None, "$lte": now_iso}
                },
                {"_id": 0}
            ).to_list(20)
            for job_doc in jobs:
                await handle_due_scheduler_job(job_doc)
        except Exception as exc:
            logger.error(f"Scheduler worker error: {str(exc)}")
        await asyncio.sleep(SCHEDULER_POLL_SECONDS)
