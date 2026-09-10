"""cache/누적 테이블은 Alembic 없이 `Base.metadata.create_all()`만 쓰는 관례라(users 계열만
Alembic 관리), 기존 테이블에 컬럼을 추가하는 변경은 자동으로 안 실려서 직접 챙겨야 한다.

문제는 서비스마다 재배포 시점이 다르다는 것 — 웹서비스와 cron이 서로 다른 순간에 새
모델 코드를 받는데, 컬럼 추가를 cron 쪽에서만 실행하면 그 cron이 아직 한 번도 안 돈
사이에 웹서비스가 먼저 그 컬럼을 참조하는 쿼리를 날려서 "column does not exist" 에러가
난다(2026-09-02 실제로 겪음 — RoadLinkBaseline.last_sample_date 추가 직후 배포된
웹서비스가 관련 쿼리 전부 500 에러). 그래서 이 함수를 웹서비스 시작(main.py lifespan)과
cron 실행(각 ETL의 main()) 양쪽에서 다 호출해서, 어느 쪽이 먼저 재배포되든 자기가 먼저
스키마를 맞춰놓게 한다."""

from sqlalchemy import text

from db.base import Base
from db.session import engine


def ensure_schema() -> None:
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE road_link_baseline ADD COLUMN IF NOT EXISTS last_sample_date DATE"))
        # 다국어 지원(Phase C) — EngService2/ChsService2 매칭된 관광지만 채워짐(나머지는 NULL,
        # 프론트에서 한국어로 폴백). etl/fetch_tour_spot_translations.py 참고.
        conn.execute(text("ALTER TABLE tour_spot ADD COLUMN IF NOT EXISTS title_en VARCHAR"))
        conn.execute(text("ALTER TABLE tour_spot ADD COLUMN IF NOT EXISTS title_zh VARCHAR"))
        conn.execute(text("ALTER TABLE tour_spot ADD COLUMN IF NOT EXISTS addr1_en VARCHAR"))
        conn.execute(text("ALTER TABLE tour_spot ADD COLUMN IF NOT EXISTS addr1_zh VARCHAR"))
        conn.execute(text("ALTER TABLE tour_spot_intro ADD COLUMN IF NOT EXISTS overview_en TEXT"))
        conn.execute(text("ALTER TABLE tour_spot_intro ADD COLUMN IF NOT EXISTS overview_zh TEXT"))
