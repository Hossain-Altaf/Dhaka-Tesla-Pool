export const SIM_MINUTES_PER_KM = 1

export function tripProgress(ride, now = Date.now()) {
  if (!ride || ride.status !== 'STARTED' || !ride.startedAt) return null
  const startedMs = new Date(ride.startedAt).getTime()
  const distanceKm = Number(ride.distanceKm)
  if (Number.isNaN(startedMs) || !(distanceKm > 0)) return null

  const totalMs = distanceKm * SIM_MINUTES_PER_KM * 60000
  const elapsedMs = Math.min(totalMs, Math.max(0, now - startedMs))
  const ratio = elapsedMs / totalMs
  return {
    percent: Math.round(ratio * 100),
    coveredKm: Number((distanceKm * ratio).toFixed(1)),
    leftKm: Number((distanceKm * (1 - ratio)).toFixed(1)),
    minutesLeft: Math.ceil((totalMs - elapsedMs) / 60000),
    arriving: ratio >= 1,
  }
}