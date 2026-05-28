# 全球化企業現代化績效管理系統

Performance Management System — Phase 1

雲原生應用程式開發 | 第二組 | 2026

---

## 目錄

1. [系統架構](#系統架構)
2. [技術選型](#技術選型)
3. [環境架設](#環境架設)
4. [功能說明](#功能說明)
5. [API 規格](#api-規格)
6. [測試](#測試)
7. [測試帳號](#測試帳號)
8. [專案結構](#專案結構)

---

## 系統架構

Phase 1 採用 **Modular Monolith（模組化單體）** 架構，嚴格遵守分層設計，為 Phase 2 微服務拆分預留擴充空間。

```
┌─────────────────────────────────────────┐
│  Frontend (React + Vite)  :5173         │
│  LoginPage / GoalDashboard /            │
│  TeamOverview / KpiManagement /         │
│  UserManagement / PerformanceDashboard  │
│  TemplateManagement / PeriodManagement  │
│  AuditLogs / CalibrationDashboard       │
└──────────────────┬──────────────────────┘
                   │ HTTP (axios)
┌──────────────────▼──────────────────────┐
│  Backend (Node.js + Express)  :3001     │
│                                         │
│  Router → authMiddleware                │
│         → rbacMiddleware                │
│         → Controller                    │
│         → Service（商業邏輯）             │
│         → Repository（資料存取）          │
└──────────────────┬──────────────────────┘
                   │ Prisma ORM
┌──────────────────▼──────────────────────┐
│  PostgreSQL 15  :5432  (Docker)         │
└─────────────────────────────────────────┘
```

### 分層職責

| 層次 | 職責 | 技術 |
|------|------|------|
| UI Layer | 渲染畫面、發送 API 請求 | React + Vite |
| Presentation Layer | 驗證 JWT、角色授權、解析 req | Express Middleware + Controller |
| Service Layer | 商業邏輯、Zod 驗證、Audit Log | Node.js |
| Repository Layer | 資料存取，封裝所有 SQL | Prisma ORM |
| Data Layer | 持久化儲存 | PostgreSQL 15 |

---

## 技術選型

| 類別 | 技術 | 版本 |
|------|------|------|
| Frontend | React + Vite | React 18 / Vite 8 |
| HTTP Client | axios | 1.6+ |
| Backend | Node.js + Express | Node 20 / Express 4 |
| Validation | Zod | 3.22+ |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 15 |
| Auth | JWT + bcrypt | jsonwebtoken 9 |
| Testing (Backend) | Jest + Supertest | Jest 29 |
| Testing (Frontend) | Vitest + @testing-library/react | Vitest 1.x |
| E2E Testing | Playwright | 1.40+ |
| Container | Docker | - |
| Logging | Winston + Morgan | Winston 3 |

---

## 環境架設

### 前置需求

- Node.js 20+
- Docker
- npm

### 1. Clone 專案

```bash
git clone <repo-url>
cd performance-system
```

### 2. 設定環境變數

將根目錄的範本複製為後端環境變數檔：

```bash
cp .env.example backend/.env
```

`backend/.env` 內容（預設值可直接使用）：

```
DATABASE_URL=postgresql://perfuser:perfpass@localhost:5432/perfdb
JWT_SECRET=supersecretkey_change_in_production
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
```

### 3. 啟動 PostgreSQL

```bash
docker run -d \
  --name perf_db \
  -e POSTGRES_USER=perfuser \
  -e POSTGRES_PASSWORD=perfpass \
  -e POSTGRES_DB=perfdb \
  -p 5432:5432 \
  postgres:15-alpine
```

> 之後重啟只需要：`docker start perf_db`

### 4. 初始化資料庫

```bash
cd backend
npm install
npx prisma migrate dev --name init
node prisma/seed.js
```

### 5. 啟動後端

```bash
cd backend
npm run dev
# Server running on port 3001
```

### 6. 啟動前端（另開 terminal）

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

### 7. 確認服務正常

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```

打開瀏覽器 `http://localhost:5173`，用測試帳號登入即可使用。

---

## 功能說明

### 四種角色

| 角色 | 登入後頁面 | 功能 |
|------|-----------|------|
| EMPLOYEE | GoalDashboard | 建立個人目標（綁定 KPI）、儲存草稿、編輯／刪除草稿、提交草稿、更新進度（附備註）、查看進度記錄、查看退回原因、發起績效異議 |
| MANAGER | TeamOverview / KpiManagement / PerformanceDashboard | 查看**同部門管理鏈**內員工目標、KPI 對齊率、退回不合規目標、填寫員工績效評估、查看多維度績效橫向校準儀表板；**建立 / 管理屬於自己的 KPI**（兩欄分割視圖：左欄顯示上級指派、右欄顯示自建） |
| MANAGER（上位主管） | TeamOverview / KpiManagement | 同 MANAGER，另可查看並裁定下屬員工提出的績效異議，支援跨層級 Drill-down 查詢（遞迴管理鏈）；可新增 KPI 供下屬主管參考（單欄視圖） |
| HR | UserManagement / TemplateManagement / PeriodManagement | 建立、編輯、停用／啟用使用者帳號，指派角色與主管；**管理「評估模板」**（維度 CRUD）；**管理「績效週期」**（季度 CRUD）；透過「後端紀錄」按鈕查看不可竄改的系統審計日誌 |

### 部門隔離與階層存取

系統採用**獨立 Department 模型**管理部門，並實作嚴格的資料隔離規則：

| 角色 | 可查看範圍 | 操作範圍 |
|------|-----------|---------|
| EMPLOYEE | 僅自己 | 僅自己的目標與自評 |
| MANAGER | 整條管理鏈向下（BFS 遞迴），限**同部門** | 評分與退回僅限**直接**下屬（一層） |
| HR | 全部使用者（跨部門，唯讀） | 無評分功能；管理帳號、評估模板、績效週期；唯讀審計日誌 |

**遞迴管理鏈（BFS）**：上位主管可見範圍透過廣度優先搜尋逐層擴展，每層執行一次批次查詢（避免 N+1），最終取得管理鏈內所有員工 ID，再以部門欄位做最後篩選，確保不跨部門存取。

**帳號停用機制**：HR 可停用帳號（`isActive = false`），停用後立即禁止該帳號登入，登入時系統回傳「帳號已停用，請聯絡 HR」錯誤（HTTP 403）。

### HR 管理功能

HR 角色登入後有三個主要分頁，另有「後端紀錄」小按鈕切換至審計日誌：

**Tab 1 — 使用者管理**：
- 使用者列表，欄位：姓名 | Email | 角色 | 部門 | 職級 | 主管 | 狀態 | 操作
- 依姓名／Email 文字搜尋，依角色與部門篩選
- 新增使用者：填寫 name、email、密碼、role、部門（下拉）、職級、主管（同部門 Manager 下拉）
- 編輯使用者：修改 name、role、部門、職級、主管（Email 不可更改）
- 啟用／停用帳號（含確認對話框）

**Tab 2 — 評估模板管理**：
- 新增 / 編輯 / 刪除評估模板（ReviewTemplate）
- 每個模板可設定多個評估維度（name + type: quantitative / qualitative）
- 模板供主管的「績效評估」及「校準儀表板」使用（校準維度選單自動同步模板內容）

**Tab 3 — 績效週期管理**：
- 新增 / 刪除績效週期（格式：`YYYYQ1–Q4`，如 `2026Q2`）
- 主管建立 KPI 時，季度下拉選單只顯示 HR 預設的週期

**後端紀錄（審計日誌）**：
- 不可竄改的操作日誌，可依動作類型 / 操作者篩選
- 支援分頁，可展開查看每筆操作的 metadata 細節


### SMART 目標格式

員工建立目標時必須填寫完整 SMART 欄位：

| 欄位 | 說明 |
|------|------|
| Specific | 具體描述目標內容 |
| Measurable | 可量化的衡量指標 |
| Achievable | 達成方式與計畫 |
| Relevant | 與 KPI 的關聯說明 |
| Time-bound | 截止日期（dueDate） |

### 目標狀態流程

```
建立（草稿）→ DRAFT
               │
               ├─ 編輯草稿    → DRAFT
               ├─ 刪除草稿    → （移除）
               └─ 提交        → ACTIVE
                                  │
                                  ├─ 更新進度 < 100  → ACTIVE
                                  ├─ 更新進度 = 100  → COMPLETED（自動）
                                  └─ 主管退回        → REJECTED
                                                         │
                                                         └─ 員工發起異議  → DISPUTED
                                                                              │
                                                                              └─ 上位主管裁定 → DISPUTE_RESOLVED

建立（直接提交）→ ACTIVE（跳過草稿）
```

> DRAFT 狀態的目標主管看不到，不計入 KPI 對齊率。

### KPI 對齊率

主管的 TeamOverview 會顯示：
- 直屬員工中，有多少人已設定（且非 REJECTED）目標
- 計算公式：`aligned / total * 100`

### 績效異議機制

員工對 REJECTED 目標每個 KPI 季度只能發起一次正式異議，提交後不可撤回。異議通知繞過直屬主管，由上位主管（直屬主管的主管）負責裁定並提交最終分數（0–100），目標狀態隨之更新為 DISPUTE_RESOLVED。

| 角色 | 操作 |
|------|------|
| EMPLOYEE | 在 GoalDashboard 對 REJECTED 目標點「發起異議」，填寫理由送出 |
| 上位主管（MANAGER） | 在 TeamOverview「待處理異議」區塊，展開查看績效內容與退回原因，輸入裁定分數後確認 |
| 直屬 MANAGER | 不具裁定能力（系統層拒絕） |
| HR | 不具裁定能力 |

### Audit Log

每次重要操作自動寫入，不可修改或刪除：

| 動作 | 觸發時機 |
|------|---------|
| GOAL_CREATED | 員工建立目標 |
| GOAL_PROGRESS_UPDATED | 員工更新進度 |
| GOAL_REJECTED | 主管退回目標 |
| KPI_CREATED | 主管建立 KPI |
| DISPUTE_FILED | 員工發起異議 |
| DISPUTE_RESOLVED | 上位主管提交裁定 |
| USER_CREATED | HR 建立新帳號 |
| USER_UPDATED | HR 修改帳號資料（角色／主管／職級）|
| USER_DEACTIVATED | HR 停用帳號 |
| USER_ACTIVATED | HR 重新啟用帳號 |
| TEMPLATE_CREATED | HR 新增評估模板 |
| TEMPLATE_UPDATED | HR 修改評估模板 |
| TEMPLATE_DELETED | HR 刪除評估模板 |
| PERIOD_CREATED | HR 新增績效週期 |
| PERIOD_DELETED | HR 刪除績效週期 |

### 雙軌績效評估與校準引擎

系統導入「零信任落差分析」機制，確保績效評估的客觀性：
* **雙軌評估**：員工先提交自評（量化實績 + 質化印象），主管隨後提交他評。
* **自動落差分析**：系統會在背景自動比對雙方數據。若量化分數不一致，或質化印象分差距過大，系統會在主管的「橫向校準儀表板」中自動生成【數據不一致】或【認知落差】的橘色警告。
* **動態職級標準 (Level Standards)**：可依據不同職級（如 Junior/Senior）設定專屬的 KPI 門檻，系統會自動判定該員工是否達標。

---

## API 規格

所有 API 需帶 `Authorization: Bearer <token>`（登入除外）。

### Auth

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| POST | /api/auth/login | 所有人 | 登入，回傳 JWT token |
| GET | /api/auth/me | 所有登入者 | 取得當前登入者最新資料（同步 localStorage）|

### Goals

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| GET | /api/goals | ALL | 取得自己的目標列表 |
| POST | /api/goals | EMPLOYEE | 建立新目標（需完整 SMART） |
| PATCH | /api/goals/:id/progress | EMPLOYEE | 更新進度（0–100） |
| GET | /api/goals/team | MANAGER, HR | 取得直屬員工目標 + alignment |
| PATCH | /api/goals/:id/reject | MANAGER | 退回目標（需填理由） |

### Disputes

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| POST | /api/disputes | EMPLOYEE | 發起績效異議（每季度限一次） |
| GET | /api/disputes | MANAGER | 查看待裁定異議（上位主管視角） |
| PATCH | /api/disputes/:id/resolve | MANAGER | 提交最終裁定分數（直屬主管被拒絕） |

### Users

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| GET | /api/users | HR, MANAGER | 取得使用者列表（HR 全部；MANAGER 限同部門管理鏈） |
| POST | /api/users | HR | 建立新使用者帳號 |
| GET | /api/users/managers | HR | 取得指定部門的 MANAGER 清單（供下拉選單）|
| GET | /api/users/:id | 所有登入者 | 查看指定使用者（HR 或本人或管理鏈內）|
| PATCH | /api/users/:id | HR | 更新使用者資料（name/role/level/managerId/departmentId）|
| PATCH | /api/users/:id/deactivate | HR | 停用帳號（isActive = false）|
| PATCH | /api/users/:id/activate | HR | 啟用帳號（isActive = true）|

### Departments

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| GET | /api/departments | 所有登入者 | 取得所有部門清單（供下拉選單）|

### KPIs

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| GET | /api/kpis | ALL | 取得 KPI 清單（可用 ?quarter=2026Q2 篩選） |
| POST | /api/kpis | MANAGER | 建立新 KPI（季度需從 HR 定義的 PerformancePeriod 選取）|

### Review Templates

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| GET | /api/review-templates | ALL | 取得評估模板清單 |
| POST | /api/review-templates | HR | 新增評估模板（含維度定義）|
| PATCH | /api/review-templates/:id | HR | 更新評估模板 |
| DELETE | /api/review-templates/:id | HR | 刪除評估模板 |

### Performance Periods

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| GET | /api/periods | ALL | 取得績效週期清單 |
| POST | /api/periods | HR | 新增績效週期（格式：YYYYQ1–Q4）|
| DELETE | /api/periods/:id | HR | 刪除績效週期 |

### Audit Logs

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| GET | /api/audit-logs | HR | 查詢系統審計日誌（可依 action / userId 篩選；支援分頁）|

### Dashboard

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| GET | /api/dashboard/summary | MANAGER | 取得組織績效統計摘要（可帶 ?quarter 篩選） |
| GET | /api/dashboard/drilldown/:managerId | MANAGER | Drill-down查看特定子經理團隊的績效統計 |

### Reviews & Calibrations

| Method | Endpoint | 角色 | 說明 |
|--------|----------|------|------|
| POST | /api/reviews | ALL | 提交自評或主管他評（自動觸發落差分析） |
| PATCH | /api/reviews/:id/status | MANAGER | 更新評估單狀態 |
| GET | /api/calibrations/dashboard | MANAGER | 取得多維度績效校準儀表板數據 |

---

## 測試

### Jest（Backend Unit + Integration）

```bash
cd backend

# 跑所有測試
npm test

# 跑覆蓋率報告
npm run test:coverage
```

覆蓋率結果（實際）：

| 指標 | 目標 | 實際 |
|------|------|------|
| Statements | ≥ 80% | 97% |
| Branches | ≥ 70% | 89% |
| Functions | ≥ 80% | 93% |
| Lines | ≥ 80% | 97% |

### Vitest（Frontend Unit + Integration）

```bash
cd frontend

# 跑所有測試
npm test

# 跑覆蓋率報告
npm run test:coverage
```


### Playwright（E2E）

需要後端和前端都在跑。

```bash
cd frontend
npx playwright test --project=chromium
```

> 注意：E2E 測試每次執行前會自動重置 DB 中的測試資料（呼叫 POST /test/reset）。

| E2E 測試檔案 | 涵蓋範圍 |
|-------------|----------|
| `auth.spec.js` | 登入 / 登出流程 |
| `goals.spec.js` | SMART 目標 CRUD / 狀態流程 |
| `goal_status_protection.spec.js` | 目標狀態保護（不可重複退回 / 非活躍進度禁改）|
| `dashboard.spec.js` | 績效儀表板狀態分佈 |
| `review.spec.js` | 雙軌評估與校準落差警告 |
| `hr_features.spec.js` | HR 三分頁 CRUD + 審計日誌瀏覽 |
| `kpi_management.spec.js` | Manager 兩欄 KPI 分割視圖 + 新增流程 |

詳細測試案例請參考 [TEST.md](TEST.md)。

---

## 測試帳號

### 部門A

| Email | 密碼 | 角色 | 說明 |
|-------|------|------|------|
| upper-manager@test.com | password123 | MANAGER | 上位主管（管理鏈頂層） |
| manager@test.com | password123 | MANAGER | 直屬主管 |
| employee@test.com | password123 | EMPLOYEE | 員工 |
| employee2@test.com | password123 | EMPLOYEE | 員工 |

階層關係：`upper-manager` → `manager` → `employee`, `employee2`

### 部門B

| Email | 密碼 | 角色 | 說明 |
|-------|------|------|------|
| manager-b@test.com | password123 | MANAGER | 部門B 主管 |
| employee-b@test.com | password123 | EMPLOYEE | 部門B 員工 |

### 管理帳號

| Email | 密碼 | 角色 | 說明 |
|-------|------|------|------|
| hr@test.com | password123 | HR | 管理使用者帳號與 KPI（無部門）|

> 部門A 與 部門B 的主管無法跨部門查看對方的員工資料。

---

## 專案結構

```
performance-system/
├── .env.example              # 環境變數範本
├── README.md
├── TEST.md                   # 完整測試文件
├── architecture.md           # 系統架構詳細說明
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # 資料庫 schema（10 個 model：User/Department/Kpi/Goal/AuditLog/Dispute/PerformanceReview/FeedbackEntry/ReviewTemplate/PerformancePeriod）
│   │   └── seed.js           # 測試帳號（部門A/B）+ KPI + ReviewTemplate + PerformancePeriod 初始資料
│   ├── scripts/
│   │   └── db-query.js       # 終端機查看 DB 資料
│   └── src/
│       ├── middleware/        # authMiddleware / rbacMiddleware / errorMiddleware
│       ├── routes/            # authRoutes / goalRoutes / kpiRoutes / disputeRoutes / userRoutes / departmentRoutes / reviewTemplateRoutes / periodRoutes / auditLogRoutes
│       ├── controllers/       # authController / goalController / kpiController / disputeController / userController / reviewTemplateController / periodController / auditLogController
│       ├── services/          # goalService / authService / kpiService / auditService / disputeService / userService / reviewTemplateService / periodService
│       ├── repositories/      # goalRepo / userRepo / kpiRepo / auditRepo / disputeRepo / departmentRepo / reviewTemplateRepo / periodRepo
│       └── __tests__/
│           ├── unit/          # goalService / authService / kpiService / auditService
│           └── integration/   # routes（HTTP 行為測試）
│
└── frontend/
    ├── e2e/                   # Playwright E2E 測試
    │   ├── auth.spec.js
    │   ├── goals.spec.js
    │   ├── goal_status_protection.spec.js
    │   ├── dashboard.spec.js
    │   ├── review.spec.js
    │   ├── hr_features.spec.js      # HR 三分頁 CRUD + 審計日誌
    │   └── kpi_management.spec.js   # Manager KPI 分割視圖
    └── src/
        ├── api/
        │   ├── client.js      # 核心 API Client（含 getMe / KPI / 模板 / 週期 / 審計日誌端點）
        │   └── dashboard.js   # 儀表板專用 API Client
        ├── __tests__/
        │   ├── setup.js
        │   ├── unit/
        │   │   ├── api.client.test.js           # API Client 所有方法 unit tests
        │   │   ├── dashboard.api.test.js        # Dashboard API Client unit tests
        │   │   ├── pages.render.test.jsx        # 各頁面初始渲染 smoke tests
        │   │   ├── App.test.jsx
        │   │   ├── LoginPage.test.jsx
        │   │   └── LoginPage.behavior.test.jsx
        │   └── integration/
        │       ├── GoalDashboard.test.jsx       # 更新進度、進度記錄自動刷新
        │       ├── PerformanceReview.test.jsx   # 員工自評提交、主管自評紀錄顯示
        │       ├── Calibration.test.jsx         # 職級標準發布（覆蓋舊規則）
        │       ├── CalibrationDashboard.test.jsx
        │       ├── KpiManagement.test.jsx       # 兩欄分割 + 表單驗證
        │       ├── TeamOverview.test.jsx
        │       ├── TemplateManagement.test.jsx
        │       ├── PeriodManagement.test.jsx
        │       ├── AuditLogs.test.jsx           # 篩選 + 分頁 + metadata drawer
        │       ├── App.navigation.test.jsx
        │       ├── PerformanceDashboard.test.jsx
        │       ├── DailyOutput.test.jsx
        │       ├── TeamDailyOutput.test.jsx
        │       └── UserManagement.test.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── GoalDashboard.jsx          # EMPLOYEE 頁面
            ├── TeamOverview.jsx           # MANAGER 頁面（含異議處理）
            ├── PerformanceDashboard.jsx   # 主管分析儀表板
            ├── CalibrationDashboard.jsx   # 主管校準儀表板（多維度落差分析）
            ├── KpiManagement.jsx          # MANAGER — KPI 管理（兩欄分割視圖）
            ├── UserManagement.jsx         # HR — 使用者管理（帳號 CRUD、停用/啟用）
            ├── TemplateManagement.jsx     # HR — 評估模板管理
            ├── PeriodManagement.jsx       # HR — 績效週期管理
            └── AuditLogs.jsx              # HR — 系統審計日誌
```

---

## 常用指令

```bash
# 查看 DB 資料
cd backend && node scripts/db-query.js

# 重置 DB（清空重來）
cd backend && npx prisma migrate reset --force && node prisma/seed.js

# 重啟 PostgreSQL
docker start perf_db
```

---

## Globalization / 多語系支援

本版本新增 Globalization 能力，預設不改變既有繁體中文操作流程，同時可切換英文與日文。

### 前端多語系

- 新增 `frontend/src/i18n/index.js`：集中管理 `zh-TW`、`en-US`、`ja-JP` 語系字典。
- 新增 `frontend/src/components/LanguageSelector.jsx`：在登入頁與各角色主頁右上角提供語言切換。
- 多語系設定會寫入 `localStorage`，重新整理後仍保留使用者偏好。
- 文件方向、`html lang`、placeholder、aria-label 與常見 UI 文字會依語系同步更新。

### Backend Globalization API

新增 `GET /api/globalization`，回傳目前服務端支援的語系、預設時區與本次 request 解析結果。

健康檢查 `GET /health` 現在除了 `status: ok` 外，也會回傳 `supportedLocales`、`timestamp` 與 `uptimeSeconds`。

### 環境變數

可在 `.env` 或 Docker Compose 中設定：

```bash
DEFAULT_LOCALE=zh-TW
SUPPORTED_LOCALES=zh-TW,en-US,ja-JP
DEFAULT_TIMEZONE=Asia/Taipei
CORS_ORIGINS=*

VITE_DEFAULT_LOCALE=zh-TW
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT_MS=8000
```

這份 README 的 `Security` 段落已經非常專業了！為了讓評審或教授在 Demo 時不會被 MFA 擋在門外，我幫你在「環境變數」的上方新增了一個 **「🧪 測試帳號與 MFA 驗證指南」** 的專屬區塊。

因為我沒有看到你 `seed.js` 裡面最終生成的那個 32 字元 Base32 金鑰，所以我在裡面留了一個 `【請填入...】` 的佔位符。**請記得在複製貼上後，把那個括號替換成你實際的金鑰字串！**

你可以直接使用以下這段更新後的完整 Markdown 內容：

---

## Security / 企業級資安與防護架構

本版本導入雲原生架構的高安全性標準，採用無狀態身份驗證、資料庫應用層加密，並落實嚴密的 RBAC 角色存取邊界與多因素認證 (MFA)，確保系統達到企業級防護水準。

### 身份驗證與多因素認證 (Auth & MFA)

* **無狀態 JWT 簽證**：登入成功後核發 JWT Token，符合 12-Factor App 的無狀態 (Stateless) 精神，便於未來微服務水平擴展。
* **強密碼雜湊與即時攔截**：全面採用 `bcryptjs` 進行單向雜湊加密儲存。登入 API 實作 `isActive` 狀態檢查，帳號停用即在第一線阻擋並回傳 HTTP 403 Forbidden。
* **MFA 兩階段驗證 (Phase 2)**：基於 `otplib` 實作符合 RFC 4226 標準的 TOTP 驗證，強制要求 160-bits (32 Bytes) 高強度 Secret Key。
* **階段性權限控管**：MFA 登入流程第一階段僅核發時效極短（5 分鐘）且帶有 `mfaPending: true` 的臨時 Token，嚴格防止未完全驗證的帳號越權存取。

### 應用層欄位級加密 (Field-Level Encryption)

* **AES-256-GCM 軍規加密**：在應用層 (Service/Repo) 將高機敏資料（如：員工姓名、績效總評、落差分析等）加密為 Base64 格式後存入資料庫，徹底防堵底層資料庫外洩風險。
* **全域攔截解密 (Prisma Extensions)**：透過擴充底層 `prismaClient` 實作 `compute` 攔截器，確保所有跨資料表查詢（如 `include` 關聯）皆能自動且透明地完成解密，杜絕各別 API 漏寫解密的風險。
* **Singleton 資料庫連線池**：重構全站 Repository 共用單一 `prismaClient` 實體，避免連線數耗盡，並確保全域解密政策 100% 覆蓋。

### 存取控制與資料隔離 (Access Control & Isolation)

* **嚴格 RBAC 角色管控**：系統明確劃分 `HR`、`MANAGER` 與 `EMPLOYEE` 三種角色，前端路由與後端 API 皆實作相應的權限守門員 (Guard)。
* **Service 層細粒度資料隔離**：針對主管層級實作關聯查詢與遞迴檢查（驗證 `managerId`），確保上位主管僅能存取管理鏈轄下員工之績效資料，有效防止水平與垂直越權 (IDOR)。
* **核心操作稽核 (Audit Log)**：針對目標狀態變更、評估單提交等關鍵操作寫入 Audit Log，確保行為具備可追溯性。

### 測試帳號與 MFA 驗證指南 (Test Accounts & MFA)

為方便系統審查與 Demo 展示，系統已預建多組具有不同權限邊界的測試帳號（密碼皆為 `password123`）。

其中**上位主管**已強制啟用 MFA 多因素認證。測試前，請先於您的 Authenticator App（如 Google Authenticator）手動輸入或綁定以下金鑰，以取得 6 位數動態驗證碼：

* **上位主管 (Upper Manager - MFA 啟用)**
* **帳號**：`upper-manager@test.com`
* **MFA 金鑰 (Secret Key)**：`JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`


* **一般主管 (Manager)**
* 帳號：`manager@test.com` (部門A) / `manager-b@test.com` (部門B)


* **一般員工 (Employee)**
* 帳號：`employee@test.com` (部門A) / `employee-b@test.com` (部門B)


* **系統管理員 (HR)**
* 帳號：`hr@test.com`



### 環境變數

可在 `.env` 中設定相關安全組態，落實組態與程式碼分離原則：

```bash
# JWT 簽證設定
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# 應用層 AES-256-GCM 加密金鑰 (必須為 32 Bytes Base64 字串)
ENCRYPTION_KEY=MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=

```