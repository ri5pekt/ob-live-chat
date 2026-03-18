import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/index.js'
import { attachments } from '../db/schema.js'
import type { Attachment } from '../db/schema.js'
import { config } from '../lib/config.js'
import { logger } from '../lib/logger.js'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export interface SaveUploadInput {
  buffer: Buffer
  originalFilename: string
  mimeType: string
  sessionId: string
}

export async function saveUploadedFile(data: SaveUploadInput): Promise<Attachment> {
  if (!config.uploads.allowedMimeTypes.includes(data.mimeType)) {
    const err = new Error(`Unsupported file type: ${data.mimeType}`)
    ;(err as NodeJS.ErrnoException).code = '415'
    throw Object.assign(err, { statusCode: 415 })
  }

  const maxBytes = config.uploads.maxMb * 1024 * 1024
  if (data.buffer.length > maxBytes) {
    throw Object.assign(new Error(`File too large (max ${config.uploads.maxMb}MB)`), {
      statusCode: 413,
    })
  }

  const ext = MIME_TO_EXT[data.mimeType] ?? 'bin'
  const storageKey = `${data.sessionId}/${uuidv4()}.${ext}`
  const filePath = path.join(config.uploads.dir, storageKey)

  const dir = path.dirname(filePath)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(filePath, data.buffer)

  logger.debug({ storageKey, sizeBytes: data.buffer.length }, 'file saved')

  const [attachment] = await db
    .insert(attachments)
    .values({
      sessionId: data.sessionId,
      storageProvider: 'local',
      storageKey,
      originalFilename: data.originalFilename,
      mimeType: data.mimeType,
      sizeBytes: data.buffer.length,
    })
    .returning()

  return attachment
}
