# Regulatory Review Tool - SaaS 轉型路線圖

## 🎯 目標：從內部工具 → 雲端 SaaS 產品

---

## Phase 1: 雲端部署 (Week 1)

### 任務清單
- [x] 建立 GitHub Repository ✅
- [ ] 建立 `requirements.txt` 和 `Dockerfile`
- [ ] 部署到 Render/Railway/Fly.io
- [ ] 設定自定義網域名 (可選)
- [ ] 建立環境變數配置

### 技術細節
- 使用 Streamlit 原生部署
- PostgreSQL 資料庫 (Supabase)
- 環境變數管理 API keys

---

## Phase 2: 多租戶 + 專案 CRUD (Week 2)

### 任務清單
- [ ] 實作用戶註冊/登入系統
- [ ] 公司/租戶隔離機制
- [ ] 專案 CRUD (創建、讀取、更新、刪除)
- [ ] 從 JSON 遷移到 PostgreSQL

### 技術細節
- Streamlit-Authenticator 或自建 FastAPI 後端
- 每個公司獨立的資料表
- 角色權限 (管理員、提交者、審核者)

---

## Phase 3: 測試套件 (Week 3)

### 任務清單
- [ ] 單元測試 (pytest)
- [ ] 法規邏輯測試
- [ ] 風險評估算法測試
- [ ] 成本追蹤測試
- [ ] CI/CD 整合 (GitHub Actions)

### 技術細節
- pytest + coverage
- 測試資料工廠
- 自動化測試流程

---

## Phase 4: AI 文件分析 (Week 4-6)

### 任務清單
- [ ] 整合 Claude/GPT API
- [ ] PDF/Word 文件解析
- [ ] 自動缺口分析
- [ ] 生成審查報告

### 技術細節
- LangChain 文件處理
- 向量資料庫儲存 TFDA 法規
- RAG (Retrieval Augmented Generation)

---

## Phase 5: 試點 + 收費 (Week 7-8)

### 任務清單
- [ ] 邀請 3 位 RA 顧問試用
- [ ] 收集反饋和改進
- [ ] Stripe 支付整合
- [ ] 定價策略實施
- [ ] 第一個付費客戶

---

## 📋 優先級

| 優先級 | 項目 | 原因 |
|--------|------|------|
| 🔴 P0 | 雲端部署 | 解除分發限制，所有後續工作的基礎 |
| 🔴 P0 | 驗證系統 | 無法收費的核心障礙 |
| 🟠 P1 | 資料庫遷移 | 支援多用戶的必要條件 |
| 🟠 P1 | 測試套件 | 合規工具的質量保證 |
| 🟡 P2 | AI 分析 | 差異化競爭優勢 |
| 🟢 P3 | 支付系統 | 變現的最後一步 |

---

## 💰 定價策略 (建議)

| 方案 | 月費 | 功能 |
|------|------|------|
| **Basic** | NT$2,000 | 單一專案、基礎檢查清單 |
| **Pro** | NT$5,000 | 多專案、AI 分析、Email 提醒 |
| **Enterprise** | NT$15,000+ | RA 顧問多客戶管理、API 訪問 |

---

*建立時間: 2026-03-24*
*下次檢視: 2026-03-31*
