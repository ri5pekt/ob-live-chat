# ob-live-chat — Deployment Guide (VPS + GitHub)

## Overview

```
GitHub repo → SSH to VPS → docker compose up
```

The backend serves the built widget.js directly.  
No separate frontend hosting needed.

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
ssh-copy-id user@your-vps-ip
```

---

## One-time DNS + SSL Setup

### 4. Create DNS A record

In your domain registrar or DNS provider:

| Type | Name | Value |
|---|---|---|
| A | `chat` | `<your VPS IP>` |

Wait for propagation (usually a few minutes).

### 5. Configure Nginx

Create `/etc/nginx/sites-available/chat`:

```nginx
server {
    server_name chat.yourdomain.com;

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
sudo ln -s /etc/nginx/sites-available/chat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Issue SSL certificate

```bash
sudo certbot --nginx -d chat.yourdomain.com
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
ssh user@your-vps-ip
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
APP_BASE_URL=https://chat.yourdomain.com

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
curl https://chat.yourdomain.com/health
# expected: {"ok":true}
```

---

## Updating (after pushing changes to GitHub)

```bash
ssh user@your-vps-ip
cd /opt/ob-live-chat

# Pull latest code
git pull origin main

# If widget source changed — rebuild widget
cd widget && npm ci && npm run build && cd ..

# Rebuild and restart backend container
docker compose up -d --build backend

# Verify
curl https://chat.yourdomain.com/health
```

> The widget `dist/` is mounted into the backend container via Docker volume,
> so widget rebuilds take effect immediately without restarting the backend.
> Only backend code changes require `--build backend`.

---

## Website Embed

Add to every page of your website (e.g. in WordPress footer or `functions.php`):

```html
<script>
  window.__LIVE_CHAT_CONFIG__ = { backendUrl: 'https://chat.yourdomain.com' };
</script>
<script src="https://chat.yourdomain.com/widget/widget.js" async></script>
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
- [ ] VPS running Ubuntu
- [ ] Docker installed
- [ ] Nginx installed
- [ ] A record `chat.yourdomain.com` → VPS IP
- [ ] SSL cert issued via Certbot
- [ ] Nginx proxy config active

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
