import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { pool } from '../db.js'
import { HttpError } from '../httpError.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { AREAS, calculateFarePaisa, distanceBetween } from '../domain/fare.js'
import { acceptRide, openPool, transitionRide } from '../services/poolService.js'

export const ridesRouter = Router()
ridesRouter.use(requireAuth)

const rideSchema = z.object({
  pickupZone: z.enum(AREAS),
  destinationZone: z.enum(AREAS),
  seatCount: z.number().int().min(1).max(3),
})

ridesRouter.post('/', requireRole('passenger'), async (req, res) => {
  const parsed = rideSchema.safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Choose valid areas and between 1 and 3 seats.', parsed.error.issues)
  const { pickupZone, destinationZone, seatCount } = parsed.data
  const distanceKm = distanceBetween(pickupZone, destinationZone)
  if (distanceKm === null) throw new HttpError(400, 'Pickup and destination must be different areas.')

  const connection = await pool.getConnection()
  const id = randomUUID()
  const estimatedFarePaisa = calculateFarePaisa(distanceKm)
  try {
    await connection.beginTransaction()
    await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [req.user.sub])
    const [active] = await connection.execute(
      "SELECT id FROM ride_requests WHERE passenger_id = ? AND status IN ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED') LIMIT 1",
      [req.user.sub],
    )
    if (active[0]) throw new HttpError(409, 'Finish or cancel your active ride before requesting another one.')

    await connection.execute(
      'INSERT INTO ride_requests (id, passenger_id, pickup_zone, destination_zone, seat_count, distance_km, estimated_fare_paisa, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.sub, pickupZone, destinationZone, seatCount, distanceKm, estimatedFarePaisa, 'REQUESTED'],
    )
    await connection.execute(
      "INSERT INTO ride_events (ride_request_id, actor_id, from_status, to_status, note) VALUES (?, ?, NULL, 'REQUESTED', 'Ride requested by passenger.')",
      [id, req.user.sub],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  res.status(201).json({ id, pickupZone, destinationZone, seatCount, distanceKm, estimatedFarePaisa, status: 'REQUESTED' })
})

ridesRouter.post('/pool', requireRole('driver'), async (req, res) => {
  const parsed = z.object({ pickupZone: z.enum(AREAS) }).safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Choose a valid pickup area.')
  res.status(201).json(await openPool(req.user.sub, parsed.data.pickupZone))
})

ridesRouter.post('/:rideId/accept', requireRole('driver'), async (req, res) => {
  res.json(await acceptRide(req.user.sub, req.params.rideId))
})

ridesRouter.post('/:rideId/arrive', requireRole('driver'), async (req, res) => {
  res.json(await transitionRide({ rideId: req.params.rideId, actorId: req.user.sub, actorRole: 'driver', toStatus: 'DRIVER_ARRIVED' }))
})

ridesRouter.post('/:rideId/start', requireRole('driver'), async (req, res) => {
  res.json(await transitionRide({ rideId: req.params.rideId, actorId: req.user.sub, actorRole: 'driver', toStatus: 'STARTED' }))
})

ridesRouter.post('/:rideId/complete', requireRole('driver'), async (req, res) => {
  res.json(await transitionRide({ rideId: req.params.rideId, actorId: req.user.sub, actorRole: 'driver', toStatus: 'COMPLETED' }))
})

ridesRouter.post('/:rideId/cancel', requireRole('passenger'), async (req, res) => {
  res.json(await transitionRide({ rideId: req.params.rideId, actorId: req.user.sub, actorRole: 'passenger', toStatus: 'CANCELLED' }))
})

ridesRouter.get('/:rideId', async (req, res) => {
  const [rides] = await pool.execute(
    `SELECT r.id, r.passenger_id AS passengerId, r.pickup_zone AS pickupZone,
      r.destination_zone AS destinationZone, r.seat_count AS seatCount,
      r.distance_km AS distanceKm, r.estimated_fare_paisa AS estimatedFarePaisa,
      r.fare_paisa AS farePaisa, r.status, r.created_at AS createdAt,
      u.display_name AS passengerName, m.pool_id AS poolId, v.driver_id AS driverId
     FROM ride_requests r JOIN users u ON u.id = r.passenger_id
     LEFT JOIN pool_memberships m ON m.ride_request_id = r.id
     LEFT JOIN pools p ON p.id = m.pool_id
     LEFT JOIN vehicles v ON v.id = p.vehicle_id
     WHERE r.id = ? LIMIT 1`,
    [req.params.rideId],
  )
  const ride = rides[0]
  if (!ride || (req.user.role === 'passenger' ? ride.passengerId !== req.user.sub : ride.driverId !== req.user.sub)) {
    throw new HttpError(404, 'Ride not found.')
  }

  const [events] = await pool.execute(
    'SELECT e.from_status AS fromStatus, e.to_status AS toStatus, e.note, e.created_at AS createdAt, u.display_name AS actorName FROM ride_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.ride_request_id = ? ORDER BY e.created_at, e.id',
    [ride.id],
  )
  delete ride.driverId
  res.json({ ride, events })
})