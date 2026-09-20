// 이안류를 관측하는 부산 해수욕장 3곳(백엔드 fetch_rip_current.py와 동일).
// 백엔드는 해변 1.5km 안 좌표에만 이안류 값을 주므로, 각 해변 고정 좌표로 조회한다.
export const RIP_BEACHES = [
  { key: "haeundae", lat: 35.1587, lng: 129.1604 },
  { key: "songjeong", lat: 35.1789, lng: 129.1996 },
  { key: "imrang", lat: 35.3196, lng: 129.2646 },
]
