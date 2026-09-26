import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

test('concurrent acceptance never reserves more seats than the Tesla has', {
  skip: process.env.RUN_DB_TESTS !== '1',
}, async () => {
  const [{ pool: db }, { migrate }, { acceptRide, transitionRide }] = await Promise.all([
    import('../src/db.js'),
    import('../src/migrate.js'),
    import('../src/services/poolService.js'),
  ])
  await migrate()
  const driverId = randomUUID()
  const passengerIds = [randomUUID(), randomUUID()]
  const vehicleId = randomUUID()
  const poolId = randomUUID()
  const rideIds = [randomUUID(), randomUUID()]
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    await connection.execute(
      "INSERT INTO users (id, display_name, email, password_hash, role) VALUES (?, 'Capacity Test Driver', ?, 'test-only', 'driver')",
      [driverId, `${driverId}@example.test`],
    )
    for (const [index, passengerId] of passengerIds.entries()) {
      await connection.execute(
        "INSERT INTO users (id, display_name, email, password_hash, role) VALUES (?, ?, ?, 'test-only', 'passenger')",
        [passengerId, `Capacity Passenger ${index + 1}`, `${passengerId}@example.test`],
      )
    }
    await connection.execute(
      'INSERT INTO vehicles (id, driver_id, label, plate_number, capacity) VALUES (?, ?, ?, ?, 1)',
      [vehicleId, driverId, 'Capacity Test Tesla', `TEST-${vehicleId.slice(0, 8)}`],
    )
    await connection.execute(
      "INSERT INTO pools (id, vehicle_id, pickup_zone, status) VALUES (?, ?, 'Banani', 'OPEN')",
      [poolId, vehicleId],
    )
    for (const [index, rideId] of rideIds.entries()) {
      await connection.execute(
        "INSERT INTO ride_requests (id, passenger_id, pickup_zone, destination_zone, seat_count, distance_km, estimated_fare_paisa, status) VALUES (?, ?, 'Banani', ?, 1, 3, 6100, 'REQUESTED')",
        [rideId, passengerIds[index], index === 0 ? 'Mohakhali' : 'Gulshan 1'],
      )
    }
    await connection.commit()

    const results = await Promise.allSettled(rideIds.map((rideId) => acceptRide(driverId, rideId)))
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const rejected = results.find((result) => result.status === 'rejected')
    assert.equal(rejected.reason.status, 409)
    const winningIndex = results.findIndex((result) => result.status === 'fulfilled')
    const winningRideId = rideIds[winningIndex]

    await assert.rejects(
      transitionRide({
        rideId: winningRideId,
        actorId: passengerIds[1 - winningIndex],
        actorRole: 'passenger',
        toStatus: 'CANCELLED',
      }),
      (error) => error.status === 404,
    )
    const [unchangedRide] = await db.execute('SELECT status FROM ride_requests WHERE id = ?', [winningRideId])
    assert.equal(unchangedRide[0].status, 'MATCHED')

    const [occupancy] = await db.execute(
      "SELECT COALESCE(SUM(r.seat_count), 0) AS occupied FROM pool_memberships m JOIN ride_requests r ON r.id = m.ride_request_id WHERE m.pool_id = ? AND r.status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED')",
      [poolId],
    )
    assert.equal(Number(occupancy[0].occupied), 1)
  } finally {
    await connection.beginTransaction()
    await connection.execute('DELETE FROM ride_events WHERE ride_request_id IN (?, ?)', rideIds)
    await connection.execute('DELETE FROM pool_memberships WHERE ride_request_id IN (?, ?)', rideIds)
    await connection.execute('DELETE FROM ride_requests WHERE id IN (?, ?)', rideIds)
    await connection.execute('DELETE FROM pools WHERE id = ?', [poolId])
    await connection.execute('DELETE FROM vehicles WHERE id = ?', [vehicleId])
    await connection.execute('DELETE FROM users WHERE id IN (?, ?, ?)', [driverId, ...passengerIds])
    await connection.commit()
    connection.release()
    await db.end()
  }
})