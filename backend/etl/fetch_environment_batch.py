"""날씨·UV·대기질·이안류·기상특보·공휴일·기온강수관측·해수욕지수·서핑지수·바다여행지수·
NowGo Score 계산 11개 작업을 한 번에 실행하는 진입점.

Render Cron Job은 서비스 1개당 월 최소 $1이 청구돼서, 원래 갱신 주기가 다른
(날씨/UV 3시간, 대기질 1시간, 이안류 15분) 4개를 개별 Cron Job으로 만드는 대신
이 스크립트 하나를 1시간 주기로 돌린다 — 이안류만 15분보다 덜 촘촘해지지만
관측 자체가 5분 간격이라 1시간 주기로도 최신값은 그대로 반영된다.

공휴일(fetch_holidays)은 연 1~2회만 실제로 바뀌는 데이터라 별도 주기를 둘 필요가
없어서 여기 얹었다 — 이 해가 이미 캐싱돼 있으면 내부적으로 API 호출 자체를 건너뛰므로
매시간 같이 돌아도 비용이 늘지 않는다.

기상특보(fetch_weather_warning)도 같은 이유로 여기 얹었다 — 원래 무료 웹서비스의
in-process 스케줄러에서만 15분마다 돌아서 서비스가 슬립 중이면 갱신이 조용히
스킵될 위험이 있었는데(harness/DECISIONS.md 2026-09-16), 안전 관련 데이터라
개별 Cron Job(+월 $1)을 새로 파는 대신 이미 유료로 도는 이 배치에 묶어 1시간
주기로 안정적으로 보장한다. in-process 스케줄러의 15분 주기는 그대로 남겨둬
(다른 4개와 동일 패턴) 웹서비스가 깨어있을 때는 더 자주 갱신되는 보너스를 유지한다.

하나가 실패해도 나머지는 계속 실행되도록 각각 독립적으로 예외 처리한다.

`compute_nowgo_scores`는 외부 API를 안 부르고 위 캐시들만 읽어서 계산하므로 반드시
맨 마지막에 실행돼야 한다 — 그래야 그날 갱신된 최신값으로 NowGo Score를 계산한다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_environment_batch`
"""

from etl import (
    compute_nowgo_scores,
    fetch_air_quality,
    fetch_beach_index,
    fetch_holidays,
    fetch_rip_current,
    fetch_sea_trip_index,
    fetch_surf_index,
    fetch_uv,
    fetch_weather,
    fetch_weather_observation,
    fetch_weather_warning,
)

_JOBS = [
    ("weather", fetch_weather.main),
    ("weather_observation", fetch_weather_observation.main),
    ("uv", fetch_uv.main),
    ("air_quality", fetch_air_quality.main),
    ("rip_current", fetch_rip_current.main),
    ("beach_index", fetch_beach_index.main),
    ("surf_index", fetch_surf_index.main),
    ("sea_trip_index", fetch_sea_trip_index.main),
    ("weather_warning", fetch_weather_warning.main),
    ("holidays", fetch_holidays.main),
    ("nowgo_scores", compute_nowgo_scores.main),  # 항상 마지막 — 위 캐시들을 읽기만 함
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
