// Marker/legend styling by tourist-spot category (place.mapGroup) — NOT by
// NowGo Score safety status. The score algorithm isn't built yet, so map
// pins must not imply a green/yellow/red safety signal that doesn't exist.
// labelKey는 t(`envGroupLabel.${labelKey}`, {ns: "map"})로 라벨을 찾는 키.
export const ENV_GROUP_STYLE = {
  해변: { labelKey: "해변", color: "#3B82F6", icon: "waves" },
  산: { labelKey: "산", color: "#10B981", icon: "park" },
  도심: { labelKey: "도심", color: "#F59E0B", icon: "museum" },
  실내: { labelKey: "실내", color: "#6B7280", icon: "storefront" },
  // 음식점(mapGroup, cat1=A05)만 "실내"에서 따로 빼서 별도 아이콘/색으로 표시
  음식점: { labelKey: "음식점", color: "#8B5CF6", icon: "restaurant" },
}

export const DEFAULT_ENV_GROUP_STYLE = { labelKey: "기타", color: "#6B7280", icon: "place" }
