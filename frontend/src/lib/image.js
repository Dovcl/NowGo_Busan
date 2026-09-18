// TourAPI/KOPIS 등 소스가 http:// 이미지 URL을 주는 경우가 있어 https 페이지에서
// 혼합 콘텐츠가 됨 — https로 승격(대상 호스트들은 https도 지원 확인됨).
export function secureImageUrl(url) {
  return url?.startsWith("http://") ? url.replace("http://", "https://") : url
}
