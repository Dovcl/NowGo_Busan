// Data-access layer for NowGo Score data.
//
// Backend isn't ready yet, so every function here reads from src/mock/places.js.
// Once `/api/score` exists, only the branches below need to change — page
// components should keep calling these same functions.
import {
  topPlaces,
  currentWeather,
  airQuality,
  uvIndex,
  ripCurrentRisk,
  crowdLevel,
  mapMarkers,
  districts,
  pulseDashboard,
} from "../mock/places"

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE !== "false"

export async function fetchTopPlaces() {
  if (MOCK_MODE) return topPlaces
  const res = await fetch("/api/score/top")
  return res.json()
}

export async function fetchPlaceById(id) {
  if (MOCK_MODE) return topPlaces.find((p) => p.id === id) ?? null
  const res = await fetch(`/api/score/${id}`)
  return res.json()
}

export async function fetchHomeSummary() {
  if (MOCK_MODE) return { currentWeather, airQuality, uvIndex, ripCurrentRisk, crowdLevel }
  const res = await fetch("/api/score/summary")
  return res.json()
}

export async function fetchMapMarkers() {
  if (MOCK_MODE) return mapMarkers
  const res = await fetch("/api/score/map")
  return res.json()
}

export async function fetchDistricts() {
  if (MOCK_MODE) return districts
  const res = await fetch("/api/districts")
  return res.json()
}

export async function fetchPulseDashboard(district) {
  if (MOCK_MODE) return pulseDashboard[district] ?? pulseDashboard["수영구"]
  const res = await fetch(`/api/pulse/${encodeURIComponent(district)}`)
  return res.json()
}
