import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

export const dashboardRouter = Router()

dashboardRouter.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'passenger') {
    const [rides] = await pool.execute(
      `SELECT r.id, r.pickup_zone AS pickupZone, r.destination_zone AS destinationZone,
        r.seat_count AS seatCount, r.distance_km AS distanceKm,
        r.estimated_fare_paisa AS estimatedFarePaisa, r.fare_paisa AS farePaisa,
        r.status, r.created_at AS createdAt, (SELECT MAX(e.created_at) FROM ride_events e WHERE e.ride_request_id = r.id AND e.to_status = 'STARTED') AS startedAt, p.status AS poolStatus, 
        v.label AS vehicleLabel, d.display_name AS driverName
       FROM ride_requests r
       LEFT JOIN pool_memberships m ON m.ride_request_id = r.id
       LEFT JOIN pools p ON p.id = m.pool_id
       LEFT JOIN vehicles v ON v.id = p.vehicle_id
       LEFT JOIN users d ON d.id = v.driver_id
       WHERE r.passenger_id = ? ORDER BY r.created_at DESC`,
      [req.user.sub],
    )
    return res.json({ role: 'passenger', rides })
  }

  const [vehicles] = await pool.execute(
    'SELECT id, label, plate_number AS plateNumber, capacity FROM vehicles WHERE driver_id = ? AND is_active = TRUE LIMIT 1',
    [req.user.sub],
  )
  const vehicle = vehicles[0] || null
  if (!vehicle) return res.json({ role: 'driver', vehicle: null, pool: null, rides: [] })

  const [pools] = await pool.execute(
    "SELECT id, pickup_zone AS pickupZone, status, created_at AS createdAt FROM pools WHERE vehicle_id = ? AND status IN ('OPEN', 'IN_PROGRESS') ORDER BY created_at DESC LIMIT 1",
    [vehicle.id],
  )
  const activePool = pools[0] || null
  let rides
  let occupiedSeats = 0

  if (activePool) {
    const [rows] = await pool.execute(
      `SELECT r.id, r.passenger_id AS passengerId, u.display_name AS passengerName,
        r.pickup_zone AS pickupZone, r.destination_zone AS destinationZone,
        r.seat_count AS seatCount, r.distance_km AS distanceKm,
        r.estimated_fare_paisa AS estimatedFarePaisa, r.fare_paisa AS farePaisa,
        r.status, r.created_at AS createdAt, (SELECT MAX(e.created_at) FROM ride_events e WHERE e.ride_request_id = r.id AND e.to_status = 'STARTED') AS startedAt, m.pool_id AS poolId
       FROM ride_requests r
       LEFT JOIN pool_memberships m ON m.ride_request_id = r.id
       LEFT JOIN users u ON u.id = r.passenger_id
       WHERE (r.status = 'REQUESTED' AND r.pickup_zone = ?)
         OR (m.pool_id = ? AND r.status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED'))
       ORDER BY FIELD(r.status, 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'REQUESTED'), r.created_at`,
      [activePool.pickupZone, activePool.id],
    )
    rides = rows
    const [occupancy] = await pool.execute(
      `SELECT COALESCE(SUM(r.seat_count), 0) AS occupiedSeats
       FROM pool_memberships m JOIN ride_requests r ON r.id = m.ride_request_id
       WHERE m.pool_id = ? AND r.status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED')`,
      [activePool.id],
    )
    occupiedSeats = Number(occupancy[0].occupiedSeats)
  } else {
    const [requests] = await pool.execute(
      "SELECT r.id, r.passenger_id AS passengerId, u.display_name AS passengerName, r.pickup_zone AS pickupZone, r.destination_zone AS destinationZone, r.seat_count AS seatCount, r.distance_km AS distanceKm, r.estimated_fare_paisa AS estimatedFarePaisa, r.status, r.created_at AS createdAt FROM ride_requests r JOIN users u ON u.id = r.passenger_id WHERE r.status = 'REQUESTED' ORDER BY r.created_at",
    )
    rides = requests
  }

  res.json({
    role: 'driver',
    vehicle,
    pool: activePool ? { ...activePool, occupiedSeats, availableSeats: Math.max(0, vehicle.capacity - occupiedSeats) } : null,
    rides,
  })
})