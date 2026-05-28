# 雲端高可用性部署架構說明

## 概覽

本專案採用多層雲端服務實現高可用性（High Availability）部署，確保單一元件故障時系統仍可正常運作。整體架構涵蓋前端靜態託管、負載平衡、多後端實例、以及高可用資料庫。

---

## 部署架構圖

```
使用者瀏覽器
      │
      ▼
┌─────────────────────────────────────────┐
│  Vercel (Frontend)                      │
│  performance-management-system-cnad     │
│  .vercel.app                            │
│  React + Vite 靜態部署，全球 CDN         │
└────────────────────┬────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────┐
│  Railway - Nginx Load Balancer          │
│  disciplined-renewal-production         │
│  .up.railway.app                        │
│  Docker (nginx:alpine)                  │
│  Round-Robin 負載平衡 + 自動 Failover    │
└──────────┬──────────────────┬───────────┘
           │ HTTPS            │ HTTPS
           ▼                  ▼
┌──────────────────┐ ┌──────────────────┐
│  Railway         │ │  Railway         │
│  Backend-1       │ │  Backend-2       │
│  performance-    │ │  vibrant-        │
│  management-     │ │  enthusiasm-     │
│  system-cnadfinal│ │  production-7685 │
│  project-prod    │ │  .up.railway.app │
│  .up.railway.app │ │                  │
│  Node.js+Express │ │  Node.js+Express │
│  Docker          │ │  Docker          │
└────────┬─────────┘ └────────┬─────────┘
         │                    │
         └─────────┬──────────┘
                   │ PostgreSQL
                   ▼
┌─────────────────────────────────────────┐
│  Supabase PostgreSQL                    │
│  高可用資料庫（主從複製）                  │
│  Transaction Pooler: port 6543          │
│  Session Pooler: port 5432 (migrate用)  │
└─────────────────────────────────────────┘
```

---

## 各元件說明

### 1. 前端 — Vercel

| 項目 | 內容 |
|------|------|
| 平台 | Vercel (Hobby) |
| 框架 | React + Vite |
| Branch | Cloud |
| Root Directory | `performance-system/frontend` |
| 環境變數 | `VITE_API_BASE_URL=https://disciplined-renewal-production.up.railway.app` |
| URL | https://performance-management-system-cnad.vercel.app |

Vercel 提供全球 CDN 分發，前端靜態資源自動快取於各節點，本身即具備高可用性。

---

### 2. 負載平衡器 — Nginx on Railway

| 項目 | 內容 |
|------|------|
| 平台 | Railway |
| 映像檔 | nginx:alpine (Docker) |
| Branch | Cloud |
| Root Directory | `performance-system/nginx` |
| Port | 80 |
| URL | https://disciplined-renewal-production.up.railway.app |

**nginx.conf 核心設定：**

```nginx
upstream backend {
    server performance-management-system-cnadfinalproject-production.up.railway.app:443;
    server vibrant-enthusiasm-production-7685.up.railway.app:443;
}

server {
    listen 80;

    location / {
        proxy_pass https://backend;
        proxy_ssl_server_name on;
        proxy_set_header Host performance-management-system-cnadfinalproject-production.up.railway.app;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;

        # 遇到錯誤自動切換到另一個 backend
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
    }

    location /nginx-health {
        return 200 'ok';
    }
}
```

**HA 機制：** `proxy_next_upstream` 設定確保當某個 backend 回傳 5xx 錯誤或連線逾時，Nginx 自動將請求轉發至另一個 backend，使用者不會感知到故障。

---

### 3. 後端 — Node.js on Railway（雙實例）

| 項目 | Backend-1 | Backend-2 |
|------|-----------|-----------|
| 平台 | Railway | Railway |
| 映像檔 | node:20-slim (Docker) | node:20-slim (Docker) |
| Branch | Cloud | Cloud |
| Root Directory | `performance-system/backend` | `performance-system/backend` |
| Port | 3001 | 3001 |
| URL | performance-management-system-cnadfinalproject-production.up.railway.app | vibrant-enthusiasm-production-7685.up.railway.app |

**後端環境變數：**

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | Supabase Session Pooler URL (port 5432，migrate 用) |
| `DIRECT_URL` | Supabase Transaction Pooler URL (port 6543，runtime 用) |
| `JWT_SECRET` | JWT 簽名金鑰 |
| `JWT_EXPIRES_IN` | Token 有效期（7d） |
| `PORT` | 3001 |
| `NODE_ENV` | production |
| `CORS_ORIGINS` | https://performance-management-system-cnad.vercel.app |

**後端 Dockerfile：**

```dockerfile
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
```

**設計重點：**
- 使用 `node:20-slim` 而非 `alpine`，確保 Prisma 所需的 OpenSSL 可用
- Build 時使用 placeholder DATABASE_URL，避免 `prisma generate` 失敗
- 啟動時執行 `prisma migrate deploy` 確保 schema 最新
- `.dockerignore` 排除 `.env`，避免本地環境變數覆蓋 Railway 設定

**HA 機制：** 兩個實例完全獨立，stateless 設計（JWT 無需 session 共享），任一實例故障不影響另一個。

---

### 4. 資料庫 — Supabase PostgreSQL

| 項目 | 內容 |
|------|------|
| 平台 | Supabase |
| 引擎 | PostgreSQL 15 |
| HA | 主從複製（Supabase 內建） |
| Migration 連線 | Session Pooler (port 5432) |
| Runtime 連線 | Transaction Pooler (port 6543, pgbouncer) |

**連線策略：**
- `DATABASE_URL`（port 5432）：用於 `prisma migrate deploy`，Session pooler 支援 DDL 語句
- `DIRECT_URL`（port 6543）：用於 runtime 查詢，Transaction pooler 效能更好，支援高併發
- 連線字串加上 `?pgbouncer=true&connection_limit=1` 避免 pgbouncer 連線耗盡

---

## HA 驗證方式

停掉 Backend-1，前端仍可正常運作：

1. 進入 Railway → Backend-1 service → 點 **Sleep** 或暫停
2. 開啟前端 https://performance-management-system-cnad.vercel.app
3. 登入、操作功能，確認一切正常
4. Nginx 的 `proxy_next_upstream` 自動將所有流量導向 Backend-2
5. 恢復 Backend-1，流量恢復 round-robin 分配

---

## 本地開發 vs 雲端部署對比

| 項目 | 本地開發 | 雲端部署 |
|------|---------|---------|
| 資料庫 | Docker PostgreSQL (port 5432) | Supabase (HA) |
| 後端 | 單一 `node src/index.js` | 雙 Railway instance |
| 前端 | Vite dev server (port 5173) | Vercel CDN |
| 負載平衡 | 無 | Nginx on Railway |
| 啟動方式 | `docker-compose up` | 自動 CI/CD (push to Cloud branch) |

---

## CI/CD 流程

```
git push origin Cloud
        │
        ├──▶ Railway (Backend-1) 自動 redeploy
        ├──▶ Railway (Backend-2) 自動 redeploy
        ├──▶ Railway (Nginx LB) 自動 redeploy
        └──▶ Vercel (Frontend) 自動 redeploy
```

每次推送到 `Cloud` branch，四個服務全部自動重新部署，無需手動操作。
