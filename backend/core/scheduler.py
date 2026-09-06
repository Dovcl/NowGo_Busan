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


def _run_fetch_uv():
    """자외선 배치 작업 (3시간마다, 로컬 launchd와 동일 주기)."""
    try:
        from etl.fetch_uv import main as fetch_uv_main
        fetch_uv_main()
        logger.info(f"✓ fetch_uv completed at {datetime.now().isoformat()}")
    except Exception as e:
        logger.error(f"✗ fetch_uv failed: {e}", exc_info=True)


def _run_fetch_air_quality():
    """대기질 배치 작업 (1시간마다, 로컬 launchd와 동일 주기)."""
    try:
        from etl.fetch_air_quality import main as fetch_air_quality_main
        fetch_air_quality_main()
        logger.info(f"✓ fetch_air_quality completed at {datetime.now().isoformat()}")
    except Exception as e:
        logger.error(f"✗ fetch_air_quality failed: {e}", exc_info=True)


def _run_fetch_rip_current():
    """이안류 배치 작업 (15분마다, 로컬 launchd와 동일 주기). 비시즌(6~9월 외)엔
    원본 API가 빈 응답을 주고 fetch_rip_current.py가 이를 조용히 스킵한다."""
    try:
        from etl.fetch_rip_current import main as fetch_rip_current_main
        fetch_rip_current_main()
        logger.info(f"✓ fetch_rip_current completed at {datetime.now().isoformat()}")
    except Exception as e:
        logger.error(f"✗ fetch_rip_current failed: {e}", exc_info=True)


def _run_fetch_weather_warning():
    """기상특보 배치 작업 (15분마다, 안전 관련이라 날씨보다 촘촘히)."""
    try:
        from etl.fetch_weather_warning import main as fetch_weather_warning_main
        fetch_weather_warning_main()
        logger.info(f"✓ fetch_weather_warning completed at {datetime.now().isoformat()}")
    except Exception as e:
        logger.error(f"✗ fetch_weather_warning failed: {e}", exc_info=True)


def start_scheduler():
    """백그라운드 스케줄러 시작."""
    global _scheduler
    if _scheduler is not None:
        logger.warning("Scheduler is already running")
        return

    _scheduler = BackgroundScheduler()
    # 매시간 정각(0분)에 실행
    _scheduler.add_job(_run_fetch_weather, 'cron', hour='*', minute='0')
    # 3시간마다(0/3/6/9/12/15/18/21시)
    _scheduler.add_job(_run_fetch_uv, 'cron', hour='*/3', minute='5')
    # 매시간
    _scheduler.add_job(_run_fetch_air_quality, 'cron', hour='*', minute='10')
    # 15분마다
    _scheduler.add_job(_run_fetch_rip_current, 'cron', minute='*/15')
    # 15분마다
    _scheduler.add_job(_run_fetch_weather_warning, 'cron', minute='*/15')
    _scheduler.start()
    logger.info(
        "✓ Scheduler started (weather hourly, UV 3h, air quality hourly, rip current 15min, weather warning 15min)"
    )


def stop_scheduler():
    """백그라운드 스케줄러 종료."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown()
        _scheduler = None
        logger.info("✓ Scheduler stopped")
