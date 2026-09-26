import { randomUUID } from 'node:crypto'
import { pool } from '../db.js'
import { HttpError } from '../httpError.js'
import { calculateFarePaisa, isPoolCompatible } from '../domain/fare.js'
import { canTransition, DRIVER_TRANSITIONS, PASSENGER_CANCELLABLE } from '../domain/rideLifecycle.js'

const OCCUPYING_STATUSES = ['MATCHED', 'DRIVER_ARRIVED', 'STARTED']

async function addEvent(connection, rideId, actorId, fromStatus, toStatus, note = null) {
  await connection.execute(
    'INSERT INTO ride_events (ride_request_id, actor_id, from_status, to_status, note) VALUES (?, ?, ?, ?, ?)',
    [rideId, actorId, fromStatus, toStatus, note],
  )
}

export async function openPool(driverId, pickupZone) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [vehicles] = await connection.execute(
      'SELECT id FROM vehicles WHERE driver_id = ? AND is_active = TRUE FOR UPDATE',
      [driverId],
    )
    if (!vehicles[0]) throw new HttpError(404, 'No active Tesla is assigned to this driver.')

    const [activePools] = await connection.execute(
      "SELECT id FROM pools WHERE vehicle_id = ? AND status IN ('OPEN', 'IN_PROGRESS') LIMIT 1 FOR UPDATE",
      [vehicles[0].id],
    )
    if (activePools[0]) throw new HttpError(409, 'Finish the current pool before opening another one.')

    const id = randomUUID()
    await connection.execute('INSERT INTO pools (id, vehicle_id, pickup_zone, status) VALUES (?, ?, ?, ?)', [id, vehicles[0].id, pickupZone, 'OPEN'])
    await connection.commit()
    return { id, pickupZone, status: 'OPEN' }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function acceptRide(driverId, rideId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [vehicles] = await connection.execute(
      'SELECT id, capacity FROM vehicles WHERE driver_id = ? AND is_active = TRUE FOR UPDATE',
      [driverId],
    )
    if (!vehicles[0]) throw new HttpError(404, 'No active Tesla is assigned to this driver.')

    const [rides] = await connection.execute(
      'SELECT id, passenger_id AS passengerId, pickup_zone AS pickupZone, seat_count AS seatCount, distance_km AS distanceKm, status FROM ride_requests WHERE id = ? FOR UPDATE',
      [rideId],
    )
    const ride = rides[0]
    if (!ride) throw new HttpError(404, 'Ride request not found.')
    if (ride.status !== 'REQUESTED') throw new HttpError(409, 'This request is no longer waiting for a driver.')

    const [pools] = await connection.execute(
      "SELECT id, pickup_zone AS pickupZone FROM pools WHERE vehicle_id = ? AND status = 'OPEN' ORDER BY created_at LIMIT 1 FOR UPDATE",
      [vehicles[0].id],
    )
    const activePool = pools[0]
    if (!activePool || !isPoolCompatible(ride.pickupZone, activePool.pickupZone)) {
      throw new HttpError(409, 'There is no open pool with a matching pickup zone.')
    }

    const [occupancy] = await connection.execute(
      `SELECT COALESCE(SUM(r.seat_count), 0) AS occupiedSeats
       FROM pool_memberships m JOIN ride_requests r ON r.id = m.ride_request_id
       WHERE m.pool_id = ? AND r.status IN (${OCCUPYING_STATUSES.map(() => '?').join(', ')})`,
      [activePool.id, ...OCCUPYING_STATUSES],
    )
    if (Number(occupancy[0].occupiedSeats) + ride.seatCount > vehicles[0].capacity) {
      throw new HttpError(409, 'This Tesla has no seats left for that request.')
    }

    const farePaisa = calculateFarePaisa(ride.distanceKm, true)
    await connection.execute(
      "UPDATE ride_requests SET status = 'MATCHED', fare_paisa = ? WHERE id = ? AND status = 'REQUESTED'",
      [farePaisa, rideId],
    )
    await connection.execute('INSERT INTO pool_memberships (id, pool_id, ride_request_id) VALUES (?, ?, ?)', [randomUUID(), activePool.id, rideId])
    await addEvent(connection, rideId, driverId, 'REQUESTED', 'MATCHED', 'Accepted into the shared Tesla pool.')
    await connection.commit()
    return { id: rideId, status: 'MATCHED', farePaisa, poolId: activePool.id }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function transitionRide({ rideId, actorId, actorRole, toStatus }) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rides] = await connection.execute(
      `SELECT r.id, r.passenger_id AS passengerId, r.status, m.pool_id AS poolId, v.driver_id AS driverId
       FROM ride_requests r
       LEFT JOIN pool_memberships m ON m.ride_request_id = r.id
       LEFT JOIN pools p ON p.id = m.pool_id
       LEFT JOIN vehicles v ON v.id = p.vehicle_id
       WHERE r.id = ? FOR UPDATE`,
      [rideId],
    )
    const ride = rides[0]
    if (!ride) throw new HttpError(404, 'Ride not found.')

    if (actorRole === 'passenger') {
      if (ride.passengerId !== actorId) throw new HttpError(404, 'Ride not found.')
      if (toStatus !== 'CANCELLED' || !PASSENGER_CANCELLABLE.includes(ride.status)) {
        throw new HttpError(409, 'This ride can no longer be cancelled.')
      }
    } else {
      if (ride.driverId !== actorId) throw new HttpError(404, 'Ride not found.')
      if (!canTransition(ride.status, toStatus, DRIVER_TRANSITIONS)) {
        throw new HttpError(409, `A ride in ${ride.status} cannot move to ${toStatus}.`)
      }
    }

    await connection.execute('UPDATE ride_requests SET status = ? WHERE id = ?', [toStatus, rideId])
    await addEvent(connection, rideId, actorId, ride.status, toStatus)

    if (toStatus === 'STARTED' && ride.poolId) {
      await connection.execute("UPDATE pools SET status = 'IN_PROGRESS' WHERE id = ? AND status = 'OPEN'", [ride.poolId])
    }
    if (toStatus === 'COMPLETED' && ride.poolId) {
      const [remaining] = await connection.execute(
        `SELECT COUNT(*) AS activeRides FROM pool_memberships m JOIN ride_requests r ON r.id = m.ride_request_id
         WHERE m.pool_id = ? AND r.status IN (${OCCUPYING_STATUSES.map(() => '?').join(', ')})`,
        [ride.poolId, ...OCCUPYING_STATUSES],
      )
      if (Number(remaining[0].activeRides) === 0) {
        await connection.execute("UPDATE pools SET status = 'COMPLETED' WHERE id = ?", [ride.poolId])
      }
    }

    await connection.commit()
    return { id: rideId, fromStatus: ride.status, status: toStatus }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}