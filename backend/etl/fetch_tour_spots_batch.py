"""관광지 목록/상세(+누락 랜드마크 화이트리스트)·영어/중국어 번역을 한 번에
실행하는 진입점.

Render Cron Job은 서비스 1개당 월 최소 $1이 청구돼서(harness/DECISIONS.md
2026-09-12), free 웹서비스의 in-process 스케줄러(core/scheduler.py) 대신
쓰더라도 fetch_tour_spots.py, fetch_tour_spot_translations.py 두 스크립트를
따로 Cron Job으로 만들지 않고 이 스크립트 하나로 순서대로 돌린다 — 번역이
최신 tour_spot 기준으로 매칭돼야 해서 순서가 중요하다(fetch_environment_batch.py와
같은 이유).

실행: backend/ 디렉토리에서 `python -m etl.fetch_tour_spots_batch`
"""

from etl import fetch_tour_spot_translations, fetch_tour_spots

_JOBS = [
    ("tour_spots", fetch_tour_spots.main),
    ("tour_spot_translations", fetch_tour_spot_translations.main),
]


def main() -> None:
    failed = []
    for name, job in _JOBS:
        try:
            job()
        except Exception as e:  # noqa: BLE001 — 하나 실패해도 나머지는 계속 돌려야 함
            failed.append(name)
            print(f"[{name}] 실패: {e}")

    if failed:
        print(f"완료 (실패: {', '.join(failed)})")
    else:
        print("완료 (전체 성공)")


if __name__ == "__main__":
    main()
