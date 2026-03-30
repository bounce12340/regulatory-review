# Regulatory Review Tool 🏛️

> Automated Regulatory Document Review System
> Designed for Taiwan FDA (TFDA) drug & food registration applications

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://python.org)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.32-ff4b4b.svg)](https://streamlit.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 Project Overview

Regulatory Review Tool is an automated document review system designed for Regulatory Affairs teams. It can:

- ✅ Automatically verify document completeness
- ✅ Validate regulatory compliance
- ✅ Identify missing items and potential risks
- ✅ Generate standardized review reports
- ✅ Track review progress and timelines

### Supported Project Types

| Type | Description |
|------|-------------|
| **Drug Registration Extension** | Western/Chinese medicine license renewal |
| **Food Registration** | Capsule/tablet food & special nutritional food registration |
| **GMP Audit** | Good Manufacturing Practice documentation |
| **Specification Changes** | Drug spec/packaging change applications |

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/bounce12340/regulatory-review.git
cd regulatory-review

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env to fill in required API keys
```

### Running Reviews

```bash
# Launch web interface
streamlit run launcher.py

# CLI review by project
python scripts/review.py --project fenogal
python scripts/review.py --project gastrilex --type food-registration
```

---

## 🏗️ System Architecture

```
regulatory-review/
├── 📁 ai/                    # AI model & NLP processing
├── 📁 auth/                  # Authentication module
├── 📁 config/                # Config files & templates
├── 📁 database/              # DB models & migrations
├── 📁 outputs/               # Review report output
├── 📁 scripts/               # Core review scripts
├── 📁 tests/                 # Unit tests
├── 📄 launcher.py            # Main entry point
├── 📄 migrate.py             # DB migration utility
└── 📄 requirements.txt       # Python dependencies
```

---

## 📊 Features

### 1. Document Completeness Check
- Auto-verify required documents are complete
- Check document format and version
- Identify expired or invalid documents

### 2. Regulatory Compliance Validation
- Match against latest TFDA regulatory requirements
- Verify labeling and IFU content
- Validate GMP-related documents

### 3. AI-Assisted Review
- Intelligent analysis via Claude/GPT API
- Auto-parse PDF/Word documents
- Risk assessment and recommendation generation

### 4. Report Generation
- Standardized review reports (PDF/Word)
- Pass/Fail status indicators
- Action items and timeline tracking

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Streamlit |
| **Database** | PostgreSQL (Supabase) |
| **AI/ML** | LangChain, Anthropic Claude, OpenAI GPT, Google Gemini, Ollama, OpenRouter |
| **Document Processing** | python-docx, reportlab, pypdf |
| **Authentication** | PyJWT, bcrypt |
| **Testing** | pytest |

---

## 📅 Development Roadmap

### Phase 1: Infrastructure ✅
- [x] GitHub Repository created
- [x] Docker containerized
- [x] Cloud deployment (Render)

### Phase 2: Core Features 🚧
- [ ] User authentication system
- [ ] Project CRUD operations
- [ ] Database integration

### Phase 3: Testing & Optimization
- [ ] Unit test coverage
- [ ] Performance optimization
- [ ] CI/CD pipeline

### Phase 4: AI Integration
- [ ] LLM model integration
- [ ] Intelligent document parsing
- [ ] RAG knowledge base

### Phase 5: Commercialization
- [ ] Paid subscription system
- [ ] Enterprise features
- [ ] API exposure

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit your changes
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. Push the branch
   ```bash
   git push origin feature/amazing-feature
   ```
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License — see [LICENSE](LICENSE) file

---

## 👤 Author

**Josh** (蔡忠栩) - [@bounce12340](https://github.com/bounce12340)

---

## 🙏 Acknowledgements

- Taiwan FDA (TFDA) regulatory guidelines
- OpenClaw development framework
- All contributors and testers

---

<p align="center">
  Made with ❤️ for Regulatory Affairs Professionals
</p>