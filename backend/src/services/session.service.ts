import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/index.js'
import { chatSessions, sessionEvents, chatMessages } from '../db/schema.js'
import type { ChatSession } from '../db/schema.js'
import { logger } from '../lib/logger.js'

const WELCOME_MESSAGE = 'שלום! 👋 ספר/י לנו על הבעיה ואנחנו נשמח לעזור.'

function generatePublicId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'sess_'
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export interface CreateOrRestoreSessionInput {
  visitorToken?: string
  pageUrl?: string
  referrerUrl?: string
}

export async function createOrRestoreSession(
  data: CreateOrRestoreSessionInput
): Promise<ChatSession> {
  if (data.visitorToken) {
    const existing = await db.query.chatSessions.findFirst({
      where: and(
        eq(chatSessions.visitorToken, data.visitorToken),
        eq(chatSessions.status, 'open')
      ),
    })
    if (existing) {
      logger.debug({ sessionId: existing.id }, 'restored existing session')
      return existing
    }
  }

  const visitorToken = data.visitorToken ?? uuidv4()
  const publicId = generatePublicId()

  const [session] = await db
    .insert(chatSessions)
    .values({
      publicId,
      visitorToken,
      pageUrl: data.pageUrl ?? null,
      referrerUrl: data.referrerUrl ?? null,
    })
    .returning()

  await db.insert(sessionEvents).values({
    sessionId: session.id,
    eventType: 'session_created',
    payload: { publicId, pageUrl: data.pageUrl ?? null },
  })

  // Welcome message — stored as AI so it renders as a proper chat bubble
  await db.insert(chatMessages).values({
    sessionId: session.id,
    senderType: 'ai',
    messageType: 'text',
    text: WELCOME_MESSAGE,
  })

  logger.info({ sessionId: session.id, publicId }, 'new session created')

  return session
}

export async function getSessionByIdAndToken(
  sessionId: string,
  visitorToken: string
): Promise<ChatSession | null> {
  const session = await db.query.chatSessions.findFirst({
    where: and(eq(chatSessions.id, sessionId), eq(chatSessions.visitorToken, visitorToken)),
  })
  return session ?? null
}

export async function getSessionById(sessionId: string): Promise<ChatSession | null> {
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
  })
  return session ?? null
}

export async function updateSessionContact(
  sessionId: string,
  name: string | null,
  email: string | null
): Promise<ChatSession> {
  const [updated] = await db
    .update(chatSessions)
    .set({
      ...(name ? { visitorName: name } : {}),
      ...(email ? { visitorEmail: email } : {}),
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, sessionId))
    .returning()

  await db.insert(sessionEvents).values({
    sessionId,
    eventType: 'contact_submitted',
    payload: { name, email },
  })

  logger.info({ sessionId, name, email }, 'visitor contact details saved')
  return updated
}
