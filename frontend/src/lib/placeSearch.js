// 이름(0) 또는 카테고리(1) 매칭만 결과로 인정한다. 주소는 검색 대상에서 제외 —
// 부산 주소 체계상 "해운대" 같은 지명이 구 이름으로 거의 모든 곳 주소에 박혀있어서,
// 주소까지 매칭하면 검색어와 무관한 곳(그 구에 있을 뿐인 식당 등)까지 대량으로 끼어든다.
export function matchRank(place, query) {
  if (place.name.toLowerCase().includes(query)) return 0
  if ((place.category ?? "").toLowerCase().includes(query)) return 1
  return null
}
