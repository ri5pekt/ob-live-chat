# ob-live-chat — Project Structure

## Stack
| Layer | Tech |
|---|---|
| Backend | Node.js + TypeScript + Fastify + Socket.IO |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Frontend widget | Vanilla JS + Vite (IIFE build) |
| Telegram | grammy bot — supergroup forum topics |
| Dev env | Docker Compose |
| Tunnel (dev) | ngrok free tier |

---

## Repository Layout

```
/ob-live-chat
  /backend
    /src
      server.ts           ← entry: runs migrations, starts Fastify + Socket.IO + Telegram
      app.ts              ← Fastify app factory: CORS, rate-limit, static files, routes
      /routes
        chat.routes.ts    ← POST /session, GET+POST /messages, POST /contact
        attachment.routes.ts ← POST /attachments (image upload)
        telegram.routes.ts   ← POST /webhook (Telegram → backend)
      /services
        session.service.ts   ← create/restore session, updateSessionContact
        message.service.ts   ← create/get messages, formatMessageForSocket
        telegram.service.ts  ← bot init, topic creation, forward messages, webhook handler
        socket.service.ts    ← emitToSession() singleton wrapper around Socket.IO
        upload.service.ts    ← save file to /uploads, insert attachment record
        ai.service.ts        ← empty stub (Phase 4)
      /db
        schema.ts         ← all Drizzle table definitions + exported types
        index.ts          ← Drizzle instance (postgres-js driver)
        migrate.ts        ← standalone migration runner (CLI)
        startup.ts        ← migration runner called on server boot
        /migrations       ← generated SQL migration files
      /lib
        config.ts         ← typed config from env vars (throws on missing required)
        logger.ts         ← pino logger (pretty in dev, JSON in prod)
        validators.ts     ← Zod schemas shared across routes
      /plugins
        socketio.ts       ← attaches Socket.IO to Fastify HTTP server
        rate-limit.ts     ← per-route rate limit config objects
    Dockerfile            ← multi-stage: build TS → run compiled JS
    drizzle.config.ts
    package.json
    tsconfig.json

  /widget
    /src
      widget.js           ← IIFE entry: auto-inits on script load, admin reset button
      app.js              ← session init, openChat(), handleSend(), contact form logic
      store.js            ← observable state (sessionId, messages, visitorName, unreadCount…)
      api.js              ← fetch wrappers for all REST endpoints
      socket.js           ← Socket.IO client (websocket-only transport, auto-reconnect)
      uploader.js         ← file upload helper
      /ui
        launcher.js       ← floating button, unread badge
        chat-window.js    ← window shell, header, status, contact panel integration
        message-list.js   ← render/append messages, typing indicator management
        message-item.js   ← per-message DOM element (visitor/agent/system/ai bubbles)
        composer.js       ← textarea, send button, attachment preview
        contact-form.js   ← collapsible name+email form, submit/skip logic
        typing-indicator.js ← animated 3-dot waiting bubble
      styles.css          ← all widget CSS (CSS vars, RTL, responsive)
    vite.config.js        ← IIFE build, CSS injected by JS → single widget.js output
    package.json

  /docs
    dev_plan.md           ← full phase-by-phase implementation plan (source of truth)
    project_structure.md  ← this file
    ngrok.md              ← APP_BASE_URL for current ngrok tunnel
    telegram.md           ← bot token, support chat ID

  docker-compose.yml      ← postgres + backend; widget/dist mounted as volume into backend
  .env                    ← active env vars (not committed)
  .env.example            ← env var template
  .gitignore
```

---

## Key Environment Variables

```env
DATABASE_URL=postgresql://chatuser:chatpass@postgres:5432/chatdb
TELEGRAM_BOT_TOKEN=
TELEGRAM_SUPPORT_CHAT_ID=       # supergroup with Forum Topics enabled
TELEGRAM_WEBHOOK_SECRET=        # validated on every webhook call
APP_BASE_URL=                   # public URL (ngrok in dev, real domain in prod)
WIDGET_ALLOWED_ORIGINS=         # comma-separated (CORS)
UPLOADS_DIR=/uploads
```

---

## Database Tables (`schema.ts`)

| Table | Purpose |
|---|---|
| `chat_sessions` | One row per visitor session. Holds visitorToken, status, visitorName/Email, telegramTopicId |
| `chat_messages` | All messages (visitor / agent / system / ai). senderType + messageType enum columns |
| `agents` | Upserted from Telegram on every agent reply (telegramUserId, displayName) |
| `attachments` | Uploaded files — linked to session + message |
| `session_events` | Audit log: session_created, contact_submitted, telegram_topic_created, etc. |

---

## API Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/chat/session` | — | Create or restore session by visitorToken |
| GET | `/api/chat/session/:id/messages` | visitor-token header | Last 100 messages |
| POST | `/api/chat/session/:id/messages` | visitor-token header | Send text message |
| POST | `/api/chat/session/:id/contact` | visitor-token header | Save name + email, notifies Telegram |
| POST | `/api/chat/session/:id/attachments` | visitor-token header | Upload image |
| POST | `/api/telegram/webhook` | X-Telegram-Bot-Api-Secret-Token | Receive agent replies |
| GET | `/uploads/:key` | — | Serve uploaded files |
| GET | `/health` | — | `{ ok: true }` |

---

## Socket.IO Events

| Direction | Event | Payload |
|---|---|---|
| C→S | `session_join` | `{ sessionId, visitorToken }` |
| S→C | `session_joined` | `{ sessionId, status }` |
| S→C | `session_join_error` | `{ error }` |
| S→C | `message_new` | `{ message }` — agent reply |
| S→C | `message_sent` | `{ message }` — visitor message confirmed |
| S→C | `visitor_name_updated` | `{ visitorName }` — after contact form save |
| S→C | `session_status_updated` | `{ status }` — e.g. closed |

Socket uses **websocket transport only** (`transports: ['websocket']`) — required because ngrok blocks XHR polling from third-party origins.

---

## Widget Embedding

```html
<!-- Optional: override backend URL -->
<script>
  window.__LIVE_CHAT_CONFIG__ = { backendUrl: 'https://your-ngrok-or-domain.com' };
</script>
<script src="https://your-ngrok-or-domain.com/widget/widget.js" async></script>
```

The built `widget.js` is served by the backend at `/widget/widget.js` via a Docker volume mount (`./widget/dist → /widget-dist`).

**Admin reset button** appears above the launcher only when `<body>` has both `logged-in` and `admin-bar` CSS classes (WordPress admin). Clicking it clears all `lc_*` localStorage keys and reloads.

---

## Dev Workflow

```bash
# 1. Fill in .env (copy from .env.example, add Telegram token + ngrok URL)

# 2. Start containers
docker compose up --build

# 3. After backend changes — rebuild container
docker compose up --build -d

# 4. After widget changes — just rebuild widget (volume mount, no Docker restart needed)
cd widget && npm run build

# 5. Generate DB migration after schema.ts changes
cd backend && npx drizzle-kit generate

# 6. Start ngrok (keep running in separate terminal)
ngrok http 3000 --domain=<your-static-domain>
```

---

## Telegram Setup Requirements

- Bot must be **admin** of the supergroup
- Supergroup must have **Forum Topics** enabled (Topics → ✓)
- Bot needs permissions: **Manage Topics**, **Send Messages**
- Webhook is registered automatically on server start if `TELEGRAM_BOT_TOKEN` is set
