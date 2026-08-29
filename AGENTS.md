# AGENTS.md — NowGo Busan (지금갈래? 부산)

Follow the NowGo Busan project harness.

Primary files:
- `harness/MAIN_HARNESS.md`
- `harness/ROUTING.md`
- `harness/DECISIONS.md` (진행 상황·결정 로그 — 항상 최신 상태로 이어서 볼 것)

Role files:
- `harness/agents/domain-expert.md`
- `harness/agents/ui-designer.md`
- `harness/agents/api-connector.md`
- `harness/agents/ml-engineer.md`

Check files:
- `harness/checks/security-check.md`
- `harness/checks/api-quota-check.md`

Skill files:
- `harness/skills/design-skill.md`
- `harness/skills/score-algorithm.md`

Hard reminders:
- Work only inside `frontend/` for React PWA UI tasks.
- Do not modify `backend/` unless explicitly requested.
- Never expose API keys. KAKAO_JS_API_KEY는 프론트엔드용이나 도메인 제한 필수.
- NowGo Score 알고리즘(`/api/score` 응답 스키마)을 임의로 변경하지 않는다.
- PostGIS 공간 쿼리는 반드시 `backend/db/` 내에서만 작성한다.
- Mock 모드(MOCK_MODE=true)와 실제 API 호출을 항상 구분해서 개발한다.
- Explain the reason before suggesting code.
- 코드는 항상 간결하게 — 불필요하게 장황한 코드 금지. 기존 코드 수정 시 최소 범위로만 고친다.
- 코드 작성 원칙: KISS(단순하고 직관적으로, 과도한 엔지니어링 금지) / YAGNI(지금 필요한 것만, 불확실한 기능 미리 만들지 않기) / SOLID(특히 단일 책임 원칙 — 함수·모듈 하나가 한 가지만 하도록). 로직마다 무엇을 하는지 알기 쉬운 주석을 짧게 단다.
