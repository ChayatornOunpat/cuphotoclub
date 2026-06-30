import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')
const dbPath = join(process.cwd(), '.data', 'cu-photo.sqlite')

mkdirSync(dirname(dbPath), { recursive: true })

export const appDb = new Database(dbPath)
appDb.pragma('journal_mode = WAL')

