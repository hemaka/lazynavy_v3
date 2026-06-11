import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const uploadsDir = process.env.UPLOADS_DIR ?? join(process.env.HOME ?? process.cwd(), 'LazyNavyUploads')

mkdirSync(uploadsDir, { recursive: true })
