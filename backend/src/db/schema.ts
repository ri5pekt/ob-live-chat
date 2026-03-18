import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  integer,
} from 'drizzle-orm/pg-core'

export const sessionStatusEnum = pgEnum('session_status', ['open', 'closed'])
export const senderTypeEnum = pgEnum('sender_type', ['visitor', 'agent', 'ai', 'system'])
export const messageTypeEnum = pgEnum('message_type', ['text', 'image', 'system'])

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).unique().notNull(),
  telegramUsername: varchar('telegram_username', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicId: varchar('public_id', { length: 64 }).unique().notNull(),
  visitorToken: varchar('visitor_token', { length: 128 }).notNull(),
  status: sessionStatusEnum('status').default('open').notNull(),
  websiteId: varchar('website_id', { length: 128 }),
  pageUrl: text('page_url'),
  referrerUrl: text('referrer_url'),
  visitorName: varchar('visitor_name', { length: 255 }),
  visitorEmail: varchar('visitor_email', { length: 255 }),
  assignedAgentId: uuid('assigned_agent_id').references(() => agents.id),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }),
  telegramTopicId: bigint('telegram_topic_id', { mode: 'number' }),
  source: varchar('source', { length: 64 }).default('website').notNull(),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
})

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => chatSessions.id)
    .notNull(),
  messageId: uuid('message_id'),
  storageProvider: varchar('storage_provider', { length: 32 }).default('local').notNull(),
  storageKey: varchar('storage_key', { length: 512 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => chatSessions.id)
    .notNull(),
  senderType: senderTypeEnum('sender_type').notNull(),
  senderName: varchar('sender_name', { length: 255 }),
  text: text('text'),
  messageType: messageTypeEnum('message_type').default('text').notNull(),
  attachmentId: uuid('attachment_id').references(() => attachments.id),
  telegramMessageId: bigint('telegram_message_id', { mode: 'number' }),
  replyToMessageId: uuid('reply_to_message_id'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const sessionEvents = pgTable('session_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => chatSessions.id)
    .notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Agent = typeof agents.$inferSelect
export type ChatSession = typeof chatSessions.$inferSelect
export type Attachment = typeof attachments.$inferSelect
export type ChatMessage = typeof chatMessages.$inferSelect
export type SessionEvent = typeof sessionEvents.$inferSelect
