"""백그라운드 배치 작업 스케줄러.

FastAPI lifespan으로 백엔드 시작 시 자동 활성화됨.
"""

import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
_scheduler = None


def _run_fetch_weather():
    """날씨 배치 작업 (1시간마다)."""
    try:
        from etl.fetch_weather import main as fetch_weather_main
        fetch_weather_main()
        logger.info(f"✓ fetch_weather completed at {datetime.now().isoformat()}")
    except Exception as e:
        logger.error(f"✗ fetch_weather failed: {e}", exc_info=True)


def start_scheduler():
    """백그라운드 스케줄러 시작."""
    global _scheduler
    if _scheduler is not None:
        logger.warning("Scheduler is already running")
        return

    _scheduler = BackgroundScheduler()
    # 매시간 정각(0분)에 실행
    _scheduler.add_job(_run_fetch_weather, 'cron', hour='*', minute='0')
    _scheduler.start()
    logger.info("✓ Scheduler started (fetch_weather every hour at :00)")


def stop_scheduler():
    """백그라운드 스케줄러 종료."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown()
        _scheduler = None
        logger.info("✓ Scheduler stopped")
