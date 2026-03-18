import { Bot, InputFile, type Context } from 'grammy'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { chatSessions, chatMessages, agents, sessionEvents } from '../db/schema.js'
import type { ChatSession, ChatMessage } from '../db/schema.js'
import type { MessageWithAttachment } from './message.service.js'
import { emitToSession } from './socket.service.js'
import { formatMessageForSocket } from './message.service.js'
import { config } from '../lib/config.js'
import { logger } from '../lib/logger.js'

let bot: Bot<Context> | null = null

export async function initTelegramService(): Promise<void> {
  if (!config.telegram.botToken) {
    logger.warn('Telegram bot token not configured')
    return
  }

  bot = new Bot(config.telegram.botToken)

  bot.command('start', async (ctx) => {
    await ctx.reply('ob-live-chat bot is active.')
  })

  if (config.telegram.webhookSecret) {
    await setupWebhook()
  } else {
    logger.warn('No TELEGRAM_WEBHOOK_SECRET set — webhook not registered')
  }
}

export async function setupWebhook(): Promise<void> {
  if (!bot) return
  const webhookUrl = `${config.appBaseUrl}/api/telegram/webhook`
  await bot.api.setWebhook(webhookUrl, {
    allowed_updates: ['message'],
    secret_token: config.telegram.webhookSecret || undefined,
  })
  logger.info({ webhookUrl }, 'Telegram webhook registered')
}

function visitorTopicTitle(session: ChatSession): string {
  if (session.visitorName) return session.visitorName
  // e.g. publicId = "sess_yrpvvpde" → "Visitor #yrpvvpde"
  const shortId = session.publicId.replace('sess_', '')
  return `Visitor #${shortId}`
}

function hostnameFromUrl(url: string | null): string {
  if (!url) return 'unknown'
  try {
    return new URL(url).hostname
  } catch {
    return url.slice(0, 50)
  }
}

export async function createTopicForSession(session: ChatSession): Promise<number> {
  if (!bot) throw new Error('Telegram bot not initialized')

  const topicTitle = visitorTopicTitle(session)

  const result = await bot.api.createForumTopic(config.telegram.supportChatId, topicTitle)
  const topicId = result.message_thread_id

  await db
    .update(chatSessions)
    .set({
      telegramChatId: config.telegram.supportChatId,
      telegramTopicId: topicId,
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, session.id))

  await db.insert(sessionEvents).values({
    sessionId: session.id,
    eventType: 'telegram_topic_created',
    payload: { topicId, chatId: config.telegram.supportChatId },
  })

  logger.info({ sessionId: session.id, topicId }, 'Telegram topic created')

  return topicId
}

export async function sendSessionHeader(topicId: number, session: ChatSession): Promise<void> {
  if (!bot) return

  const started = session.createdAt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC'
  const visitor = session.visitorName ?? 'anonymous'
  const rawPath = session.pageUrl ? new URL(session.pageUrl).pathname : 'unknown'
  const page = (() => { try { return decodeURIComponent(rawPath) } catch { return rawPath } })()

  const lines = [
    '🆕 New website support chat',
    `Page: ${page}`,
    `Started: ${started}`,
    `Visitor: ${visitor}`,
  ]
  if (session.visitorEmail) lines.push(`Email: ${session.visitorEmail}`)
  lines.push('', 'Reply in this topic to chat with the visitor.')

  const text = lines.join('\n')

  await bot.api.sendMessage(config.telegram.supportChatId, text, {
    message_thread_id: topicId,
  })
}

export async function forwardVisitorMessage(
  session: ChatSession,
  message: MessageWithAttachment
): Promise<void> {
  if (!bot || !config.telegram.botToken) return

  try {
    let topicId = session.telegramTopicId

    if (!topicId) {
      topicId = await createTopicForSession(session)
      const updatedSession = { ...session, telegramTopicId: topicId }
      await sendSessionHeader(topicId, updatedSession)
    }

    let tgMessageId: number | undefined

    if (message.attachment && message.attachment.storageProvider === 'local') {
      const fs = await import('fs')
      const path = await import('path')
      const filePath = path.join(config.uploads.dir, message.attachment.storageKey)

      if (fs.existsSync(filePath)) {
        const sent = await bot.api.sendPhoto(
          config.telegram.supportChatId,
          new InputFile(filePath, message.attachment.originalFilename),
          {
            caption: message.text ?? undefined,
            message_thread_id: topicId,
          }
        )
        tgMessageId = sent.message_id
      } else {
        logger.warn({ filePath }, 'attachment file not found, sending as text')
      }
    }

    if (!tgMessageId && message.text) {
      const sent = await bot.api.sendMessage(
        config.telegram.supportChatId,
        `👤 Visitor: ${message.text}`,
        { message_thread_id: topicId }
      )
      tgMessageId = sent.message_id
    }

    if (tgMessageId) {
      await db
        .update(chatMessages)
        .set({ telegramMessageId: tgMessageId })
        .where(eq(chatMessages.id, message.id))
    }
  } catch (err) {
    logger.error(err, 'failed to forward visitor message to Telegram')
  }
}

export async function handleWebhook(update: unknown): Promise<void> {
  const upd = update as {
    message?: {
      message_id: number
      message_thread_id?: number
      from?: { id: number; first_name?: string; last_name?: string; username?: string; is_bot?: boolean }
      text?: string
      photo?: unknown[]
    }
  }

  if (!upd.message) return
  const msg = upd.message

  if (!msg.text && !msg.photo) return

  const topicId = msg.message_thread_id
  if (!topicId) return

  const senderId = msg.from?.id
  if (!senderId) return

  if (msg.from?.is_bot) return

  if (bot) {
    try {
      const me = await bot.api.getMe()
      if (senderId === me.id) return
    } catch {
      // ignore
    }
  }

  const session = await db.query.chatSessions.findFirst({
    where: (s, { and: a, eq: e }) =>
      a(e(s.telegramTopicId, topicId), e(s.status, 'open')),
  })

  if (!session) {
    logger.warn({ topicId }, 'received Telegram message for unknown or closed session')
    return
  }

  const firstName = msg.from?.first_name ?? 'Agent'
  const lastName = msg.from?.last_name ?? ''
  const displayName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim()

  await db
    .insert(agents)
    .values({
      telegramUserId: senderId,
      telegramUsername: msg.from?.username ?? null,
      displayName,
    })
    .onConflictDoUpdate({
      target: agents.telegramUserId,
      set: {
        telegramUsername: msg.from?.username ?? null,
        displayName,
        updatedAt: new Date(),
      },
    })

  const [agentMessage] = await db
    .insert(chatMessages)
    .values({
      sessionId: session.id,
      senderType: 'agent',
      senderName: displayName,
      messageType: 'text',
      text: msg.text ?? null,
      telegramMessageId: msg.message_id,
    })
    .returning()

  await db
    .update(chatSessions)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(chatSessions.id, session.id))

  const formatted = formatMessageForSocket({ ...agentMessage, attachment: null }, config.appBaseUrl)
  emitToSession(session.id, 'message_new', { message: formatted })

  logger.info(
    { sessionId: session.id, messageId: agentMessage.id, senderName: displayName },
    'agent message received and pushed to widget'
  )
}

export async function sendContactDetails(
  session: ChatSession,
  name: string | null,
  email: string | null
): Promise<void> {
  if (!bot || !session.telegramTopicId) return
  try {
    const lines = ['📋 Visitor shared contact details']
    if (name) lines.push(`Name: ${name}`)
    if (email) lines.push(`Email: ${email}`)
    await bot.api.sendMessage(config.telegram.supportChatId, lines.join('\n'), {
      message_thread_id: Number(session.telegramTopicId),
    })
  } catch (err) {
    logger.error(err, 'failed to send contact details to Telegram')
  }
}

export async function updateTopicTitle(session: ChatSession): Promise<void> {
  if (!bot || !session.telegramTopicId) return
  try {
    const newTitle = visitorTopicTitle(session)
    await bot.api.editForumTopic(config.telegram.supportChatId, Number(session.telegramTopicId), {
      name: newTitle,
    })
    logger.info({ sessionId: session.id, newTitle }, 'Telegram topic title updated')
  } catch (err) {
    logger.error(err, 'failed to update Telegram topic title')
  }
}
