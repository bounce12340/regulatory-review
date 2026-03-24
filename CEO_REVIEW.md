# CEO Review — Regulatory Review Tool v3.0.0

> **Review Date:** 2026-03-24
> **Reviewer Mode:** SELECTIVE EXPANSION — hold current scope, surface every expansion opportunity individually
> **Branch:** main (clean)
> **Reviewer Lens:** CEO / Founder — product strategy, market fit, 10x potential

---

## Executive Summary

You have built a **real product that solves a genuinely painful problem** — and you're using it only internally for 2 projects.

The core architecture is sound. The domain knowledge is embedded correctly. The UI is polished. The feature set is complete for an internal tool.

**The gap:** This is a $500K ARR SaaS opportunity disguised as a `.exe` file.

---

## What You Actually Built

| Layer | What Exists | Quality |
|-------|------------|---------|
| Regulatory schema engine | TFDA checklists for drug/food/medical device | ★★★★☆ |
| Project tracking | Status, risk, timeline per item | ★★★★☆ |
| Cost management | Multi-currency, budget templates, alerts | ★★★★☆ |
| Report generation | PDF + Word export | ★★★☆☆ |
| Email automation | Deadline + risk alerts, SMTP | ★★★☆☆ |
| Analytics | History, project comparison, charts | ★★★☆☆ |
| Regulatory news | TFDA scraper, change detection | ★★★☆☆ |
| Distribution | 130MB Windows EXE | ★★☆☆☆ |
| Data persistence | JSON files + YAML | ★★☆☆☆ |
| Testing | None found | ★☆☆☆☆ |

**The product is 80% of the way to something you could charge money for today.**

---

## Market Assessment

### Who needs this?

Taiwan FDA regulatory submissions affect a large, underserved market:

| Segment | Count (est.) | Pain Level | Willingness to Pay |
|---------|-------------|-----------|-------------------|
| Pharmaceutical importers/manufacturers | ~300 companies | 🔴 Critical | NT$5,000-20,000/mo |
| Food supplement companies | ~800 companies | 🟠 High | NT$2,000-8,000/mo |
| Medical device manufacturers | ~400 companies | 🔴 Critical | NT$8,000-30,000/mo |
| RA consulting firms | ~50 firms | 🔴 Critical | NT$15,000-50,000/mo |
| CROs | ~30 firms | 🔴 Critical | NT$20,000-80,000/mo |

**Total addressable market (Taiwan only):** ~1,580 companies
**Conservative 5% capture at NT$5,000/mo average:** NT$4.7M ARR (~USD $148K)
**RA consulting firms at NT$30,000/mo:** 50 firms × NT$30K = NT$18M ARR from one segment alone

### Why no good tool exists today

- **Veeva Vault / MasterControl**: Enterprise, $50K+/year, Western-focused, not TFDA-specific
- **Manual Excel + consultants**: NT$50,000+ per submission review, error-prone
- **Gap**: No affordable, Taiwan-specific, TFDA-integrated SaaS platform exists

**You have first-mover advantage.** A regulatory consultant charges NT$2,000-5,000/hour to do what this tool automates.

---

## Critical Diagnosis: What's Blocking the 10x

### 1. Distribution is the product's biggest enemy

```
130MB EXE file → antivirus false positives → painful installs
→ no auto-update (user must re-download 130MB)
→ Windows-only (locks out Mac-using RA consultants)
→ localhost:8501 is not how enterprise software works
```

**Root cause:** The tool IS already a web application. Streamlit runs a web server. You're packaging a web app as a desktop app for no strategic reason.

**Fix:** Deploy to cloud → give users a URL → problem solved.
**Effort:** Human: 3 days / CC: 30 minutes

### 2. Hardcoded data prevents any other user from adopting it

```python
# Current architecture: 2 projects hardcoded in YAML
# fenogal (deadline May 2026), gastrilex (deadline June 2026)
# New company wants to use it → they must edit config files
```

**Fix:** Project CRUD in the UI + database backend. Any company, any projects.
**Effort:** Human: 1 week / CC: 2 hours

### 3. No auth = no SaaS

No login system. No company isolation. No roles (submitter vs. approver vs. admin).
A multi-tenant SaaS product needs these before the first external customer.

**Effort:** Human: 1 week / CC: 1 hour (Streamlit-Authenticator or migrate to FastAPI + Next.js)

### 4. Zero tests on a compliance product

This tool tracks drug and medical device regulatory submissions. A bug that silently marks a required item as "complete" when it isn't could cause a company to submit an incomplete application — regulatory consequence: 6-18 month delay.

**Zero tests = unacceptable risk for a compliance tool.**

**Effort:** Human: 3 days / CC: 30 minutes

### 5. JSON/YAML data layer will break at scale

```
Currently: JSON files on local disk
Problem: No concurrent access, no backup, no audit trail, data loss on crash
```

**Fix:** PostgreSQL (Supabase free tier covers early product).
**Effort:** Human: 3 days / CC: 45 minutes

---

## The 10x Opportunity: What This Could Be

### Vision: "TFDA Submission Intelligence Platform"

**Today:** Internal checklist tracker for 2 projects at 1 company
**10x:** SaaS used by 200+ companies managing TFDA submissions, with AI-powered compliance gap analysis

### The killer feature that doesn't exist yet

**AI Document Gap Analysis:**
1. User uploads draft submission package (PDFs, Word docs)
2. System extracts content using LLM
3. Compares against TFDA requirements stored in your schema engine
4. Outputs: gap report with specific missing items, non-compliant sections, action items
5. Saves 8-20 hours of consultant review time per submission

**Value proposition:** What an RA consultant charges NT$100,000 to review, this does in 60 seconds.

**Effort:** Human: 2 weeks / CC: 2 hours (Claude API integration)

---

## Expansion Opportunities (Selective — pick what fits your strategy)

### Opportunity A: Cloud Deployment (Prerequisite for everything else)

**What:** Deploy to Render/Railway/Fly.io instead of EXE distribution
**Why:** Removes all distribution pain, enables multi-user, enables SaaS
**Effort:** Human: 3 days / CC: 20 minutes
**Risk:** Low — Streamlit deploys trivially
**Verdict:** **DO THIS FIRST. Everything else depends on it.**

---

### Opportunity B: External Customer Onboarding

**What:** Company registration, project CRUD, user invites, plan tiers
**Why:** Cannot charge money without this
**Effort:** Human: 2 weeks / CC: 3 hours
**Risk:** Low
**Dependency:** Requires Opportunity A (cloud deploy)

---

### Opportunity C: AI Document Analysis

**What:** Upload submission docs → instant gap analysis vs. TFDA requirements
**Why:** This is the product's moat. No competitor has Taiwan-specific AI review.
**Effort:** Human: 3 weeks / CC: 2 hours
**Risk:** Medium (LLM accuracy needs validation with real RA professionals)
**Revenue impact:** Justifies 3-5x price premium over basic checklist tool

---

### Opportunity D: TFDA ExPress Integration

**What:** Direct API integration with TFDA's submission platform
**Why:** If the tool can auto-populate ExPress forms, it becomes essential infrastructure
**Effort:** Human: 2 months / CC: 2 weeks (depends on ExPress API availability)
**Risk:** High — government API documentation is often poor
**Verdict:** Research ExPress API first before committing

---

### Opportunity E: RA Consultant Multi-Client Dashboard

**What:** One RA firm manages 20 client companies' submissions in a single view
**Why:** RA consultants are the highest-value segment (NT$30K+/mo). They manage multiple clients.
**Effort:** Human: 1 week / CC: 1 hour
**Risk:** Low
**Revenue impact:** One consulting firm account = 10x a single company account

---

### Opportunity F: Regional ASEAN Expansion

**What:** Add schemas for BPOM (Indonesia), HPB (Singapore), FDA Vietnam
**Why:** ASEAN regulatory harmonization trend; companies operating in Taiwan often need regional approvals
**Effort:** Human: 3 weeks / CC: 1 hour (schema additions)
**Risk:** Medium (requires regulatory domain expertise per country)
**Verdict:** Future roadmap — validate Taiwan PMF first

---

## Immediate Action Plan (What to do now)

This is the minimum path from "internal tool" to "first external paying customer":

```
Week 1: Cloud deploy + auth (Opportunities A + basic auth)
         → Tool is accessible via URL, login works
         → Cost: NT$0 on Render free tier

Week 2: Project CRUD + multi-tenant data (Opportunity B partial)
         → Any company can add their own projects
         → Migrate from JSON to SQLite/PostgreSQL

Week 3: Test suite + stabilization
         → Cover all checklist logic, risk assessment, cost tracking
         → Required before charging money

Week 4: Pilot with 3 external RA consultants (free)
         → Collect feedback, validate pricing
         → Goal: 1 paying customer by end of month
```

**Human team estimate:** 4-6 weeks
**With CC:** 4-6 days of focused work

---

## Technical Debt to Address Before Launch

| Issue | Severity | Fix |
|-------|---------|-----|
| 130MB EXE distribution | 🔴 Critical | Cloud deploy |
| No tests | 🔴 Critical | Write test suite before external launch |
| JSON data layer | 🟠 High | Migrate to PostgreSQL/SQLite |
| No auth/multi-tenant | 🔴 Critical | Add before first external user |
| Hardcoded projects | 🟠 High | Project CRUD UI |
| Multiple .spec files (4 variants) | 🟡 Medium | Clean up, single build path |
| Exchange rates hardcoded in YAML | 🟡 Medium | Use live API (ExchangeRate-API free tier) |
| TFDA scraper may break on site changes | 🟡 Medium | Add error handling + fallback |

---

## What You Should NOT Do

- **Do not rewrite in a different framework.** Streamlit is fine for v1 SaaS. Migrate when you have 100+ paying customers and hit its limits.
- **Do not add features before cloud deploy.** The distribution problem kills adoption. Fix it first.
- **Do not skip the test suite.** A compliance tool with no tests is a liability, not a product.
- **Do not try to boil the ocean on ASEAN expansion now.** Dominate Taiwan first.

---

## EUREKA Observation

**Everyone builds TFDA compliance tools as enterprise software with multi-month implementations.** But regulatory submissions are fundamentally a *checklist with deadlines and documents* — a problem that AI and modern web frameworks can solve in days. The moat is not the software complexity; it is the **embedded regulatory domain knowledge** (your YAML schemas). That's the hard part, and you already built it. The software wrapping it is the cheap part.

---

## Verdict

| Dimension | Score | Note |
|-----------|-------|------|
| Problem validity | 9/10 | Real pain, real market |
| Domain expertise embedded | 8/10 | TFDA schemas are genuinely valuable |
| Technical execution | 6/10 | Good internal tool, not yet product-ready |
| Distribution strategy | 2/10 | 130MB EXE is a dead end for SaaS |
| Market readiness | 4/10 | Needs auth + cloud deploy to be sellable |
| 10x potential | 8/10 | AI document analysis is a clear moat |

**Overall: Strong foundation, wrong distribution model. Fix the packaging, add auth, launch cloud version. First external paying customer is 4-6 CC-assisted days away.**

---

*Generated by plan-ceo-review skill | gstack | 2026-03-24*
