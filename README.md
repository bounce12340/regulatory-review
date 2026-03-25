# Regulatory Review Tool 🏛️

> 自動化法規文件審查系統，專為台灣 FDA (TFDA) 藥品與食品註冊申請設計

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://python.org)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.32-ff4b4b.svg)](https://streamlit.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 專案簡介

Regulatory Review Tool 是一個專為法規事務 (Regulatory Affairs) 團隊設計的自動化文件審查系統。它能夠：

- ✅ 自動檢查文件完整性
- ✅ 驗證法規合規性
- ✅ 識別缺失項目與潛在風險
- ✅ 生成標準化審查報告
- ✅ 追蹤審查進度與時間軸

### 支援的專案類型

| 類型 | 說明 |
|------|------|
| **藥品許可證展延** | 西藥、中藥許可證展延申請 |
| **食品登記** | 膠囊錠狀食品、特殊營養食品登記 |
| **GMP 查核** | 優良製造規範相關文件 |
| **規格變更** | 藥品規格、包裝變更申請 |

---

## 🚀 快速開始

### 安裝

```bash
# 複製專案
git clone https://github.com/bounce12340/regulatory-review.git
cd regulatory-review

# 安裝相依套件
pip install -r requirements.txt

# 設定環境變數
cp .env.example .env
# 編輯 .env 檔案，填入必要的 API 金鑰
```

### 執行審查

```bash
# 啟動 Web 介面
streamlit run launcher.py

# 或使用命令列審查特定專案
python scripts/review.py --project fenogal
python scripts/review.py --project gastrilex --type food-registration
```

---

## 🏗️ 系統架構

```
regulatory-review/
├── 📁 ai/                    # AI 模型與 NLP 處理
├── 📁 auth/                  # 身份驗證模組
├── 📁 config/                # 設定檔與範本
├── 📁 database/              # 資料庫模型與遷移
├── 📁 outputs/               # 審查報告輸出
├── 📁 scripts/               # 核心審查腳本
├── 📁 tests/                 # 單元測試
├── 📄 launcher.py            # 主程式入口
├── 📄 migrate.py             # 資料庫遷移工具
└── 📄 requirements.txt       # Python 相依套件
```

---

## 📊 功能特色

### 1. 文件完整性檢查
- 自動驗證必要文件是否齊全
- 檢查文件格式與版本
- 識別過期或無效的文件

### 2. 法規合規性驗證
- 比對 TFDA 最新法規要求
- 檢查標示與仿單內容
- 驗證 GMP 相關文件

### 3. AI 輔助審查 (開發中)
- 使用 Claude/GPT API 進行智能分析
- PDF/Word 文件自動解析
- 風險評估與建議生成

### 4. 報告生成
- 標準化審查報告 (PDF/Word)
- 通過/未通過狀態標示
- 待辦事項與時間軸追蹤

---

## 🛠️ 技術棧

| 類別 | 技術 |
|------|------|
| **前端** | Streamlit |
| **資料庫** | PostgreSQL (Supabase) |
| **AI/ML** | LangChain, Anthropic Claude, OpenAI GPT |
| **文件處理** | python-docx, reportlab, pypdf |
| **認證** | PyJWT, bcrypt |
| **測試** | pytest |

---

## 📅 開發路線圖

### Phase 1: 基礎建設 ✅
- [x] GitHub Repository 建立
- [x] Docker 容器化
- [x] 雲端部署設定 (Render)

### Phase 2: 核心功能 🚧
- [ ] 使用者認證系統
- [ ] 專案 CRUD 操作
- [ ] 資料庫整合

### Phase 3: 測試與優化
- [ ] 單元測試覆蓋
- [ ] 效能優化
- [ ] CI/CD 流程

### Phase 4: AI 整合
- [ ] LLM 模型整合
- [ ] 智能文件解析
- [ ] RAG 知識庫

### Phase 5: 商業化
- [ ] 付費訂閱系統
- [ ] 企業版功能
- [ ] API 開放

---

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

1. Fork 本專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

---

## 📝 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

---

## 👤 作者

**Josh** - [@bounce12340](https://github.com/bounce12340)

---

## 🙏 致謝

- 台灣 FDA (TFDA) 法規指引
- OpenClaw 開發框架
- 所有貢獻者與測試者

---

<p align="center">
  Made with ❤️ for Regulatory Affairs Professionals
</p>
