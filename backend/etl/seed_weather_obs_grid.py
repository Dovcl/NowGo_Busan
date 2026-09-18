"""weather_obs_grid_busan.csv -> weather_obs_grid_cell 테이블 시드 스크립트.

기상청 API허브 지상관측 실황격자(전국 2049x2049) 중 부산 권역 셀의 위경도 정의 파일을
그대로 채워 넣는다. 팀에서 미리 뽑아둔 정적 참조표라 API 호출이 없고, 격자 정의 자체가
바뀌지 않는 한 재실행할 필요도 없다(fetch_weather_observation.py가 반복 실행하는
관측값 캐시와는 별개).

실행: backend/ 디렉토리에서 `python -m etl.seed_weather_obs_grid`
"""

from pathlib import Path

import pandas as pd
from geoalchemy2 import WKTElement

from db.base import Base
from db.models import WeatherObsGridCell
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_SEED_DATA_DIR = Path(__file__).resolve().parent / "seed_data"
GRID_CSV = _SEED_DATA_DIR / "weather_obs_grid_busan.csv"


def seed_weather_obs_grid(session) -> int:
    df = pd.read_csv(GRID_CSV)
    records = [
        {
            "grid_x": int(row["grid_x"]),
            "grid_y": int(row["grid_y"]),
            "geom": WKTElement(f"POINT({row['lon']} {row['lat']})", srid=4326),
        }
        for _, row in df.iterrows()
    ]
    upsert(session, WeatherObsGridCell, records, ["grid_x", "grid_y"])
    return len(records)


def main() -> None:
    Base.metadata.create_all(engine)

    session = SessionLocal()
    try:
        count = seed_weather_obs_grid(session)
        session.commit()
        print(f"weather_obs_grid_cell: {count}건 시딩 완료")
    finally:
        session.close()


if __name__ == "__main__":
    main()
