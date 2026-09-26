import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from './db.js'
import { calculateFarePaisa, distanceBetween } from './domain/fare.js'

const DEMO_PASSWORD = 'TeslaPool@2026'

async function ensureUser(connection, displayName, email, role) {
  const [rows] = await connection.execute('SELECT id FROM users WHERE email = ?', [email])
  if (rows[0]) return rows[0].id

  const id = randomUUID()
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  await connection.execute(
    'INSERT INTO users (id, display_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [id, displayName, email, passwordHash, role],
  )
  return id
}

export async function seed() {
  const connection = await pool.getConnection()
  try {
    const jashimId = await ensureUser(connection, 'Jashim', 'jashim@teslapool.bd', 'driver')
    const nusratId = await ensureUser(connection, 'Nusrat', 'nusrat@teslapool.bd', 'passenger')
    const rafiqId = await ensureUser(connection, 'Rafiq', 'rafiq@teslapool.bd', 'passenger')
    await ensureUser(connection, 'Shirin', 'shirin@teslapool.bd', 'passenger')

    const [vehicles] = await connection.execute('SELECT id FROM vehicles WHERE driver_id = ? LIMIT 1', [jashimId])
    const vehicleId = vehicles[0]?.id || randomUUID()
    if (!vehicles[0]) {
      await connection.execute(
        'INSERT INTO vehicles (id, driver_id, label, plate_number, capacity) VALUES (?, ?, ?, ?, ?)',
        [vehicleId, jashimId, 'Bullet · Tesla Model 3', 'DHK-TES-01', 3],
      )
    }

    const [pools] = await connection.execute(
      "SELECT id FROM pools WHERE vehicle_id = ? AND status IN ('OPEN', 'IN_PROGRESS') LIMIT 1",
      [vehicleId],
    )
    const poolId = pools[0]?.id || randomUUID()
    if (!pools[0]) {
      await connection.execute('INSERT INTO pools (id, vehicle_id, pickup_zone, status) VALUES (?, ?, ?, ?)', [poolId, vehicleId, 'Banani', 'OPEN'])
    }

    for (const passenger of [
      { id: nusratId, name: 'Nusrat', destination: 'Mohakhali' },
      { id: rafiqId, name: 'Rafiq', destination: 'Gulshan 1' },
    ]) {
      const [existing] = await connection.execute(
        "SELECT r.id FROM pool_memberships m JOIN ride_requests r ON r.id = m.ride_request_id WHERE m.pool_id = ? AND r.passenger_id = ? AND r.status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED') LIMIT 1",
        [poolId, passenger.id],
      )
      if (existing[0]) continue

      const id = randomUUID()
      const km = distanceBetween('Banani', passenger.destination)
      await connection.execute(
        'INSERT INTO ride_requests (id, passenger_id, pickup_zone, destination_zone, seat_count, distance_km, estimated_fare_paisa, fare_paisa, status) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)',
        [id, passenger.id, 'Banani', passenger.destination, km, calculateFarePaisa(km), calculateFarePaisa(km, true), 'MATCHED'],
      )
      await connection.execute('INSERT INTO pool_memberships (id, pool_id, ride_request_id) VALUES (?, ?, ?)', [randomUUID(), poolId, id])
      await connection.execute(
        'INSERT INTO ride_events (ride_request_id, actor_id, from_status, to_status, note) VALUES (?, ?, ?, ?, ?)',
        [id, jashimId, 'REQUESTED', 'MATCHED', `${passenger.name} joined Jashim's Banani pool.`],
      )
    }
  } finally {
    connection.release()
  }
}