"""관광지 주소 -> 자외선지수 행정구역코드(areaNo) 매칭 — 팀 노트북(Data_Preprocess.ipynb)의
`find_area_no` 그대로 이식. 참조표는 노트북의 UV_place.csv 중 부산만 추린
etl/seed_data/uv_place_busan.csv(정적 데이터, 223행).

규칙(원본 동일): 주소에서 구·군(2단계)을 찾고(긴 이름부터 — "강서구" 안의 "서구" 오매칭 방지),
그 구 안에서 동(3단계) 이름이 주소에 있으면 그 동 코드, 없으면 구 대표 코드. 구·군을
못 찾으면 None(원본은 NaN)."""

import csv
from functools import lru_cache
from pathlib import Path

_CSV = Path(__file__).resolve().parents[2] / "etl" / "seed_data" / "uv_place_busan.csv"


@lru_cache(maxsize=1)
def _load() -> tuple[list[str], dict[str, list[tuple[str, str]]]]:
    """(긴 이름순 구·군 목록, {구·군: [(동, area_no)]}) — 동이 빈 행이 그 구 대표 코드."""
    by_district: dict[str, list[tuple[str, str]]] = {}
    with open(_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if not row["district"]:  # 부산 전체 행(2600000000)은 매칭 대상 아님
                continue
            by_district.setdefault(row["district"], []).append((row["town"], row["area_no"]))
    districts = sorted(by_district, key=len, reverse=True)
    return districts, by_district


def find_area_no(address: str | None) -> str | None:
    if not address:
        return None
    districts, by_district = _load()
    matched = next((d for d in districts if d in address), None)
    if matched is None:
        return None

    rows = by_district[matched]
    # 동(3단계) 우선 — 긴 동 이름부터, 코드가 정확히 1개일 때만 채택(원본 동일)
    towns = sorted({t for t, _ in rows if t}, key=len, reverse=True)
    for town in towns:
        if town in address:
            codes = {code for t, code in rows if t == town}
            if len(codes) == 1:
                return codes.pop()

    district_codes = {code for t, code in rows if not t}
    return district_codes.pop() if len(district_codes) == 1 else None
