# 系統檢查報告：Regulatory Review Tool（Streamlit 版）

> 檢查日期：2026-10-01｜檢查範圍：`main` 分支（commit `f5a43fe`）全部 Python 程式、設定檔與部署檔
> 結論：Streamlit 版無法部署在 Cloudflare，且有多項安全與正確性問題。已在 `cloudflare/` 以 Workers + D1 重寫，下表的問題在新版中皆已處理。

## 1. 為何原版不能直接放上 Cloudflare

| 原版需求 | Cloudflare 的限制 |
|----------|-------------------|
| Streamlit 需要長時間執行的 Python 伺服器與 WebSocket 連線 | Cloudflare Pages 只提供靜態檔案；Workers 是以請求為單位執行的 V8 isolate，無法常駐 Streamlit |
| SQLAlchemy + SQLite 檔案寫在本機硬碟（`~/.openclaw/...`） | Workers 沒有持久化的本機檔案系統；需改用 D1 |
| bcrypt、pypdf、python-docx 等原生／Python 套件 | Workers 執行的是 JavaScript/TypeScript（Python Workers 不支援這些套件與 Streamlit） |

另一個可行做法是 **Cloudflare Containers**，可以把 Docker 版 Streamlit 原樣執行。但它需要付費方案，而且容器的磁碟不會保留資料，SQLite 仍會遺失，所以沒有採用。

## 2. 發現的問題

### 🔴 高：安全性

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| S1 | 伺服器的 AI API 金鑰被預填到網頁輸入框（`value=os.getenv(...)`） | `scripts/web_dashboard.py` `render_ai_analysis_page` | 任何登入使用者都能從瀏覽器取得公司的 Anthropic／OpenAI 金鑰 |
| S2 | 使用者輸入（專案名稱、項目名稱、備註、姓名）以 `unsafe_allow_html=True` 直接插入 HTML | `web_dashboard.py` 多處 | 儲存型 XSS：同公司成員可在他人瀏覽器執行腳本 |
| S3 | 側邊欄「Data directory」可輸入任意伺服器路徑並讀取其 JSON | `web_dashboard.py` main() | 雲端部署時可讀取伺服器上任意目錄的 JSON 檔 |
| S4 | 檢查更新時關閉 TLS 憑證驗證（`CERT_NONE`） | `check_for_updates()` | 可被中間人竄改更新資訊與下載連結 |
| S5 | 登入無失敗次數限制、Session 無到期機制 | `auth/` | 帳號可被暴力破解 |

### 🟠 中：功能正確性

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| F1 | `review.py` 的 `RISK_RULES` 與 `config/regulatory_schemas.yaml` 不一致：規格變更**已完成**仍判為高風險；ExPress 上傳**進行中**卻判為低風險；原料藥 GMP 上傳**待處理**判為低風險（YAML 為中） | `scripts/review.py` | 風險評估錯誤，可能低估真正待處理的項目 |
| F2 | 資料庫模式下**沒有任何介面可以更新檢查項目狀態**：`upsert_checklist_item_db()` 已定義但從未被呼叫 | `web_dashboard.py` | 登入後的多租戶模式實際上無法追蹤進度 |
| F3 | 「新增審查項目」寫入固定檔名 `{project}-review-latest.json`，與讀取的「最新修改 JSON」不同檔；DB 模式下完全無效 | `web_dashboard.py` | 新增的項目可能不會出現 |
| F4 | 建立專案時只產生空白的「項目 1、項目 2…」，沒有套用 YAML 的 TFDA 檢查範本 | `render_projects_page()` | 新專案沒有實際檢查內容 |
| F5 | 時程頁、比較頁只讀 JSON 檔與寫死的 `DEADLINES`（fenogal / gastrilex），忽略資料庫中的專案與截止日 | `web_dashboard.py` | 多租戶模式下這兩頁顯示錯誤資料 |
| F6 | 勾選「自動重新整理」後會 `sleep(0.1)` 立即 `st.rerun()`，形成無限迴圈 | `web_dashboard.py` | 伺服器 CPU 飆高，頁面無法操作 |
| F7 | AI 供應商選單提供 Ollama、OpenRouter，但 `llm_client.py` 不支援 → 一律報錯；Gemini 呼叫的是已淘汰的 `generate_text` API，且 `google-generativeai` 未列於 requirements | `ai/llm_client.py` | 5 個選項中只有 2 個可用 |
| F8 | 選 OpenAI 但未填金鑰時，會改用 `ANTHROPIC_API_KEY` 呼叫 OpenAI | `MultiProviderLLMClient.__init__` | 錯誤訊息令人困惑 |
| F9 | 上傳元件接受 `.doc`、`.xls`，但 python-docx / openpyxl 無法讀取舊格式 | `upload_handler.py` | 上傳必定失敗 |
| F10 | AI 分析把文件靜默截斷在 80,000 字元 | `llm_client.py` | 長文件後段的缺口不會被發現，使用者也不知道 |
| F11 | 未安裝 `rich` 時 `import scripts.review` 直接 `NameError` | `scripts/review.py` | 測試與 CLI 在精簡環境中崩潰（**已在本分支修正**） |
| F12 | DB 模式的整體狀態用 `on_track/needs_attention`，與 `review.py` 的 `ready_for_submission/in_progress/needs_attention` 不一致 | `load_project_report_db()` | 同一專案在兩種模式下顯示不同結論 |

### 🟡 低：部署與維運

| # | 問題 | 影響 |
|---|------|------|
| D1 | README 說資料庫是 PostgreSQL／Supabase，程式實際只用 SQLite；Render 免費方案磁碟非永久 | 重新部署即遺失所有帳號與專案 |
| D2 | Dockerfile 的 `HEALTHCHECK` 使用 `curl`，但 `python:3.11-slim` 未安裝 curl | 容器永遠被判定為不健康 |
| D3 | CI 每個步驟都設 `continue-on-error: true`，且 `.coveragerc` 不存在 | 測試失敗也顯示綠燈，CI 形同虛設 |
| D4 | README 提到的 `.env.example`、`LICENSE` 不存在；`streamlit run launcher.py` 是錯誤指令（launcher 會再開子程序） | 新使用者照 README 無法啟動 |
| D5 | `requirements.txt` 同時裝 `pypdf` 與已停止維護的 `pypdf2` | 多餘依賴 |

## 3. Cloudflare 版如何處理

| 原問題 | 新版做法 |
|--------|----------|
| S1 | 金鑰只存在 Worker Secret，前端永遠拿不到；AI 呼叫由 Worker 代理 |
| S2 | 前端完全不用 `innerHTML` 輸出使用者資料；CSP `script-src 'self'`；端到端測試以 XSS payload 驗證 |
| S3 | 不再有任何檔案路徑輸入，資料全在 D1 且以 `company_id` 隔離（已有跨租戶存取測試） |
| S4 | 移除自動更新檢查（網站版不需要） |
| S5 | 15 分鐘 10 次失敗鎖定、Session 有效期限、停用帳號立即登出、Token 僅存雜湊 |
| F1 | 風險規則直接移植自 YAML，並以單元測試逐項比對 YAML，避免再次分歧 |
| F2–F5 | 檢查清單可直接改狀態／備註；建立專案自動套用 TFDA 範本；所有頁面都讀 D1 |
| F6 | 移除自動重新整理迴圈 |
| F7–F8 | AI 只保留實際可用的 Anthropic Claude（structured output 保證 JSON 格式，並啟用 server-side fallback）。若日後需要其他供應商，可再擴充 |
| F9 | 明確拒絕 .doc/.xls 並提示另存新格式；PDF 直接交給 Claude 讀取（含掃描檔） |
| F10 | 上限提高到 40 萬字元，超過時明確回報錯誤，不再靜默截斷 |
| F12 | 統一使用 `review.py` 的狀態門檻（100% 可送件、≥70% 接近完成、其餘待加強） |
| D1–D3 | D1 永久保存；新 CI（`.github/workflows/cloudflare.yml`）失敗即紅燈 |

## 4. 尚未處理／建議後續

1. **原 Python 版是否保留**：本分支未刪除 Streamlit 版（仍可本機使用、234 個測試仍全數通過），也沒有修改其餘問題。若確定改用 Cloudflare 版，建議移除 `render.yaml`、`Dockerfile`、`launcher.py`、`*.spec` 等舊部署檔。
2. **既有資料移轉**：若已有使用中的 SQLite 資料，需撰寫一次性匯出→匯入 D1 的腳本（新版密碼雜湊格式不同，bcrypt 舊密碼無法沿用，使用者需重設密碼）。
3. **原版未移植的模組**：成本追蹤（`cost_tracker.py`）、Email 提醒（`email_alerts.py`／`email_sender.py`）、TFDA 公告爬蟲（`tfda_scraper.py`）、Word/PDF 報告產生器。它們未接到 Streamlit 介面，需確認是否仍有需求再移植（Email 可用 Cloudflare Email Workers 或 Cron Trigger 實作）。
4. **法規內容**：檢查清單項目沿用原 YAML，本次未查證其是否符合 TFDA 最新公告。這屬於法規專業判斷，建議由 RA 人員定期覆核。
