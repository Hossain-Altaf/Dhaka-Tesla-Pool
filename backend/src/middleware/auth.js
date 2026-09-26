import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { HttpError } from '../httpError.js'

export function requireAuth(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return next(new HttpError(401, 'Sign in to continue.'))

  try {
    req.user = jwt.verify(token, config.jwtSecret)
    next()
  } catch {
    next(new HttpError(401, 'Your session has expired. Sign in again.'))
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return next(new HttpError(403, 'This action is not available for your account.'))
    }
    next()
  }
}