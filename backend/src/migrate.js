import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { pool } from './db.js'

export async function migrate() {
  const path = new URL('../migrations/001_initial.sql', import.meta.url)
  const sql = await readFile(fileURLToPath(path), 'utf8')
  const connection = await pool.getConnection()
  try {
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      await connection.query(statement)
    }
  } finally {
    connection.release()
  }
}