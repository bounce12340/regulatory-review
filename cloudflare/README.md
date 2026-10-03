# RegReview — Cloudflare 版

TFDA 查驗登記文件審查與進度追蹤平台，部署在 **Cloudflare Workers + D1**。
這是原 Streamlit 版（`scripts/web_dashboard.py`）的 Cloudflare 原生改寫版。原版需要一直執行的 Python 伺服器，無法放上 Cloudflare。

## 架構

```
瀏覽器 ──▶ Cloudflare Worker (regulatory-review)
           ├─ public/            靜態前端（原生 JS，無建置步驟、無外部 CDN）
           ├─ /api/*  src/       TypeScript API（登入、專案、檢查項目、AI 分析）
           ├─ D1 (DB)            SQLite 相容資料庫：公司/使用者/專案/檢查項目/Session
           └─ Anthropic API      AI 缺口分析（金鑰只存在 Worker Secret）
```

| 功能 | 說明 |
|------|------|
| 多租戶帳號 | 註冊公司 → 第一位為管理員；管理員可新增成員／檢視者、停用帳號 |
| 新藥查驗登記審查門檻 | 「新藥查驗登記（化學藥）」類型含 35 項檢查與審查門檻（依 115 年度 CDE 新藥查驗登記說明會整理，見 `docs/NDA_REVIEW_THRESHOLDS.md`）；標記完成前須逐條確認，AI 分析亦逐條比對 |
| 專案管理 | 依申請類型（藥品展延 / 食品登記 / 醫材登記）自動帶入 TFDA 檢查項目，可建立、編輯、結案、封存、刪除 |
| 專案總覽 | KPI、完成度、狀態與風險分布、可直接修改狀態與備註的檢查清單、待辦事項 |
| 風險自動判定 | 範本項目的風險依 `config/regulatory_schemas.yaml` 的 `risk_rules` 隨狀態自動計算；自訂項目可手動設定 |
| 時程 / 多專案比較 | 截止日倒數、完成度與時程消耗對照、健康雷達圖 |
| AI 文件分析 | 上傳 PDF（含掃描檔）、Word .docx、Excel .xlsx、純文字 → Claude 逐項比對檢查清單 → 缺口報告 |
| 匯出 | Markdown、CSV（Excel 可開）、JSON、列印 / 存成 PDF |

## 部署到 Cloudflare

### 方法 A：連結 GitHub 自動部署（推薦）

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Import a repository**，選擇 `regulatory-review`。
2. 建置設定：
   - **Project name**：`regulatory-review`（必須與 `wrangler.jsonc` 的 `name` 相同）
   - **Root directory**：`cloudflare`
   - **Build command**：留空
   - **Deploy command**：`npm run deploy`
3. 儲存後即會部署。第一次部署時 Wrangler 會**自動建立 D1 資料庫** `regulatory-review`，接著自動套用 `migrations/` 內的資料表。
4. 到該 Worker 的 **Settings → Variables and Secrets** 新增 Secret：`ANTHROPIC_API_KEY`（若不需要 AI 分析可略過，該頁會顯示「尚未啟用」）。
5. 打開 `https://regulatory-review.<你的子網域>.workers.dev` 註冊第一個帳號。
6. （建議）完成自己公司的註冊後，把 `wrangler.jsonc` 的 `ALLOW_REGISTRATION` 改成 `"false"` 並推送，之後只能由管理員在「使用者管理」新增成員。

之後每次 push 到 main 都會自動重新部署。

> 若建置紀錄顯示 `d1 migrations apply` 權限不足（Builds 使用的 API token 缺少 D1 編輯權限），可在本機執行一次 `npx wrangler login && npx wrangler d1 migrations apply regulatory-review --remote`，或在 Builds 設定中改用具 D1 Edit 權限的 API token。

### 方法 B：用指令部署

```bash
cd cloudflare
npm ci
npx wrangler login                       # 瀏覽器授權
npm run deploy                           # 部署 + 建立/遷移 D1
npx wrangler secret put ANTHROPIC_API_KEY  # 貼上 Anthropic API 金鑰
```

### 自訂網域

Worker → **Settings → Domains & Routes → Add → Custom domain**，輸入例如 `review.your-company.com`（網域需已在 Cloudflare 託管）。

## 方案與費用注意事項

| 項目 | Workers Free | Workers Paid（US$5/月起） |
|------|--------------|---------------------------|
| 每次請求 CPU 上限 | 10 ms | 30 秒（可調至 5 分鐘） |
| 密碼雜湊（PBKDF2 100,000 次） | 約 45 ms，**會超過上限**導致登入失敗（Error 1102） | 正常 |
| AI 分析大型 PDF | 解析大型上傳內容可能超過 CPU 上限 | 正常 |

- **正式使用建議 Workers Paid。**
- 只想先用免費方案試用：把 `wrangler.jsonc` 的 `PBKDF2_ITERATIONS` 改為 `"10000"`（約 5 ms；密碼雜湊強度較低）。日後升級到 Paid 並改回 `"100000"`，使用者下次登入時會自動以新強度重新雜湊。
- AI 分析費用依 Anthropic 用量計價；每次分析結果會顯示 token 用量與估計費用（`USD_TO_TWD` 匯率可在 `wrangler.jsonc` 調整）。
- D1、Workers 的免費額度與價格以 [Cloudflare 官方定價](https://developers.cloudflare.com/workers/platform/pricing/) 為準。

## 設定（`wrangler.jsonc` → `vars`）

| 變數 | 預設 | 說明 |
|------|------|------|
| `AI_MODEL` | `claude-opus-5-5` | AI 分析使用的 Claude 模型 |
| `AI_EFFORT` | `high` | `low` / `medium` / `high` / `xhigh` / `max`，越高越仔細但越慢越貴 |
| `USD_TO_TWD` | `32` | 費用換算匯率 |
| `ALLOW_REGISTRATION` | `true` | 是否開放任何人註冊新公司 |
| `SESSION_TTL_HOURS` | `168` | 登入有效時間（小時） |
| `PBKDF2_ITERATIONS` | `100000` | 密碼雜湊強度（10,000–100,000），見上方方案說明 |

Secrets（`npx wrangler secret put <NAME>` 或 Dashboard 設定）：

| Secret | 說明 |
|--------|------|
| `ANTHROPIC_API_KEY` | 必填才能使用 AI 分析 |
| `ANTHROPIC_BASE_URL` | 選填，例如透過 [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) 轉送以取得用量紀錄與快取 |

## 本機開發

```bash
cd cloudflare
npm ci
npm run db:migrate:local
cp .dev.vars.example .dev.vars   # 填入 ANTHROPIC_API_KEY（可選）
npm run dev                       # http://localhost:8787
```

## 測試

```bash
npm run typecheck   # TypeScript 型別檢查
npm test            # 單元測試：報告邏輯、密碼雜湊、TS 範本與 YAML 一致性
# 端到端 API 測試（需先 npm run dev）
npm run test:e2e
```

`test/schemas.test.ts` 會讀取 `../config/regulatory_schemas.yaml`，比對 `src/schemas.ts` 的每一個項目、類別與風險規則。修改 YAML 後若沒同步更新 TS，測試就會失敗。GitHub Actions（`.github/workflows/cloudflare.yml`）在每次 PR 時都會跑上述所有測試，並搭配本機 D1 與模擬的 AI 後端執行 API 端到端測試。

## 安全設計

- 密碼：PBKDF2-SHA256 加鹽雜湊；Session token 只存 SHA-256 雜湊，Cookie 為 `HttpOnly; Secure; SameSite=Lax`。
- 登入防暴力破解：同一 Email 15 分鐘內失敗 10 次即暫時鎖定。
- 多租戶隔離：所有查詢皆以登入者的 `company_id` 篩選。
- 角色權限：管理員 / 成員 / 檢視者（唯讀）。
- CSRF：非 GET 請求必須為 JSON，且會檢查 `Origin`。
- XSS：前端一律以 `textContent` 輸出使用者資料；CSP 只允許同源腳本。
- AI 金鑰只存於 Worker Secret，不會送到瀏覽器；上傳文件內容在提示詞中標示為「待審資料」，降低提示注入風險。
- CSV 匯出會中和 `=`、`+`、`-`、`@` 開頭的儲存格，避免 Excel 公式注入。

## 介面設計

- 字型：標題使用楷書字型 LXGW WenKai TC，取公文常用標楷體的語感；數字與英文使用 IBM Plex Sans。兩者都由 Google Fonts 非同步載入，連不到 Google 時會自動改用系統內建的標楷體與黑體，不影響使用。若公司政策不允許連線 Google，可刪除 `public/theme.js` 中載入字型的段落。
- 顏色：冷灰綠的表格紙底、藍黑墨色文字、朱紅印章。狀態顏色固定為：已完成（墨綠）、審查中（靛藍）、進行中（赭黃）、受阻（朱紅）、待處理（灰）。
- 案件總覽右上角的印章顯示整體狀態（可以送件／接近完成／尚待補齊）；印章下方的色塊條，每一塊代表一份文件。
- 紅色只用在需要立即處理的案件：已逾期、距截止日不到 30 天，或有受阻的文件（已結案、封存的案件不會標紅）。完成度低但時程還早的案件，印章與狀態標籤以灰色顯示，頁面上會寫出標紅的原因。

## 資料說明

AI 分析會把文件內容傳送至 Anthropic API。請確認上傳資料符合公司保密規範與相關個資規定。AI 結果僅供內部初步檢查參考，不構成法規意見，送件前仍須由 RA 人員依 TFDA 現行公告確認。
