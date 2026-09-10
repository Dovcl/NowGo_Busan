// SKY(하늘상태)/PTY(강수형태) 조합 -> 아이콘+textKey+색. 강수가 있으면 하늘상태보다 우선.
// Home.jsx(현재 날씨)와 PlaceDetail.jsx(24시간 예보)가 같은 매핑을 공유한다.
// textKey는 t(`weatherCondition.${textKey}`, {ns: "common"})로 라벨을 찾는 키.
export function weatherCondition(sky, precipitationType) {
  if (precipitationType === 3) return { icon: "weather_snowy", textKey: "snow", color: "text-sky-400" }
  if (precipitationType === 2) return { icon: "weather_snowy", textKey: "rainSnow", color: "text-sky-500" }
  if (precipitationType === 1 || precipitationType === 4) return { icon: "rainy", textKey: "rain", color: "text-blue-500" }
  if (sky === 1) return { icon: "sunny", textKey: "clear", color: "text-amber-500" }
  if (sky === 3) return { icon: "partly_cloudy_day", textKey: "partlyCloudy", color: "text-slate-400" }
  if (sky === 4) return { icon: "cloud", textKey: "cloudy", color: "text-slate-500" }
  return { icon: "sunny", textKey: "none", color: "text-slate-400" }
}
