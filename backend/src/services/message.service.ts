import { eq, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { chatMessages, chatSessions, attachments } from '../db/schema.js'
import type { ChatMessage, Attachment } from '../db/schema.js'
import { logger } from '../lib/logger.js'

export interface MessageWithAttachment extends ChatMessage {
  attachment: Attachment | null
}

export async function createVisitorMessage(
  sessionId: string,
  text: string,
  attachmentId?: string
): Promise<MessageWithAttachment> {
  const messageType = attachmentId ? 'image' : 'text'

  const [message] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      senderType: 'visitor',
      messageType,
      text,
      attachmentId: attachmentId ?? null,
    })
    .returning()

  await db
    .update(chatSessions)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId))

  logger.debug({ messageId: message.id, sessionId }, 'visitor message created')

  let attachment: Attachment | null = null
  if (attachmentId) {
    const found = await db.query.attachments.findFirst({
      where: eq(attachments.id, attachmentId),
    })
    attachment = found ?? null
  }

  return { ...message, attachment }
}

export async function createAgentMessage(
  sessionId: string,
  text: string,
  senderName: string,
  telegramMessageId: number
): Promise<MessageWithAttachment> {
  const [message] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      senderType: 'agent',
      senderName,
      messageType: 'text',
      text,
      telegramMessageId,
    })
    .returning()

  await db
    .update(chatSessions)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId))

  logger.debug({ messageId: message.id, sessionId }, 'agent message stored')

  return { ...message, attachment: null }
}

export async function getSessionMessages(sessionId: string): Promise<MessageWithAttachment[]> {
  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, sessionId),
    orderBy: [asc(chatMessages.createdAt)],
    limit: 100,
  })

  const attachmentIds = messages
    .filter((m) => m.attachmentId != null)
    .map((m) => m.attachmentId as string)

  let attachmentMap: Record<string, Attachment> = {}
  if (attachmentIds.length > 0) {
    const found = await db.query.attachments.findMany({
      where: (a, { inArray }) => inArray(a.id, attachmentIds),
    })
    attachmentMap = Object.fromEntries(found.map((a) => [a.id, a]))
  }

  return messages.map((m) => ({
    ...m,
    attachment: m.attachmentId ? (attachmentMap[m.attachmentId] ?? null) : null,
  }))
}

export function formatMessageForSocket(message: MessageWithAttachment, baseUrl: string) {
  return {
    id: message.id,
    sessionId: message.sessionId,
    senderType: message.senderType,
    senderName: message.senderName ?? null,
    text: message.text ?? null,
    messageType: message.messageType,
    attachment: message.attachment
      ? {
          id: message.attachment.id,
          url: `${baseUrl}/uploads/${message.attachment.storageKey}`,
          mimeType: message.attachment.mimeType,
          width: message.attachment.width ?? null,
          height: message.attachment.height ?? null,
        }
      : null,
    createdAt: message.createdAt.toISOString(),
  }
}
