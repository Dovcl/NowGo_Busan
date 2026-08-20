// 구글 지도 "목록에 저장" 기능의 데이터 계층. 세션이 httpOnly 쿠키라 매 요청에
// credentials: 'include'가 필요하다 (authService.js와 같은 패턴).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

function adaptList(list) {
  return {
    id: list.id,
    name: list.name,
    isDefault: list.is_default,
    itemCount: list.item_count,
    contains: list.contains,
  }
}

// contentid를 넘기면 각 리스트에 그 장소가 이미 담겼는지(contains)도 같이 온다.
export async function fetchMyLists(contentid) {
  const query = contentid != null ? `?contentid=${contentid}` : ""
  const res = await fetch(`${API_BASE_URL}/api/lists${query}`, { credentials: "include" })
  if (!res.ok) throw new Error(`fetchMyLists failed: ${res.status}`)
  return (await res.json()).map(adaptList)
}

export async function fetchListItems(listId) {
  const res = await fetch(`${API_BASE_URL}/api/lists/${listId}/items`, { credentials: "include" })
  if (!res.ok) throw new Error(`fetchListItems failed: ${res.status}`)
  return res.json()
}

export async function createList(name) {
  const res = await fetch(`${API_BASE_URL}/api/lists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`createList failed: ${res.status}`)
  return adaptList(await res.json())
}

export async function addToList(listId, contentid) {
  const res = await fetch(`${API_BASE_URL}/api/lists/${listId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ contentid }),
  })
  if (!res.ok) throw new Error(`addToList failed: ${res.status}`)
}

export async function removeFromList(listId, contentid) {
  const res = await fetch(`${API_BASE_URL}/api/lists/${listId}/items/${contentid}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!res.ok) throw new Error(`removeFromList failed: ${res.status}`)
}

// contentids: 원하는 순서 그대로 담긴 배열 (리스트에 있는 항목 전체와 일치해야 함)
export async function reorderList(listId, contentids) {
  const res = await fetch(`${API_BASE_URL}/api/lists/${listId}/items/order`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ contentids }),
  })
  if (!res.ok) throw new Error(`reorderList failed: ${res.status}`)
}
