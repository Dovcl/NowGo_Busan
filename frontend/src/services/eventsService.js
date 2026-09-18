// 축제·행사 데이터 계층. backend/db/models.py의 Event(canonical, harness/DECISIONS.md
// Phase 0~3)가 이미 실제로 동작해서, scoreService.js(MOCK_MODE 분기)가 아니라
// placesService.js처럼 항상 실제 백엔드를 호출한다.
// announcements(공지 배너)는 아직 백엔드에 대응하는 소스가 없어 mock 그대로.
import { announcements } from "../mock/events"
import { secureImageUrl } from "../lib/image"

// 운영 빌드에서 값이 없으면 같은 도메인(프론트 Redirects/Rewrites가 백엔드로 프록시)으로 보낸다.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:8080" : "")

// 백엔드 Event(id/start_date/end_date/venue/lat/lng/...)를 프론트가 쓰는 모양
// (id/startDate/endDate/location/...)으로 옮긴다. tags는 아직 백엔드에 없어서 빈 값.
// "놓치면 아쉬운 행사"는 백엔드에 큐레이션 신호가 없어서 noteworthy 필드 대신
// Recommend.jsx가 "임박한 축제 상위 3개" 휴리스틱으로 직접 뽑는다.
function adaptEvent(e) {
  return {
    id: String(e.id),
    title: e.title,
    category: e.category ?? "festival",
    startDate: e.start_date,
    endDate: e.end_date ?? e.start_date,
    location: e.venue || e.address || "",
    tags: [],
    image: secureImageUrl(e.image_url),
  }
}

export async function fetchEvents() {
  const res = await fetch(`${API_BASE_URL}/api/events`)
  if (!res.ok) throw new Error(`fetchEvents failed: ${res.status}`)
  const data = await res.json()
  return data.map(adaptEvent)
}

// 상세 모달용 — venue/address를 따로 유지하고(카드에서만 합쳐 보여줌), KOPIS처럼
// 원본 소스에 공개 상세 페이지가 있으면 그 링크도 같이 준다.
export async function fetchEventById(id) {
  const res = await fetch(`${API_BASE_URL}/api/events/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`fetchEventById failed: ${res.status}`)
  const e = await res.json()
  return {
    id: String(e.id),
    title: e.title,
    category: e.category ?? "festival",
    startDate: e.start_date,
    endDate: e.end_date ?? e.start_date,
    venue: e.venue,
    address: e.address,
    image: secureImageUrl(e.image_url),
    // [{source: 'dabom'|'kopis'|'tourapi', url}] — 병합된 행사는 소스가 여러 개일 수 있어
    // EventDetailModal이 어느 사이트로 가는 링크인지 라벨로 구분해 보여준다.
    sourceUrls: (e.source_urls ?? []).map((s) => ({ source: s.source, url: s.url })),
  }
}

export async function fetchAnnouncements() {
  return announcements
}
