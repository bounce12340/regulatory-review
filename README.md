# Regulatory Review Tool 🏛️

> 自動化法規文件審查系統 | Automated Regulatory Document Review System
>
> 專為台灣 FDA (TFDA) 藥品與食品註冊申請設計 | Designed for Taiwan FDA (TFDA) drug & food registration applications

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://python.org)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.32-ff4b4b.svg)](https://streamlit.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![English](https://img.shields.io/badge/English-README-orange.svg)](README.en.md)

---

## 📋 專案簡介 | Project Overview

Regulatory Review Tool 是一個專為法規事務 (Regulatory Affairs) 團隊設計的自動化文件審查系統。

Regulatory Review Tool is an automated document review system designed for Regulatory Affairs teams.

它能夠：| It can:

- ✅ 自動檢查文件完整性 | Automatically verify document completeness
- ✅ 驗證法規合規性 | Validate regulatory compliance
- ✅ 識別缺失項目與潛在風險 | Identify missing items and potential risks
- ✅ 生成標準化審查報告 | Generate standardized review reports
- ✅ 追蹤審查進度與時間軸 | Track review progress and timelines

### 支援的專案類型 | Supported Project Types

| 類型 Type | 說明 Description |
|-----------|-----------------|
| **藥品許可證展延** Drug Registration Extension | 西藥、中藥許可證展延申請 Western/Chinese medicine license renewal |
| **食品登記** Food Registration | 膠囊錠狀食品、特殊營養食品登記 Capsule/tablet food registration |
| **GMP 查核** GMP Audit | 優良製造規範相關文件 Good Manufacturing Practice documentation |
| **規格變更** Specification Changes | 藥品規格、包裝變更申請 Drug spec/packaging change applications |

---

## 🚀 快速開始 | Quick Start

### 安裝 | Installation

```bash
# 複製專案 | Clone the repository
git clone https://github.com/bounce12340/regulatory-review.git
cd regulatory-review

# 安裝相依套件 | Install dependencies
pip install -r requirements.txt

# 設定環境變數 | Configure environment variables
cp .env.example .env
# 編輯 .env 檔案，填入必要的 API 金鑰
# Edit .env to fill in required API keys
```

### 執行審查 | Running Reviews

```bash
# 啟動 Web 介面 | Launch web interface
streamlit run launcher.py

# 命令列審查（指定專案）| CLI review by project
python scripts/review.py --project fenogal
python scripts/review.py --project gastrilex --type food-registration
```

---

## 🏗️ 系統架構 | System Architecture

```
regulatory-review/
├── 📁 ai/                    # AI 模型與 NLP 處理 | AI model & NLP processing
├── 📁 auth/                  # 身份驗證模組 | Authentication module
├── 📁 config/                # 設定檔與範本 | Config files & templates
├── 📁 database/              # 資料庫模型與遷移 | DB models & migrations
├── 📁 outputs/               # 審查報告輸出 | Review report output
├── 📁 scripts/               # 核心審查腳本 | Core review scripts
├── 📁 tests/                 # 單元測試 | Unit tests
├── 📄 launcher.py            # 主程式入口 | Main entry point
├── 📄 migrate.py             # 資料庫遷移工具 | DB migration utility
└── 📄 requirements.txt       # Python 相依套件 | Python dependencies
```

---

## 📊 功能特色 | Features

### 1. 文件完整性檢查 | Document Completeness Check
- 自動驗證必要文件是否齊全 | Auto-verify required documents are complete
- 檢查文件格式與版本 | Check document format and version
- 識別過期或無效的文件 | Identify expired or invalid documents

### 2. 法規合規性驗證 | Regulatory Compliance Validation
- 比對 TFDA 最新法規要求 | Match against latest TFDA regulatory requirements
- 檢查標示與仿單內容 | Verify labeling and IFU content
- 驗證 GMP 相關文件 | Validate GMP-related documents

### 3. AI 輔助審查 | AI-Assisted Review
- 使用 Claude/GPT API 進行智能分析 | Intelligent analysis via Claude/GPT API
- PDF/Word 文件自動解析 | Auto-parse PDF/Word documents
- 風險評估與建議生成 | Risk assessment and recommendation generation

### 4. 報告生成 | Report Generation
- 標準化審查報告 (PDF/Word) | Standardized review reports (PDF/Word)
- 通過/未通過狀態標示 | Pass/Fail status indicators
- 待辦事項與時間軸追蹤 | Action items and timeline tracking

---

## 🛠️ 技術棧 | Tech Stack

| 類別 Category | 技術 Technology |
|--------------|-----------------|
| **前端 Frontend** | Streamlit |
| **資料庫 Database** | PostgreSQL (Supabase) |
| **AI/ML** | LangChain, Anthropic Claude, OpenAI GPT, Google Gemini, Ollama, OpenRouter |
| **文件處理 Document Processing** | python-docx, reportlab, pypdf |
| **認證 Authentication** | PyJWT, bcrypt |
| **測試 Testing** | pytest |

---

## 📅 開發路線圖 | Development Roadmap

### Phase 1: 基礎建設 | Infrastructure ✅
- [x] GitHub Repository 建立 | GitHub Repository created
- [x] Docker 容器化 | Docker containerized
- [x] 雲端部署設定 (Render) | Cloud deployment (Render)

### Phase 2: 核心功能 | Core Features 🚧
- [ ] 使用者認證系統 | User authentication system
- [ ] 專案 CRUD 操作 | Project CRUD operations
- [ ] 資料庫整合 | Database integration

### Phase 3: 測試與優化 | Testing & Optimization
- [ ] 單元測試覆蓋 | Unit test coverage
- [ ] 效能優化 | Performance optimization
- [ ] CI/CD 流程 | CI/CD pipeline

### Phase 4: AI 整合 | AI Integration
- [ ] LLM 模型整合 | LLM model integration
- [ ] 智能文件解析 | Intelligent document parsing
- [ ] RAG 知識庫 | RAG knowledge base

### Phase 5: 商業化 | Commercialization
- [ ] 付費訂閱系統 | Paid subscription system
- [ ] 企業版功能 | Enterprise features
- [ ] API 開放 | API exposure

---

## 🤝 貢獻指南 | Contributing

歡迎提交 Issue 和 Pull Request！| Issues and Pull Requests are welcome!

1. Fork 本專案 | Fork this repository
2. 建立功能分支 | Create a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. 提交變更 | Commit your changes
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. 推送分支 | Push the branch
   ```bash
   git push origin feature/amazing-feature
   ```
5. 開啟 Pull Request | Open a Pull Request

---

## 📝 授權條款 | License

本專案採用 MIT 授權條款 | This project is licensed under the MIT License
詳見 [LICENSE](LICENSE) 檔案 | See [LICENSE](LICENSE) file

---

## 👤 作者 | Author

**Josh** (蔡忠栩) - [@bounce12340](https://github.com/bounce12340)

---

## 🙏 致謝 | Acknowledgements

- 台灣 FDA (TFDA) 法規指引 | Taiwan FDA (TFDA) regulatory guidelines
- OpenClaw 開發框架 | OpenClaw development framework
- 所有貢獻者與測試者 | All contributors and testers

---

<p align="center">
  Made with ❤️ for Regulatory Affairs Professionals<br>
  為法規事務專業人員用心打造
</p>