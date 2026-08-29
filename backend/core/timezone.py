"""KST(Asia/Seoul, UTC+9) 헬퍼.

Render 컨테이너의 시스템 시간대는 UTC인데(로컬 개발 맥은 보통 KST), 기상청 API의
base_date/base_time·자외선지수 time 파라미터는 KST 기준이다. naive datetime.now()를
그대로 쓰면 배포 환경에서 9시간 밀린 발표분을 요청하게 된다 — "지금 몇 시 KST인지"가
필요한 곳은 전부 이 모듈을 거쳐야 한다.
"""

from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """실행 중인 머신의 시스템 시간대와 무관하게 항상 정확한 현재 KST 시각을 돌려준다."""
    return datetime.now(timezone.utc).astimezone(KST)
