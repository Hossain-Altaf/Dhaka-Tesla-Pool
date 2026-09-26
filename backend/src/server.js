import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import { config } from './config.js'
import { pool } from './db.js'
import { migrate } from './migrate.js'
import { seed } from './seed.js'
import { HttpError } from './httpError.js'
import { authRouter } from './routes/auth.js'
import { dashboardRouter } from './routes/dashboard.js'
import { ridesRouter } from './routes/rides.js'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN || true }))
app.use(express.json({ limit: '20kb' }))
app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.headers.cookie'] }))

app.get('/health', async (req, res) => {
  await pool.query('SELECT 1')
  res.json({ status: 'ok', service: 'dhaka-tesla-pool-api' })
})

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }), authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/rides', ridesRouter)

app.use((req, res, next) => next(new HttpError(404, 'Route not found.')))
app.use((error, req, res, next) => {
  req.log?.error({ err: error }, 'request failed')
  if (res.headersSent) return next(error)
  const status = Number.isInteger(error.status) ? error.status : 500
  res.status(status).json({
    error: status === 500 ? 'Something went wrong. Please try again.' : error.message,
    ...(error.details ? { details: error.details } : {}),
  })
})

if (process.env.NODE_ENV !== 'test') {
  await migrate()
  if (process.env.SEED_DEMO_DATA === 'true') await seed()
  app.listen(config.port, '0.0.0.0', () => {
    console.info(`API listening on ${config.port}`)
  })
}