import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { pool } from '../db.js'
import { config } from '../config.js'
import { HttpError } from '../httpError.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const credentialsSchema = z.object({
  email: z.email().max(190),
  password: z.string().min(8).max(100),
})

const registrationSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(100),
  role: z.enum(['passenger', 'driver']),
  vehicle: z.object({
    label: z.string().trim().min(2).max(80),
    plateNumber: z.string().trim().min(2).max(24).transform((value) => value.toUpperCase()),
    capacity: z.number().int().min(1).max(8),
  }).optional(),
}).superRefine((value, context) => {
  if (value.role === 'driver' && !value.vehicle) {
    context.addIssue({ code: 'custom', path: ['vehicle'], message: 'Vehicle details are required for driver accounts.' })
  }
})

function publicUser(user) {
  return { id: user.id, displayName: user.display_name, email: user.email, role: user.role }
}

authRouter.post('/login', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email and password of at least 8 characters.', parsed.error.issues)

  const [users] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [parsed.data.email.toLowerCase()])
  const user = users[0]
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    throw new HttpError(401, 'Email or password is incorrect.')
  }

  const token = jwt.sign({ sub: user.id, role: user.role, name: user.display_name }, config.jwtSecret, { expiresIn: '8h' })
  res.json({ token, user: publicUser(user) })
})

authRouter.post('/register', async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Check your name, email, password, and account details.', parsed.error.issues)

  const email = parsed.data.email.toLowerCase()
  const id = randomUUID()
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      'INSERT INTO users (id, display_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [id, parsed.data.displayName, email, passwordHash, parsed.data.role],
    )
    if (parsed.data.role === 'driver') {
      await connection.execute(
        'INSERT INTO vehicles (id, driver_id, label, plate_number, capacity) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), id, parsed.data.vehicle.label, parsed.data.vehicle.plateNumber, parsed.data.vehicle.capacity],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    if (error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'That email or vehicle plate is already registered.')
    }
    throw error
  } finally {
    connection.release()
  }

  const user = { id, display_name: parsed.data.displayName, email, role: parsed.data.role }
  const token = jwt.sign({ sub: id, role: user.role, name: user.display_name }, config.jwtSecret, { expiresIn: '8h' })
  res.status(201).json({ token, user: publicUser(user) })
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const [users] = await pool.execute('SELECT id, display_name, email, role FROM users WHERE id = ? LIMIT 1', [req.user.sub])
  if (!users[0]) throw new HttpError(401, 'Account not found.')
  res.json({ user: publicUser(users[0]) })
})