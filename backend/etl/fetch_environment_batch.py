"""날씨·UV·대기질·이안류 4개 ETL을 한 번에 실행하는 진입점.

Render Cron Job은 서비스 1개당 월 최소 $1이 청구돼서, 원래 갱신 주기가 다른
(날씨/UV 3시간, 대기질 1시간, 이안류 15분) 4개를 개별 Cron Job으로 만드는 대신
이 스크립트 하나를 1시간 주기로 돌린다 — 이안류만 15분보다 덜 촘촘해지지만
관측 자체가 5분 간격이라 1시간 주기로도 최신값은 그대로 반영된다.

하나가 실패해도 나머지는 계속 실행되도록 각각 독립적으로 예외 처리한다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_environment_batch`
"""

from etl import fetch_air_quality, fetch_rip_current, fetch_uv, fetch_weather

_JOBS = [
    ("weather", fetch_weather.main),
    ("uv", fetch_uv.main),
    ("air_quality", fetch_air_quality.main),
    ("rip_current", fetch_rip_current.main),
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
