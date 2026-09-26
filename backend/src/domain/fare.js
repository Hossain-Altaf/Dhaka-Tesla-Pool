export const AREAS = [
  'Banani',
  'Mohakhali',
  'Gulshan 1',
  'Dhanmondi',
  'Mirpur',
  'Uttara',
  'Farmgate',
  'Bashundhara',
]

const GRID = {
  Banani: [0, 0],
  Mohakhali: [3, 0],
  'Gulshan 1': [3, 2],
  Dhanmondi: [-4, 0],
  Mirpur: [-2, 5],
  Uttara: [3, 10],
  Farmgate: [-2, 2],
  Bashundhara: [6, 3],
}

export const FARE = {
  basePaisa: 2500,
  perKmPaisa: 1200,
  poolDiscountBasisPoints: 2000,
}

export function distanceBetween(pickup, destination) {
  const from = GRID[pickup]
  const to = GRID[destination]
  if (!from || !to || pickup === destination) return null
  return Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1])
}

export function calculateFarePaisa(distanceKm, pooled = false) {
  const subtotal = FARE.basePaisa + distanceKm * FARE.perKmPaisa
  if (!pooled) return subtotal
  return Math.round(subtotal * (10000 - FARE.poolDiscountBasisPoints) / 10000)
}

export function isPoolCompatible(requestPickup, poolPickup) {
  return requestPickup === poolPickup
}