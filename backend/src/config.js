import 'dotenv/config'

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET']

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`)
}

export const config = {
  port: Number(process.env.PORT || process.env.API_PORT || 4000),
  jwtSecret: process.env.JWT_SECRET,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    timezone: 'Z',
    ssl: process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
        }
      : undefined,
  },
}