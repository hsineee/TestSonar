# 測試文件 — Performance Management System

## 測試層次總覽

| 層次 | 工具 | 需要啟動服務 | 指令 |
|------|------|------------|------|
| Unit Test | Jest + mock | ❌ | `npm test` |
| Integration Test | Jest + Supertest | ❌ | `npm test` |
| E2E Test | Playwright | ✅ 前後端都要 | `npx playwright test` |
| 手動 API 測試 | curl | ✅ 後端要 | 見下方 |

---

## 快速開始

### 前置：確認服務都在跑

```bash
# 啟動資料庫
docker start perf_db

# 啟動後端（terminal 1）
cd backend
npm run dev

# 啟動前端（terminal 2）
cd frontend
npm run dev

# 確認後端正常
curl http://localhost:3001/health
# 預期：{"status":"ok"}
```

---

## 一、自動化測試（Jest）

不需要啟動任何服務，直接跑。

```bash
cd backend

# 跑所有測試（unit + integration）
npm test

# 只跑 unit test
npm run test:unit

# 只跑 integration test
npm run test:integration

# 產生覆蓋率報告
npm run test:coverage
```

### 測試檔案

```
backend/src/__tests__/
├── unit/
│   ├── goalService.test.js      (17 個) — 目標商業邏輯
│   ├── authService.test.js      (6 個)  — 登入驗證邏輯（含停用帳號檢查）
│   ├── kpiService.test.js       (5 個)  — KPI 建立與查詢
│   ├── auditService.test.js     (1 個)  — Audit Log 寫入
│   ├── reviewService.test.js    (3 個)  — 績效評估與落差分析邏輯
│   ├── disputeService.test.js   (9 個)  — 績效異議發起與裁定邏輯
│   └── userService.test.js      (13 個) — 使用者管理與權限邏輯
└── integration/
    ├── routes.test.js           (10 個) — HTTP 401/403 行為
    └── dashboardRoutes.test.js         — 儀表板路由行為
```

### 覆蓋率目標（實際結果）

| 指標 | 目標 | 實際 |
|------|------|------|
| Statements | ≥ 80% | 97% |
| Branches | ≥ 70% | 90% |
| Functions | ≥ 80% | 93% |
| Lines | ≥ 80% | 97% |

### Unit Test 測試案例

**goalService — createGoal**

| 測試案例 | 驗證重點 |
|---------|---------|
| 成功建立目標 | goalRepo.create 被呼叫、寫入 GOAL_CREATED audit log |
| KPI 不存在 | 拋 404，goalRepo.create 不被呼叫 |
| specific 欄位為空 | 拋 400（Zod 先擋） |
| dueDate 格式錯誤 | 拋 400 |

**goalService — updateProgress**

| 測試案例 | 驗證重點 |
|---------|---------|
| 進度 60 | status 維持 ACTIVE |
| 進度 100 | status 自動轉 COMPLETED |
| 進度 101 | 拋 400 |
| 進度 -1 | 拋 400 |
| 非擁有者更新 | 拋 403 |
| 目標不存在 | 拋 404 |
| REJECTED 目標更新進度 | 拋 400 |

**goalService — rejectGoal**

| 測試案例 | 驗證重點 |
|---------|---------|
| 成功退回直屬員工目標 | status = REJECTED、寫入 GOAL_REJECTED audit log |
| 非直屬員工 | 拋 403，goalRepo.reject 不被呼叫 |
| 目標不存在 | 拋 404 |
| 退回理由為空 | 拋 400 |

**goalService — getTeamGoals**

| 測試案例 | 驗證重點 |
|---------|---------|
| 2 個下屬，1 人有目標 | percentage = 50% |
| 沒有下屬 | percentage = 0（不除以零） |

**authService**

| 測試案例 | 驗證重點 |
|---------|---------|
| 正確帳密 | 回傳 token + user |
| 使用者不存在 | 拋 401 |
| 密碼錯誤 | 拋 401 |
| email 格式錯誤 | 拋 400 |
| password 為空 | 拋 400 |
| 帳號已停用（isActive = false） | 拋 403，訊息「帳號已停用，請聯絡 HR」|

**Integration Test — HTTP 行為**

| 路由 | Token | 預期 | 說明 |
|------|-------|------|------|
| POST /api/auth/login | 無 | 200 | 正確帳密 |
| POST /api/auth/login | 無 | 401 | 密碼錯誤 |
| GET /api/goals | 無 | 401 | 缺少 token |
| GET /api/goals | EMPLOYEE | 200 | 正常存取 |
| POST /api/goals | MANAGER | 403 | 角色不符 |
| GET /api/goals/team | EMPLOYEE | 403 | 角色不符 |
| GET /api/goals/team | MANAGER | 200 | 正常存取 |
| PATCH /api/goals/:id/reject | EMPLOYEE | 403 | 角色不符 |
| POST /api/kpis | EMPLOYEE | 403 | 角色不符 |
| POST /api/kpis | HR | 201 | 成功建立 |

**reviewService — createReview & updateReviewStatus**

| 測試案例 | 驗證重點 |
|---------|---------|
| 成功建立主管他評，並自動執行落差分析 | 確認撈取自評，並驗證 `gapAnalysis` 產出【數據不一致】與【認知落差】警告 |
| 員工自評不執行落差分析 | 確認 `userId === reviewerId` 時跳過比對，且寫入對應 Audit Log |
| 更新考評狀態 | 驗證狀態成功更新為 COMPLETED 並寫入 Audit Log |

---

**disputeService — fileDispute**

| 測試案例 | 驗證重點 |
|---------|---------|
| 成功發起異議 | `disputeRepo.create` 被呼叫、目標狀態更新為 `DISPUTED`、寫入 `DISPUTE_FILED` audit log |
| 目標不存在 | 拋 404，`disputeRepo.create` 不被呼叫 |
| 非目標擁有者發起異議 | 拋 403（`goal.userId !== employeeId`） |
| 目標狀態非 REJECTED | 拋 400（`Only REJECTED goals can be disputed`） |
| 同季度已有異議記錄 | 拋 409（`already filed a dispute this quarter`） |
| goalId 或 reason 為空 | 拋 400（Zod 驗證失敗） |

**disputeService — resolveDispute**

| 測試案例 | 驗證重點 |
|---------|---------|
| 上位主管成功裁定 | `disputeRepo.resolve` 被呼叫、目標狀態更新為 `DISPUTE_RESOLVED`、寫入 `DISPUTE_RESOLVED` audit log |
| 異議不存在 | 拋 404 |
| 異議已裁定（status ≠ PENDING） | 拋 409（`already been resolved`） |
| 直屬主管嘗試裁定 | 拋 403（`resolverId === directManagerId`） |
| 非上位主管嘗試裁定 | 拋 403（`directManager.managerId !== resolverId`） |
| finalScore 超出 0–100 範圍 | 拋 400（Zod 驗證失敗） |

---

**userService — listUsers**

| 測試案例 | 驗證重點 |
|---------|---------|
| HR 呼叫 | 回傳全部使用者（不分部門） |
| MANAGER 呼叫 | 僅回傳同部門管理鏈（BFS）內的使用者；其他部門成員不出現 |
| MANAGER 無下屬 | 回傳空陣列 |
| EMPLOYEE 呼叫 | 拋 403 |

**userService — createUser**

| 測試案例 | 驗證重點 |
|---------|---------|
| 成功建立使用者 | `userRepo.createUser` 被呼叫（含 bcryptjs 雜湊密碼）、寫入 `USER_CREATED` audit log |
| Email 已存在 | 拋 409（`Email already exists`） |
| 缺少必填欄位（name/email/password/role）| 拋 400 |

**userService — updateUser**

| 測試案例 | 驗證重點 |
|---------|---------|
| 成功更新使用者資料 | `userRepo.updateUser` 被呼叫、寫入 `USER_UPDATED` audit log |
| 目標使用者不存在 | 拋 404 |

**userService — deactivateUser / activateUser**

| 測試案例 | 驗證重點 |
|---------|---------|
| 成功停用帳號 | `userRepo.setActive(id, false)` 被呼叫、寫入 `USER_DEACTIVATED` audit log |
| HR 嘗試停用自己的帳號 | 拋 400（`Cannot deactivate your own account`） |
| 停用目標使用者不存在 | 拋 404 |
| 成功啟用帳號 | `userRepo.setActive(id, true)` 被呼叫、寫入 `USER_ACTIVATED` audit log |
| 啟用目標使用者不存在 | 拋 404 |

---

## 二、E2E 測試（Playwright）

需要後端（port 3001）和前端（port 5173）都在跑。

```bash
cd frontend

# 跑所有 E2E 測試
npx playwright test --project=chromium

# 只跑 auth 測試
npx playwright test e2e/auth.spec.js --project=chromium

# 只跑 goals 測試
npx playwright test e2e/goals.spec.js --project=chromium
```

> 注意：goals.spec.js 每次執行前會自動呼叫 `POST /test/reset` 清除測試資料，確保測試結果一致。

### 測試案例

**auth.spec.js（5 個）**

| 測試案例 | 說明 |
|---------|------|
| 登入頁面顯示正確標題 | 看到「績效管理系統」 |
| 密碼錯誤顯示錯誤訊息 | 看到「Invalid credentials」 |
| EMPLOYEE 登入 → GoalDashboard | 看到「我的目標」 |
| MANAGER 登入 → TeamOverview | 看到「團隊目標總覽」 |
| 登出後回到登入頁 | 看到登入表單 |

**goals.spec.js（4 個）**

| 測試案例 | 說明 |
|---------|------|
| EMPLOYEE 可以看到目標列表 | 目標列表正常顯示 |
| EMPLOYEE 可以新增目標 | 填寫 SMART 表單後出現在列表 |
| MANAGER 可以看到 KPI 對齊率 | 對齊率百分比正常顯示 |
| MANAGER 可以退回員工目標 | 退回原因顯示在目標卡片 |

**dashboard.spec.js（9 個）**

| 測試案例 | 說明 |
|---------|------|
| 績效儀表板顯示與權限 | 確認 MANAGER 可見並進入儀表板，HR 不可見 |
| 動態圖表與篩選 | 確保四張摘要卡片與目標狀態分布圖能依「季度」正確更新 |
| 明細表格渲染 | 確認 Team 成員績效明細能正常渲染 |

**review.spec.js（1 個）**

| 測試案例 | 說明 |
|---------|------|
| 雙軌績效評估與落差分析 | 模擬員工提交高分自評、主管提交低分他評，驗證儀表板是否自動顯示橘色認知落差警告 |

---

## 三、手動 API 測試

### 步驟 1：取得 Token

```bash
TOKEN_EMP=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@test.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

TOKEN_MGR=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@test.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

TOKEN_HR=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hr@test.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "EMP: $(echo $TOKEN_EMP | cut -c1-20)..."
echo "MGR: $(echo $TOKEN_MGR | cut -c1-20)..."
echo "HR:  $(echo $TOKEN_HR | cut -c1-20)..."
```

### 步驟 2：取得測試用 ID

```bash
# 取得 KPI ID（建立目標時需要）
KPI_ID=$(curl -s http://localhost:3001/api/kpis \
  -H "Authorization: Bearer $TOKEN_EMP" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
echo "KPI_ID: $KPI_ID"

# 取得 GOAL ID（更新進度 / 退回時需要）
GOAL_ID=$(curl -s http://localhost:3001/api/goals \
  -H "Authorization: Bearer $TOKEN_EMP" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
echo "GOAL_ID: $GOAL_ID"
```

### Auth 測試

| # | 說明 | 指令 | 預期 |
|---|------|------|------|
| A1 | 正常登入 | 見步驟 1 | 200 + token |
| A2 | 密碼錯誤 | `curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"employee@test.com","password":"wrong"}'` | 401 |
| A3 | Email 格式錯誤 | `curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"notanemail","password":"123"}'` | 400 |

### KPI 測試

| # | 說明 | 指令 | 預期 |
|---|------|------|------|
| K1 | 取得 KPI 清單 | `curl -s http://localhost:3001/api/kpis -H "Authorization: Bearer $TOKEN_EMP" \| python3 -m json.tool` | 200 + 陣列 |
| K2 | 依季度篩選 | `curl -s "http://localhost:3001/api/kpis?quarter=2026Q2" -H "Authorization: Bearer $TOKEN_EMP" \| python3 -m json.tool` | 200 + 當季 KPI |
| K3 | HR 建立 KPI | `curl -s -X POST http://localhost:3001/api/kpis -H "Authorization: Bearer $TOKEN_HR" -H "Content-Type: application/json" -d '{"title":"新KPI","quarter":"2026Q2"}' \| python3 -m json.tool` | 201 |
| K4 | EMPLOYEE 建立 KPI | 同上換 `$TOKEN_EMP` | 403 |
| K5 | 無 token | `curl -s http://localhost:3001/api/kpis` | 401 |

### Goals — EMPLOYEE 操作

| # | 說明 | 指令 | 預期 |
|---|------|------|------|
| G1 | 取得自己目標 | `curl -s http://localhost:3001/api/goals -H "Authorization: Bearer $TOKEN_EMP" \| python3 -m json.tool` | 200 + 陣列 |
| G2 | 建立目標 | 見下方 | 201 + 新目標 |
| G3 | 缺少 SMART 欄位 | 省略 specific | 400 |
| G4 | KPI 不存在 | kpiId 給假值 | 404 |
| G5 | 更新進度 60 | `curl -s -X PATCH http://localhost:3001/api/goals/$GOAL_ID/progress -H "Authorization: Bearer $TOKEN_EMP" -H "Content-Type: application/json" -d '{"progress":60}' \| python3 -m json.tool` | 200 + ACTIVE |
| G6 | 更新進度 100 | 同上 progress 改 100 | 200 + COMPLETED |
| G7 | 進度超過 100 | progress 給 101 | 400 |

**建立目標完整指令：**

```bash
GOAL_ID=$(curl -s -X POST http://localhost:3001/api/goals \
  -H "Authorization: Bearer $TOKEN_EMP" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"完成 Q2 技術分享\",
    \"specific\": \"準備並發表一場關於微服務架構的技術分享\",
    \"measurable\": \"完成 30 頁簡報，出席人數超過 10 人\",
    \"achievable\": \"利用每週五下午 2 小時準備\",
    \"relevant\": \"對應本季 KPI：微服務架構遷移規劃\",
    \"dueDate\": \"2026-06-30T00:00:00.000Z\",
    \"kpiId\": \"$KPI_ID\"
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "GOAL_ID: $GOAL_ID"
```

### Goals — MANAGER 操作

| # | 說明 | 指令 | 預期 |
|---|------|------|------|
| M1 | 查看團隊目標 + alignment | `curl -s http://localhost:3001/api/goals/team -H "Authorization: Bearer $TOKEN_MGR" \| python3 -m json.tool` | 200 + alignment % |
| M2 | EMPLOYEE 存取 team | 同上換 `$TOKEN_EMP` | 403 |
| M3 | 退回直屬員工目標 | `curl -s -X PATCH http://localhost:3001/api/goals/$GOAL_ID/reject -H "Authorization: Bearer $TOKEN_MGR" -H "Content-Type: application/json" -d '{"reason":"目標不夠具體"}' \| python3 -m json.tool` | 200 + REJECTED |
| M4 | 退回理由為空 | reason 給空字串 | 400 |

### 邊界條件

| # | 說明 | 指令 | 預期 |
|---|------|------|------|
| E1 | 無 token | `curl -s http://localhost:3001/api/goals` | 401 |
| E2 | 無效 token | `curl -s http://localhost:3001/api/goals -H "Authorization: Bearer invalid.token"` | 401 |
| E3 | 健康檢查 | `curl -s http://localhost:3001/health` | 回傳 `status: ok`，並包含 `supportedLocales`、`timestamp` |

---

## 四、DB 資料查詢

```bash
cd backend

# 查看所有 table
node scripts/db-query.js

# 只看特定 table
node scripts/db-query.js users
node scripts/db-query.js kpis
node scripts/db-query.js goals
node scripts/db-query.js audit
```

## 五、重置 DB

```bash
cd backend
npx prisma migrate reset --force && node prisma/seed.js
```

---

## 測試帳號

### 部門A

| Email | 密碼 | 角色 | 說明 |
|-------|------|------|------|
| upper-manager@test.com | password123 | MANAGER | 上位主管，可裁定部門A的績效異議 |
| manager@test.com | password123 | MANAGER | 直屬主管，管理 employee / employee2 |
| employee@test.com | password123 | EMPLOYEE | 直屬員工 |
| employee2@test.com | password123 | EMPLOYEE | 直屬員工 |

階層：`upper-manager` → `manager` → `employee`, `employee2`

### 部門B

| Email | 密碼 | 角色 | 說明 |
|-------|------|------|------|
| manager-b@test.com | password123 | MANAGER | 部門B 主管，只能查看部門B 員工 |
| employee-b@test.com | password123 | EMPLOYEE | 部門B 員工 |

### 管理帳號

| Email | 密碼 | 角色 | 說明 |
|-------|------|------|------|
| hr@test.com | password123 | HR | 管理所有使用者帳號與 KPI（跨部門唯讀）|

> 部門A 與 部門B 的主管**無法跨部門**存取對方的員工資料。
