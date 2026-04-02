# Regulatory Review Tool 🏛️

<p align="center">
  <b>自動化法規文件審查系統 | Automated Regulatory Document Review System</b>
</p>

<p align="center">
  <a href="#中文">🇹🇼 繁體中文</a> • 
  <a href="#english">🇺🇸 English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.9+-blue.svg?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Streamlit-1.32-ff4b4b.svg?logo=streamlit" alt="Streamlit">
  <img src="https://img.shields.io/badge/PostgreSQL-14+-336791.svg?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/OpenClaw-Skill-blue" alt="OpenClaw">
</p>

---

<a name="中文"></a>

## 🇹🇼 繁體中文

> 專為台灣 FDA (TFDA) 藥品與食品註冊申請設計的自動化文件審查系統

### ✨ 功能特色

| 功能 | 說明 |
|------|------|
| 📄 **文件完整性檢查** | 自動驗證必要文件是否齊全 |
| ⚖️ **法規合規性驗證** | 比對 TFDA 最新法規要求 |
| 🔍 **缺失項目識別** | 識別過期或無效的文件 |
| 📊 **標準化報告** | 生成審查報告 (PDF/Word) |
| ⏱️ **進度追蹤** | 追蹤審查進度與時間軸 |

### 🏥 支援的專案類型

| 類型 | 說明 |
|------|------|
| **藥品許可證展延** | 西藥、中藥許可證展延申請 |
| **食品登記** | 膠囊錠狀食品、特殊營養食品登記 |
| **GMP 查核** | 優良製造規範相關文件 |
| **規格變更** | 藥品規格、包裝變更申請 |

### 🚀 快速開始

```bash
# 安裝
git clone https://github.com/bounce12340/regulatory-review.git
cd regulatory-review
pip install -r requirements.txt

# 設定環境變數
cp .env.example .env
# 編輯 .env 填入 API 金鑰

# 啟動 Web 介面
streamlit run launcher.py
```

### 🛠️ 技術棧

- **前端**: Streamlit
- **資料庫**: PostgreSQL (Supabase)
- **AI/ML**: LangChain, Claude, GPT, Gemini
- **文件處理**: python-docx, reportlab, pypdf

### 📋 專案進度

- ✅ Phase 1: 基礎建設
- 🚧 Phase 2: 核心功能
- 📅 Phase 3: AI 整合

---

<a name="english"></a>

## 🇺🇸 English

> Automated document review system designed for Taiwan FDA (TFDA) drug & food registration applications

### ✨ Features

| Feature | Description |
|---------|-------------|
| 📄 **Completeness Check** | Auto-verify required documents |
| ⚖️ **Compliance Validation** | Match against latest TFDA requirements |
| 🔍 **Gap Identification** | Identify missing/expired documents |
| 📊 **Standardized Reports** | Generate review reports (PDF/Word) |
| ⏱️ **Progress Tracking** | Track review timeline |

### 🏥 Supported Project Types

| Type | Description |
|------|-------------|
| **Drug Registration Extension** | Western/Chinese medicine license renewal |
| **Food Registration** | Capsule/tablet food registration |
| **GMP Audit** | Good Manufacturing Practice documentation |
| **Specification Changes** | Drug spec/packaging changes |

### 🚀 Quick Start

```bash
# Install
git clone https://github.com/bounce12340/regulatory-review.git
cd regulatory-review
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your API keys

# Launch web interface
streamlit run launcher.py
```

### 🛠️ Tech Stack

- **Frontend**: Streamlit
- **Database**: PostgreSQL (Supabase)
- **AI/ML**: LangChain, Claude, GPT, Gemini
- **Document**: python-docx, reportlab, pypdf

### 📋 Roadmap

- ✅ Phase 1: Infrastructure
- 🚧 Phase 2: Core Features
- 📅 Phase 3: AI Integration

---

## 🏗️ Architecture / 系統架構

```
regulatory-review/
├── 📁 ai/           # AI model & NLP
├── 📁 auth/         # Authentication
├── 📁 config/       # Config & templates
├── 📁 database/     # DB models
├── 📁 outputs/        # Reports
├── 📁 scripts/      # Core scripts
├── 📄 launcher.py   # Main entry
└── 📄 migrate.py    # DB migration
```

---

## 📝 License / 授權

MIT License — See [LICENSE](LICENSE)

---

## 👤 Author / 作者

**Josh** (蔡忠栩) — [@bounce12340](https://github.com/bounce12340)

---

<p align="center">
  Made with ❤️ for Regulatory Affairs Professionals<br>
  為法規事務專業人員用心打造
</p>
