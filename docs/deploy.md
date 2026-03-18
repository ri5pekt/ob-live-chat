# ob-live-chat — Deployment Guide (VPS + GitHub)

## Overview

```
GitHub repo → SSH to VPS → docker compose up
```

The backend serves the built widget.js directly.  
No separate frontend hosting needed.

---

## VPS Access

```bash
ssh root@187.124.160.50
```

> **⚠️ IMPORTANT — Shared VPS**
> This VPS hosts other active projects. Before making any system-level changes:
> - **Do NOT modify** existing Nginx or Caddy configs that belong to other projects
> - **Do NOT touch** existing SSL certificates (Let's Encrypt or otherwise)
> - **Do NOT change** ports already in use by other services
> - Only add a **new** Nginx server block in a new file under `sites-available/`
> - Always run `sudo nginx -t` before reloading Nginx to catch config errors
> - When in doubt, check `docker ps` and `ss -tlnp` to see what's already running

---

## One-time VPS Setup

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Install Nginx + Certbot

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

### 3. Add your SSH key to the VPS (from your local machine)

```bash
ssh-copy-id root@187.124.160.50
```

---

## One-time DNS + SSL Setup

### 4. Create DNS A record

The DNS A record for `live-chat.activebrands.cloud` → `187.124.160.50` has already been created.

> If you ever need to verify: `dig live-chat.activebrands.cloud` should resolve to `187.124.160.50`.

### 5. Configure Nginx

Create `/etc/nginx/sites-available/ob-live-chat`:

```nginx
server {
    server_name live-chat.activebrands.cloud;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # Required for Socket.IO websocket transport
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ob-live-chat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Issue SSL certificate

```bash
sudo certbot --nginx -d live-chat.activebrands.cloud
```

Certbot auto-configures Nginx for HTTPS and sets up auto-renewal.

---

## One-time GitHub Setup

### 7. Create GitHub repository

```bash
# On your local machine, inside the project folder
git init
git add .
git commit -m "initial commit"
git remote add origin git@github.com:yourname/ob-live-chat.git
git push -u origin main
```

> ⚠️ Make sure `.gitignore` includes `.env`, `node_modules/`, `dist/`, `widget/dist/`

### 8. Clone repo on VPS

```bash
ssh root@187.124.160.50
git clone git@github.com:yourname/ob-live-chat.git /opt/ob-live-chat
cd /opt/ob-live-chat
```

### 9. Create `.env` on VPS

```bash
cp .env.example .env
nano .env
```

Fill in all values:

```env
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://live-chat.activebrands.cloud

WIDGET_ALLOWED_ORIGINS=https://yourwebsite.com,https://www.yourwebsite.com
SOCKET_CORS_ORIGIN=https://yourwebsite.com

DATABASE_URL=postgresql://chatuser:chatpass@postgres:5432/chatdb

TELEGRAM_BOT_TOKEN=
TELEGRAM_SUPPORT_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=    # generate with: openssl rand -hex 32

UPLOADS_DIR=/uploads
MAX_UPLOAD_MB=5
```

---

## First Deploy

```bash
cd /opt/ob-live-chat

# Build widget
cd widget && npm ci && npm run build && cd ..

# Start all containers (postgres + backend)
docker compose up -d --build

# Verify
curl https://live-chat.activebrands.cloud/health
# expected: {"ok":true}
```

---

## Updating (after pushing changes to GitHub)

```bash
ssh root@187.124.160.50
cd /opt/ob-live-chat

# Pull latest code
git pull origin main

# If widget source changed — rebuild widget
cd widget && npm ci && npm run build && cd ..

# Rebuild and restart backend container
docker compose up -d --build backend

# Verify
curl https://live-chat.activebrands.cloud/health
```

> The widget `dist/` is mounted into the backend container via Docker volume,
> so widget rebuilds take effect immediately without restarting the backend.
> Only backend code changes require `--build backend`.

---

## Website Embed

Add to every page of your website (e.g. in WordPress footer or `functions.php`):

```html
<script>
  window.__LIVE_CHAT_CONFIG__ = { backendUrl: 'https://live-chat.activebrands.cloud' };
</script>
<script src="https://live-chat.activebrands.cloud/widget/widget.js" async></script>
```

---

## Useful Commands on VPS

```bash
# View live backend logs
docker compose logs -f backend

# View postgres logs
docker compose logs -f postgres

# Restart backend only
docker compose restart backend

# Stop everything
docker compose down

# Check container status
docker compose ps
```

---

## Deployment Checklist

### Infrastructure
- [x] VPS running Ubuntu (`187.124.160.50`)
- [ ] Docker installed
- [ ] Nginx installed
- [x] A record `live-chat.activebrands.cloud` → `187.124.160.50`
- [ ] SSL cert issued via Certbot
- [ ] Nginx proxy config active (`/etc/nginx/sites-available/ob-live-chat`)

### Code
- [ ] GitHub repo created
- [ ] `.gitignore` excludes `.env`, `dist/`, `node_modules/`
- [ ] Repo cloned on VPS at `/opt/ob-live-chat`

### Configuration
- [ ] `.env` created on VPS with all values filled
- [ ] `TELEGRAM_WEBHOOK_SECRET` is a strong random string
- [ ] `APP_BASE_URL` matches the real HTTPS domain
- [ ] `WIDGET_ALLOWED_ORIGINS` includes the website domain

### Running
- [ ] `docker compose up -d --build` successful
- [ ] `GET /health` returns `{"ok":true}`
- [ ] Telegram bot receives webhook (check logs after first chat)
- [ ] Widget loads on the website

### Website
- [ ] Embed script added to website
- [ ] Widget loads and connects (status shows "מחובר")
- [ ] Test message sent and received in Telegram
- [ ] Agent reply appears in widget
