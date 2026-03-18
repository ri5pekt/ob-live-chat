# Dev Plan — ob-live-chat MVP

> Ready-to-execute implementation checklist.  
> Work top-to-bottom. Each task has a clear scope and acceptance criteria.

---

## Quick Reference

| | |
|---|---|
| Backend | Node.js + TypeScript + Fastify + Socket.IO |
| ORM | Drizzle |
| Database | PostgreSQL |
| Frontend | Vanilla JS + Vite |
| File storage | Local filesystem (Docker volume) |
| Dev environment | Docker Compose |
| Telegram | Supergroup + Forum Topics |

---

## Repository Structure

```
/ob-live-chat
  /backend
    /src
      server.ts
      app.ts
      /routes
        chat.routes.ts
        attachment.routes.ts
        telegram.routes.ts
      /services
        session.service.ts
        message.service.ts
        telegram.service.ts
        socket.service.ts
        upload.service.ts
        ai.service.ts          ← empty stub, ready for phase 4
      /db
        index.ts               ← Drizzle instance
        schema.ts              ← all table definitions
        /migrations
      /lib
        logger.ts
        validators.ts
        config.ts
      /plugins
        socketio.ts
        rate-limit.ts
    drizzle.config.ts
    tsconfig.json
    package.json
    Dockerfile
    .env
  /widget
    /src
      widget.js
      app.js
      store.js
      socket.js
      api.js
      uploader.js
      /ui
        launcher.js
        chat-window.js
        message-list.js
        message-item.js
        composer.js
      styles.css
    vite.config.js
    package.json
  /docs
    project_description.md
    dev_plan.md
  docker-compose.yml
  docker-compose.dev.yml
  .env.example
  .gitignore
```

---

## Phase 1 — Core Chat

> Goal: Visitor can chat with support via Telegram. History persists. No attachments yet.

---

### Task 1.1 — Project Scaffolding

**Scope:** Set up the monorepo, Docker environment, and tooling.

**Steps:**

1. Create root `docker-compose.yml` with:
   - `postgres` service (postgres:16, named volume for data)
   - `backend` service (build from `/backend/Dockerfile`, depends on postgres)
   - `uploads` named volume mounted at `/uploads` inside backend container
2. Create `backend/Dockerfile` (multi-stage: build TypeScript → run compiled JS)
3. Create `backend/package.json` with dependencies:
   - `fastify`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/multipart`, `@fastify/static`
   - `socket.io`
   - `drizzle-orm`, `drizzle-kit`, `postgres` (pg driver)
   - `node-telegram-bot-api` or `grammy` (grammy preferred for TypeScript)
   - `zod` (request validation)
   - `pino`, `pino-pretty` (logging)
   - `uuid`
   - TypeScript + `tsx` + `@types/*`
4. Create `tsconfig.json` (strict mode, target ES2022, moduleResolution NodeNext)
5. Create `.env.example` with all variables (see section below)
6. Create `.gitignore`

**Acceptance:** `docker compose up` starts postgres and backend without errors.

---

### Task 1.2 — Database Schema

**Scope:** Define all Drizzle tables in `schema.ts`.

**`schema.ts` — full definition:**

```typescript
import { pgTable, uuid, varchar, text, bigint, boolean, timestamp, jsonb, pgEnum, integer } from 'drizzle-orm/pg-core'

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
  sessionId: uuid('session_id').references(() => chatSessions.id).notNull(),
  messageId: uuid('message_id'),  // set after message is created
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
  sessionId: uuid('session_id').references(() => chatSessions.id).notNull(),
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
  sessionId: uuid('session_id').references(() => chatSessions.id).notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

**Steps:**

1. Write `schema.ts` as above
2. Configure `drizzle.config.ts`:
   ```typescript
   export default {
     schema: './src/db/schema.ts',
     out: './src/db/migrations',
     driver: 'pg',
     dbCredentials: { connectionString: process.env.DATABASE_URL! },
   }
   ```
3. Run `drizzle-kit generate` to create initial migration
4. Apply migration on container start (`drizzle-kit migrate` or `migrate.ts` startup script)
5. Write `db/index.ts` to export Drizzle instance connected to DATABASE_URL

**Acceptance:** Tables exist in Postgres after `docker compose up`. Schema matches definition above.

---

### Task 1.3 — Config + Logger

**Scope:** Centralized config and structured logging.

**`config.ts`:**
```typescript
export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appBaseUrl: process.env.APP_BASE_URL!,
  allowedOrigins: (process.env.WIDGET_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  databaseUrl: process.env.DATABASE_URL!,
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    supportChatId: Number(process.env.TELEGRAM_SUPPORT_CHAT_ID!),
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },
  uploads: {
    dir: process.env.UPLOADS_DIR ?? '/uploads',
    maxMb: Number(process.env.MAX_UPLOAD_MB ?? 5),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN ?? '*',
  },
}
```

**`logger.ts`:** Export a `pino` logger instance with `pino-pretty` in development.

**Acceptance:** `config.ts` throws on missing required env vars. Logger is used consistently across all services.

---

### Task 1.4 — Fastify App Setup

**Scope:** Set up the Fastify server with all plugins registered.

**`app.ts`:**
- Register `@fastify/cors` with `allowedOrigins` from config
- Register `@fastify/rate-limit` (base limits, tighter limits added per route)
- Register `@fastify/multipart` (for file uploads later)
- Register `@fastify/static` to serve `/uploads` directory at `/uploads`
- Register chat routes under `/api/chat`
- Register attachment routes under `/api/chat`
- Register Telegram webhook route under `/api/telegram`
- Add global error handler (log + return standardized error shape)
- Add `onRequest` hook to log all incoming requests

**`server.ts`:**
- Build app
- Start on configured port
- Register Socket.IO on same HTTP server (see Task 1.6)

**Acceptance:** Server starts. `GET /health` returns `{ ok: true }`. Unknown routes return 404.

---

### Task 1.5 — Session API

**Scope:** Session creation, restoration, and history loading.

**`session.service.ts` — methods:**

```typescript
createOrRestoreSession(data: {
  visitorToken?: string
  pageUrl?: string
  referrerUrl?: string
}): Promise<ChatSession>
```

Logic:
- If `visitorToken` provided → look for existing `open` session with that token
- If found → return existing session
- If not found → create new session
  - generate `publicId` (e.g. `sess_` + 8 random chars)
  - generate `visitorToken` (UUID v4) if not provided
  - insert into `chat_sessions`
  - log `session_created` event in `session_events`
  - trigger Telegram topic creation (async, do not block response)

```typescript
getSessionByIdAndToken(sessionId: string, visitorToken: string): Promise<ChatSession | null>
```

**`chat.routes.ts`:**

```
POST /api/chat/session
  body: { visitorToken?, pageUrl?, referrerUrl? }
  response: { sessionId, visitorToken, status }

GET /api/chat/session/:sessionId/messages
  header: visitor-token (required)
  response: { session, messages }
  — validates visitor-token matches session
  — returns last 100 messages ordered by created_at asc
```

**Acceptance:**
- POST creates a new session, returns `sessionId` + `visitorToken`
- POST with existing token returns same session
- GET returns message history (empty array on new session)
- GET with wrong token returns 403

---

### Task 1.6 — Socket.IO Setup

**Scope:** Realtime layer for pushing messages to the widget.

**`plugins/socketio.ts`:**
- Attach Socket.IO to the Fastify HTTP server
- Configure CORS to `SOCKET_CORS_ORIGIN`
- On `connection`:
  - log new socket connection
- Handle `session_join` event:
  ```
  client sends: { sessionId: string, visitorToken: string }
  ```
  - validate session exists + token matches
  - if invalid → emit `session_join_error: { error: 'Invalid session' }`, disconnect
  - if valid → socket joins room `chat_session_<sessionId>`
  - emit `session_joined: { sessionId, status }`
- On disconnect: log

**`socket.service.ts`:**
```typescript
emitToSession(sessionId: string, event: string, data: unknown): void
```
- Emits to room `chat_session_<sessionId>`
- Used by message service and Telegram service to push messages to widget

**Acceptance:**
- Widget can connect, authenticate, and join a room
- Invalid token results in `session_join_error`
- Server can push `message_new` to a session room

---

### Task 1.7 — Send Message (Visitor → Backend → Telegram)

**Scope:** Visitor sends text message, backend stores it and forwards to Telegram.

**`message.service.ts`:**
```typescript
createVisitorMessage(sessionId: string, text: string): Promise<ChatMessage>
```
- Insert message: `sender_type = visitor`, `message_type = text`
- Update `chat_sessions.last_message_at`
- Return message
- (Telegram forwarding called from route handler, not inside service)

**`chat.routes.ts` — add:**
```
POST /api/chat/session/:sessionId/messages
  header: visitor-token (required)
  body: { text: string }  (max 2000 chars, required non-empty)
  response: { message }
```

Route handler flow:
1. Validate session + token
2. Validate `text` (zod: non-empty string, max 2000 chars)
3. Create message via `message.service`
4. Call `telegram.service.forwardVisitorMessage(session, message)` — **do not await**
5. Emit `message_sent` to session room via socket service
6. Return `{ message }`

**Acceptance:**
- Message is stored in DB
- Rate limit: max 10 messages per visitor per minute (configurable)
- Long text rejected (over 2000 chars)
- Empty text rejected
- Telegram forwarding triggered (even if Telegram fails, message is still stored)

---

### Task 1.8 — Telegram Bot Setup

**Scope:** Initialize the Telegram bot, set up webhook, create topics.

**Library choice:** `grammy` — best TypeScript support, modern API.

**`telegram.service.ts` — methods:**

```typescript
setupWebhook(): Promise<void>
// Registers APP_BASE_URL/api/telegram/webhook with Telegram
// Sets allowed_updates: ['message']
// Sets secret_token from TELEGRAM_WEBHOOK_SECRET

createTopicForSession(session: ChatSession): Promise<number>
// Creates forum topic in TELEGRAM_SUPPORT_CHAT_ID
// Topic title: `#${session.publicId} ${hostname(session.pageUrl)}`
// Returns telegram_topic_id (message_thread_id)
// Saves telegram_topic_id to session in DB
// Logs telegram_topic_created event
// Sends initial session header message into topic

sendSessionHeader(topicId: number, session: ChatSession): Promise<void>
// Sends formatted info message into the topic:
// New website support chat
// Session: #1042
// Website: example.com
// Page: /checkout
// Started: 2026-03-18 14:12 UTC
// Visitor: anonymous
//
// Reply in this topic to chat with the visitor.

forwardVisitorMessage(session: ChatSession, message: ChatMessage): Promise<void>
// Sends text to the session's Telegram topic
// Updates message.telegramMessageId in DB on success
// Logs error if Telegram call fails (do not throw — best effort)
```

**Important:** On first message for a session that has no `telegram_topic_id` yet:
1. Create topic
2. Send header
3. Then send the visitor's message

**Acceptance:**
- Bot responds to `/start` in the supergroup (optional health check)
- Topic is created for each new session
- Visitor messages appear in the correct Telegram topic
- Errors in Telegram forwarding are logged but do not break the API response

---

### Task 1.9 — Telegram Webhook (Agent Reply → Website)

**Scope:** Receive agent replies from Telegram and push them to the website widget.

**`telegram.routes.ts`:**
```
POST /api/telegram/webhook
  — validates X-Telegram-Bot-Api-Secret-Token header
  — passes body to telegram.service.handleWebhook()
  — always returns 200 OK immediately
```

**`telegram.service.ts` — add:**
```typescript
handleWebhook(update: Update): Promise<void>
```

Logic:
1. Check if `update.message` exists and has `text`
2. Get `message_thread_id` (this is the `telegram_topic_id`)
3. Get sender's `from.id` (Telegram user ID)
4. Ignore messages from the bot itself (check against bot's own user ID)
5. Find session by `telegram_topic_id`:
   ```sql
   SELECT * FROM chat_sessions WHERE telegram_topic_id = ? AND status = 'open'
   ```
6. If no session found → log warning, return (ignore)
7. Optionally upsert agent in `agents` table (by `telegram_user_id`)
8. Insert message into `chat_messages`:
   - `sender_type = agent`
   - `sender_name` = agent's `display_name` or `first_name`
   - `text` = message text
   - `telegram_message_id` = Telegram message ID
9. Update `chat_sessions.last_message_at`
10. Emit `message_new` to `chat_session_<sessionId>` room via socket service

**Acceptance:**
- Agent replies in Telegram topic
- Website visitor receives the message via socket instantly
- Bot's own messages in the topic are ignored
- Messages in unrelated topics are ignored
- Webhook secret mismatch returns 403

---

### Task 1.10 — Widget — Base Structure

**Scope:** Scaffold the Vite widget project.

**Steps:**

1. Create `/widget` with `package.json`, `vite.config.js`
2. Vite config: build as IIFE (`format: 'iife'`, `name: 'LiveChatWidget'`), single output file `widget.js`
3. Create `styles.css` with CSS variables for theming (colors, sizes)
4. Create `store.js` — simple observable state object:
   ```javascript
   const store = {
     sessionId: null,
     visitorToken: null,
     messages: [],
     status: 'closed', // closed | opened | loading | connected | reconnecting
     // listeners
   }
   ```
5. Create `api.js` — `fetch`-based wrappers for all REST endpoints
6. Create `socket.js` — Socket.IO client wrapper with auto-reconnect
7. Create `widget.js` — entry point, auto-initializes on script load

**Acceptance:** `npm run build` produces a single `widget.js` file. Embedding `<script src="widget.js"></script>` on any page shows the launcher button.

---

### Task 1.11 — Widget — UI Components

**Scope:** Build the chat window UI in vanilla JS.

**`ui/launcher.js`:**
- Floating button (bottom-right)
- Click → open chat window
- Shows unread indicator (phase 3)

**`ui/chat-window.js`:**
- Fixed-position popup (bottom-right)
- Header: "Support Chat" + close button + connection status
- Message area (scrollable)
- Composer at bottom

**`ui/message-list.js`:**
- Renders array of messages
- Scrolls to bottom on new message
- Shows loading skeleton while fetching history

**`ui/message-item.js`:**
- Visitor messages: right-aligned, blue
- Agent messages: left-aligned, gray
- System messages: centered, muted
- AI messages: left-aligned, purple (ready for phase 4)
- Timestamp
- Image messages: show thumbnail (phase 2)

**`ui/composer.js`:**
- Textarea (auto-resize)
- Send button (disabled when empty or disconnected)
- Attach file button (phase 2)
- Enter to send (Shift+Enter for newline)

**Acceptance:** Widget renders all message types. Composer is functional. UI is clean and mobile-responsive.

---

### Task 1.12 — Widget — Session + Message Flow

**Scope:** Wire up the full message flow in the widget.

**`app.js` — init flow:**
1. On page load, read `visitor_token` from `localStorage`
2. Call `POST /api/chat/session` with token + current `pageUrl` + `referrerUrl`
3. Save returned `sessionId` and `visitorToken` to store + localStorage
4. Load history via `GET /api/chat/session/:sessionId/messages`
5. Render messages
6. Connect Socket.IO
7. Emit `session_join` with `sessionId` + `visitorToken`
8. On `session_joined` → update status to `connected`
9. On `message_new` → append to message list, scroll to bottom

**Sending messages:**
1. Composer calls `POST /api/chat/session/:sessionId/messages`
2. Optimistically append message to list with "sending" state
3. On success → update message state to "sent"
4. On failure → show error state on message

**Socket reconnect:**
- On reconnect → re-emit `session_join`
- Show "reconnecting" status in header during disconnect

**Acceptance:**
- Full visitor → Telegram → visitor reply cycle works end to end
- History is restored after page refresh
- Reconnect works after network interruption

---

## Phase 2 — Screenshot Support + Stability

---

### Task 2.1 — File Upload Endpoint

**Scope:** Accept image uploads, store on local filesystem, return attachment record.

**`upload.service.ts`:**
```typescript
saveUploadedFile(data: {
  buffer: Buffer
  originalFilename: string
  mimeType: string
  sessionId: string
}): Promise<Attachment>
```

Logic:
1. Validate MIME type is in allowed list
2. Validate file size ≤ MAX_UPLOAD_MB
3. Generate storage key: `<sessionId>/<uuid>.<ext>`
4. Write file to `UPLOADS_DIR/<storageKey>`
5. Insert `attachments` row with `storage_provider = 'local'`
6. Return attachment record

**`attachment.routes.ts`:**
```
POST /api/chat/session/:sessionId/attachments
  header: visitor-token (required)
  body: multipart/form-data, field: file
  response: { attachment }
```

Rate limit: 5 uploads per visitor per minute.

**Acceptance:**
- Image uploads are stored under `/uploads/<sessionId>/`
- Files are accessible at `GET /uploads/<storageKey>` (served by `@fastify/static`)
- Oversized files return 413
- Wrong MIME type returns 415
- Attachments are tied to the correct session

---

### Task 2.2 — Attach Image to Message

**Scope:** Visitor sends a message with an image attachment.

**`chat.routes.ts` — update `POST /api/chat/session/:sessionId/messages`:**
- Accept optional `attachmentId` in body
- If provided:
  - verify attachment belongs to this session
  - set `message_type = image`
  - update `attachment.messageId` to the new message ID
  - include attachment URL in the socket emit payload

**`message.service.ts`:**
- Include attachment in message response when `attachmentId` is set

**Telegram forwarding:**
- If message has attachment → `telegram.service.sendImageToTopic(topicId, filePath, caption)`
- Use Telegram's `sendPhoto` with the local file path
- Fallback: if Telegram photo send fails, send as text link

**Acceptance:**
- Visitor can upload an image and attach it to a message
- Image is forwarded to Telegram topic as a photo
- Image appears in widget chat history as a thumbnail

---

### Task 2.3 — Widget Upload UI

**Scope:** Add image upload UI to the widget.

**`uploader.js`:**
- `uploadFile(file, sessionId, visitorToken)` → calls attachment endpoint
- Returns attachment with URL

**`ui/composer.js` — add:**
- Attach button (paperclip icon)
- Hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`
- On file selected:
  - show thumbnail preview in composer
  - show upload progress indicator
  - upload file
  - on success → store `attachmentId` in composer state
  - on failure → show error, remove preview
- Send button sends message with `attachmentId` if present
- Clear attachment after send

**`ui/message-item.js` — add:**
- Render image messages as `<img>` thumbnail
- Click → open full size in new tab (or lightbox)

**Acceptance:**
- Visitor can select an image, see preview, and send it
- Image appears in chat history
- Upload error is displayed (not silent)
- Upload progress is visible

---

### Task 2.4 — Rate Limiting + Validation Hardening

**Scope:** Protect all endpoints against abuse.

**Rate limits (using `@fastify/rate-limit`):**

| Endpoint | Limit |
|---|---|
| `POST /api/chat/session` | 5 per IP per minute |
| `POST .../messages` | 10 per visitor token per minute |
| `POST .../attachments` | 5 per visitor token per minute |
| `POST /api/telegram/webhook` | No rate limit (Telegram IP only) |

**Input validation (Zod on all routes):**
- `text`: non-empty string, max 2000 chars, trimmed
- `visitorToken`: max 128 chars, alphanumeric/dash/underscore
- `pageUrl`: valid URL or empty
- `sessionId`: valid UUID format

**Sanitization:**
- Message text stored as-is (plain text only, no HTML)
- Widget renders messages as `textContent` (not `innerHTML`) — prevents XSS

**Telegram webhook security:**
- Validate `X-Telegram-Bot-Api-Secret-Token` header matches `TELEGRAM_WEBHOOK_SECRET`
- Return 403 on mismatch

**Acceptance:**
- Spamming messages is rate-limited with clear error response
- Invalid inputs return descriptive 400 errors
- Telegram webhook rejects unknown callers

---

### Task 2.5 — Reconnect Handling + Error States

**Scope:** Widget handles connection loss gracefully.

**Socket.IO client:**
- Enable `reconnection: true` with exponential backoff (default Socket.IO settings)
- On `disconnect` → update store status to `reconnecting`
- On `connect` (after reconnect) → re-emit `session_join`, update status to `connected`
- Show reconnecting indicator in widget header

**Failed message states:**
- If REST call fails → show "Failed to send" on message with retry option
- Retry resends the same `text`

**History gap recovery:**
- On reconnect, re-fetch messages since last known message `created_at`
- Append new messages without duplicating

**Acceptance:**
- Widget shows "Reconnecting..." on connection loss
- Widget resumes normally after reconnect
- Messages sent during offline period show "Failed to send" with retry

---

## Phase 3 — Operational Improvements

> These tasks are not needed for MVP launch but should be planned and built cleanly.

---

### Task 3.1 — Telegram Bot Commands

**`/close`** in Telegram topic:
- Set `chat_sessions.status = closed`
- Set `chat_sessions.closed_at`
- Log `session_closed` event
- Emit `session_status_updated: { status: 'closed' }` to widget
- Post confirmation in topic: "Chat closed."

**`/reopen`** in Telegram topic:
- Set status back to `open`
- Log `session_reopened` event
- Emit update to widget

**`/claim`** in Telegram topic:
- Upsert agent
- Set `chat_sessions.assigned_agent_id`
- Log `agent_assigned` event

**Widget behavior on close:**
- Show "This chat has been closed by support."
- Disable composer

---

### Task 3.2 — Agent Names in Widget

- Widget shows `senderName` per message when available
- Agent name comes from `agents.display_name` or Telegram `first_name`
- Telegram service saves agent on every reply (upsert by `telegram_user_id`)

---

### Task 3.3 — Session Event Log

- All significant events written to `session_events` table
- Include full payload JSON for debugging

Events to log:
- `session_created`
- `telegram_topic_created`
- `message_sent` (visitor)
- `message_received` (agent)
- `attachment_uploaded`
- `agent_assigned`
- `session_closed`
- `session_reopened`
- `rate_limit_hit`

---

## Phase 4 — AI Readiness

> Stub is already in place (`ai.service.ts`). These are the wiring tasks.

---

### Task 4.1 — AI Greeting Message

- On session creation → send system/AI greeting immediately:
  ```
  Hi, I'm here while our support team joins. How can I help?
  ```
- Stored as `sender_type = ai` message
- Visible in widget immediately on open
- Controlled by feature flag env var `AI_GREETING_ENABLED=true`

---

### Task 4.2 — Human Handoff Marker

- Add `ai_active: boolean` field to `chat_sessions`
- When human agent first replies → set `ai_active = false`
- Emit `agent_joined` socket event to widget
- Widget can show "A support agent has joined" system message

---

## Full Environment Variables Reference

```env
# App
NODE_ENV=development
PORT=3000
APP_BASE_URL=https://chat.example.com

# CORS
WIDGET_ALLOWED_ORIGINS=https://example.com,https://www.example.com
SOCKET_CORS_ORIGIN=https://example.com

# Database
DATABASE_URL=postgresql://chatuser:chatpass@postgres:5432/chatdb

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_SUPPORT_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=

# Uploads
UPLOADS_DIR=/uploads
MAX_UPLOAD_MB=5

# AI (Phase 4)
AI_GREETING_ENABLED=false
```

---

## Docker Compose Reference

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: chatuser
      POSTGRES_PASSWORD: chatpass
      POSTGRES_DB: chatdb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    env_file: .env
    ports:
      - "3000:3000"
    volumes:
      - uploads_data:/uploads
    depends_on:
      - postgres

volumes:
  postgres_data:
  uploads_data:
```

---

## Full Socket Events Reference

| Direction | Event | Payload |
|---|---|---|
| C→S | `session_join` | `{ sessionId: string, visitorToken: string }` |
| S→C | `session_joined` | `{ sessionId: string, status: string }` |
| S→C | `session_join_error` | `{ error: string }` |
| S→C | `message_new` | `{ message: Message }` |
| S→C | `message_sent` | `{ message: Message }` |
| S→C | `message_failed` | `{ error: string }` |
| S→C | `session_status_updated` | `{ status: string }` |
| S→C | `agent_joined` | `{ agentName: string }` _(phase 3)_ |
| S→C | `ai_joined` | _(phase 4)_ |
| C→S | `typing_start` | `{ sessionId }` _(phase 3)_ |
| S→C | `typing` | `{ senderType }` _(phase 3)_ |

**Message shape** (used in `message_new`, `message_sent`):
```typescript
{
  id: string
  sessionId: string
  senderType: 'visitor' | 'agent' | 'ai' | 'system'
  senderName: string | null
  text: string | null
  messageType: 'text' | 'image' | 'system'
  attachment: {
    id: string
    url: string
    mimeType: string
    width: number | null
    height: number | null
  } | null
  createdAt: string  // ISO 8601
}
```

---

## Full API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/chat/session` | None | Create or restore session |
| `GET` | `/api/chat/session/:id/messages` | visitor-token header | Load chat history |
| `POST` | `/api/chat/session/:id/messages` | visitor-token header | Send text message |
| `POST` | `/api/chat/session/:id/attachments` | visitor-token header | Upload image |
| `POST` | `/api/chat/session/:id/close` | visitor-token header | Close session (phase 3) |
| `POST` | `/api/telegram/webhook` | webhook secret header | Telegram updates |
| `GET` | `/uploads/:key` | None | Serve uploaded file |
| `GET` | `/health` | None | Health check |

**Auth header:** `visitor-token: <visitorToken>`

---

## MVP Checklist

Use this to track MVP readiness.

### Infrastructure
- [ ] Docker Compose runs cleanly
- [ ] PostgreSQL is connected and migrated
- [ ] Environment variables validated on startup
- [ ] Health endpoint returns 200

### Session
- [ ] POST /api/chat/session creates new session
- [ ] POST with existing token restores session
- [ ] GET messages returns history

### Realtime
- [ ] Socket.IO connects
- [ ] session_join authenticates correctly
- [ ] session_join_error sent on bad token
- [ ] message_new received by widget after agent reply

### Telegram
- [ ] Bot is registered and webhook is set
- [ ] New session creates Telegram topic
- [ ] Session header is posted in topic
- [ ] Visitor messages appear in topic
- [ ] Agent replies in topic reach widget
- [ ] Bot's own messages are ignored

### Widget
- [ ] Embeds with single script tag
- [ ] Session created and stored in localStorage
- [ ] History loads on open
- [ ] Messages send and appear
- [ ] Reconnects after network drop
- [ ] Mobile-responsive

### Attachments
- [ ] Image upload stores file locally
- [ ] Attachment linked to message
- [ ] Image sent to Telegram topic
- [ ] Image visible in widget

### Security
- [ ] Rate limiting on messages
- [ ] Rate limiting on uploads
- [ ] Telegram webhook secret validated
- [ ] Wrong visitor token returns 403
- [ ] Oversized uploads rejected
- [ ] Invalid MIME types rejected

---

## Implementation Order

Start here, work down:

```
1.1 → Scaffolding + Docker
1.2 → DB Schema + Drizzle
1.3 → Config + Logger
1.4 → Fastify App
1.5 → Session API
1.6 → Socket.IO
1.7 → Send Message (REST)
1.8 → Telegram Bot + Topics
1.9 → Telegram Webhook → Widget
1.10 → Widget Base
1.11 → Widget UI Components
1.12 → Widget Full Flow

--- MVP core done, test end-to-end ---

2.1 → Upload Endpoint
2.2 → Attach Image to Message
2.3 → Widget Upload UI
2.4 → Rate Limits + Validation
2.5 → Reconnect + Error States

--- MVP definition of done complete ---

3.x → Phase 3 operational tasks
4.x → Phase 4 AI tasks
```
