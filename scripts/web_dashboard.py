#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regulatory Review Web Dashboard (Streamlit) — Modern Figma-style UI
Interactive dashboard for monitoring regulatory project status
"""

import json
import sys
from pathlib import Path
from datetime import datetime, date
from typing import Dict, List, Optional

# ── Auth / DB (Phase 2) ───────────────────────────────────────────────────────
_PHASE2_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_PHASE2_ROOT))

_AUTH_AVAILABLE = False
try:
    from database.db import init_db, get_db
    from database.models import Project, ChecklistItem
    from auth.register import register_company_and_admin
    from auth.login import verify_login, get_company_for_user
    from auth.session import (
        init_auth_session, is_authenticated,
        get_current_user, get_current_company,
        login_session, logout_session, require_role,
    )
    _AUTH_AVAILABLE = True
except Exception:
    pass  # gracefully degrade to single-user mode if deps missing

# ── Streamlit & Plotly ───────────────────────────────────────────────────────
try:
    import streamlit as st
    import plotly.graph_objects as go
    import pandas as pd
    STREAMLIT_AVAILABLE = True
except ImportError:
    STREAMLIT_AVAILABLE = False
    print("Install with: pip install streamlit plotly pandas")
    sys.exit(1)

# ── Local imports (optional) ─────────────────────────────────────────────────
SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

# ── Update check & OpenClaw sync ───────────────────────────────────────────
CURRENT_VERSION = "2.0.0"
UPDATE_CHECK_URL = "https://api.github.com/repos/bounce12340/regulatory-review/releases/latest"
OPENCLAW_GATEWAY_URL = "http://127.0.0.1:18789"


def check_for_updates():
    """Check if a newer version is available."""
    try:
        import urllib.request
        import ssl

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(
            UPDATE_CHECK_URL,
            headers={"User-Agent": "RegulatoryReview-Desktop/2.0"}
        )

        with urllib.request.urlopen(req, timeout=5, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            latest_version = data.get('tag_name', 'v1.0.0').replace('v', '')
            download_url = data.get('html_url', '')

            # Compare versions
            current = tuple(map(int, CURRENT_VERSION.split('.')))
            latest = tuple(map(int, latest_version.split('.')))

            if latest > current:
                return {
                    'available': True,
                    'current': CURRENT_VERSION,
                    'latest': latest_version,
                    'url': download_url,
                    'notes': data.get('body', 'No release notes')
                }
    except Exception:
        pass

    return {'available': False, 'current': CURRENT_VERSION}


def sync_to_openclaw(project_name: str, report_data: dict):
    """Sync updated report data to OpenClaw via WebSocket or file watch."""
    try:
        # Method 1: Write to a sync file that OpenClaw can watch
        sync_dir = Path.home() / ".openclaw" / "workspace" / "regulatory-sync"
        sync_dir.mkdir(parents=True, exist_ok=True)

        sync_file = sync_dir / f"{project_name}-sync-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

        sync_data = {
            "type": "regulatory_update",
            "project": project_name,
            "timestamp": datetime.now().isoformat(),
            "version": CURRENT_VERSION,
            "data": report_data
        }

        with open(sync_file, 'w', encoding='utf-8') as f:
            json.dump(sync_data, f, ensure_ascii=False, indent=2)

        # Method 2: Try to send via HTTP to OpenClaw gateway (if running)
        try:
            import urllib.request
            req = urllib.request.Request(
                f"{OPENCLAW_GATEWAY_URL}/api/v1/sync",
                data=json.dumps(sync_data).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=2):
                return {'success': True, 'method': 'http', 'file': str(sync_file)}
        except Exception:
            pass

        return {'success': True, 'method': 'file', 'file': str(sync_file)}

    except Exception as e:
        return {'success': False, 'error': str(e)}


# ── Phase 4: AI document analysis ────────────────────────────────────────────
_AI_AVAILABLE = False
try:
    _AI_ROOT = Path(__file__).parent.parent
    sys.path.insert(0, str(_AI_ROOT))
    from ai.gap_analyzer import GapAnalyzer, GapReport, SCHEMA_TYPE_MAP
    _AI_AVAILABLE = True
except Exception:
    pass  # gracefully degrade if AI deps missing

PDF_AVAILABLE = False

try:
    from outputs.word_generator import WordGenerator
    WORD_AVAILABLE = True
except Exception:
    WORD_AVAILABLE = False

# ── Constants ─────────────────────────────────────────────────────────────────
PROJECTS_ROOT = Path.home() / "productivity" / "projects"

DEADLINES: Dict[str, date] = {
    "fenogal":   date(2026, 5, 18),
    "gastrilex": date(2026, 6, 30),
}

STATUS_COLORS = {
    "completed":    "#10b981",
    "in_progress":  "#f59e0b",
    "under_review": "#3b82f6",
    "blocked":      "#ef4444",
    "pending":      "#94a3b8",
}

STATUS_ICONS = {
    "completed":    "✓",
    "in_progress":  "◐",
    "under_review": "◉",
    "blocked":      "✕",
    "pending":      "○",
}

RISK_COLORS = {
    "low":    "#10b981",
    "medium": "#f59e0b",
    "high":   "#ef4444",
}

# Design tokens
NAVY     = "#1e3a5c"
ACCENT   = "#3b82f6"
LIGHT_BG = "#f8fafc"
CARD_BG  = "#ffffff"
BORDER   = "#e2e8f0"
TEXT_PRI = "#1e293b"
TEXT_SEC = "#64748b"

# ── CSS injection ─────────────────────────────────────────────────────────────

LIGHT_CSS = """
<style>
/* ── Google Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* ── Reset / Base ── */
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
}

/* ── App background ── */
.stApp {
    background: #f1f5f9 !important;
}

/* ── Hide default Streamlit decorations ── */
#MainMenu, footer, header { visibility: hidden; }
.block-container {
    padding-top: 1.5rem !important;
    padding-bottom: 2rem !important;
    max-width: 1400px !important;
}

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background: #1e3a5c !important;
    border-right: none !important;
}
[data-testid="stSidebar"] * {
    color: #e2e8f0 !important;
}
[data-testid="stSidebar"] .stSelectbox label,
[data-testid="stSidebar"] .stTextInput label,
[data-testid="stSidebar"] .stCheckbox label {
    color: #94a3b8 !important;
    font-size: 0.75rem !important;
    font-weight: 500 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
}
[data-testid="stSidebar"] [data-baseweb="select"] > div {
    background: rgba(255,255,255,0.08) !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 8px !important;
    color: #f1f5f9 !important;
}
[data-testid="stSidebar"] input {
    background: rgba(255,255,255,0.08) !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 8px !important;
    color: #f1f5f9 !important;
}
[data-testid="stSidebar"] hr {
    border-color: rgba(255,255,255,0.12) !important;
}

/* ── Sidebar logo strip ── */
.sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0 16px 0;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    margin-bottom: 20px;
}
.sidebar-logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
}
.sidebar-logo-text {
    font-size: 0.85rem;
    font-weight: 600;
    color: #f1f5f9 !important;
    line-height: 1.3;
}
.sidebar-logo-sub {
    font-size: 0.7rem;
    color: #94a3b8 !important;
    font-weight: 400;
}

/* ── Sidebar nav item ── */
.nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    margin-bottom: 4px;
    cursor: pointer;
    transition: background 0.15s;
    font-size: 0.85rem;
    font-weight: 500;
    color: #94a3b8 !important;
}
.nav-item:hover { background: rgba(255,255,255,0.08); color: #f1f5f9 !important; }
.nav-item.active { background: rgba(59,130,246,0.25); color: #60a5fa !important; }
.nav-item .nav-icon { width: 18px; text-align: center; }

/* ── Page header ── */
.page-header {
    background: linear-gradient(135deg, #1e3a5c 0%, #1e40af 100%);
    border-radius: 16px;
    padding: 28px 32px;
    margin-bottom: 24px;
    color: white;
    box-shadow: 0 4px 24px rgba(30,58,92,0.18);
}
.page-header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 10px;
}
.page-header h1 {
    font-size: 1.75rem !important;
    font-weight: 700 !important;
    color: white !important;
    margin: 0 0 6px 0 !important;
    line-height: 1.2 !important;
}
.page-header-sub {
    font-size: 0.85rem;
    color: rgba(255,255,255,0.65);
    margin: 0;
}

/* ── KPI / Metric cards ── */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}
.kpi-card {
    background: white;
    border-radius: 12px;
    padding: 20px 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    border: 1px solid #e2e8f0;
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.2s, transform 0.2s;
}
.kpi-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.10);
    transform: translateY(-2px);
}
.kpi-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 12px 12px 0 0;
}
.kpi-card.blue::before   { background: #3b82f6; }
.kpi-card.green::before  { background: #10b981; }
.kpi-card.amber::before  { background: #f59e0b; }
.kpi-card.red::before    { background: #ef4444; }
.kpi-card.purple::before { background: #8b5cf6; }
.kpi-icon {
    width: 38px; height: 38px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
    margin-bottom: 12px;
}
.kpi-icon.blue   { background: #eff6ff; }
.kpi-icon.green  { background: #ecfdf5; }
.kpi-icon.amber  { background: #fffbeb; }
.kpi-icon.red    { background: #fef2f2; }
.kpi-icon.purple { background: #f5f3ff; }
.kpi-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1;
    margin-bottom: 4px;
}
.kpi-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.kpi-delta {
    font-size: 0.75rem;
    font-weight: 500;
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
}
.kpi-delta.warn { color: #ef4444; }
.kpi-delta.ok   { color: #10b981; }

/* ── Section card wrapper ── */
.section-card {
    background: white;
    border-radius: 12px;
    padding: 20px 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    border: 1px solid #e2e8f0;
    margin-bottom: 20px;
}
.section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.section-title .title-icon {
    width: 28px; height: 28px;
    background: #eff6ff;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
}

/* ── Progress bar ── */
.prog-bar-wrap {
    background: #f1f5f9;
    border-radius: 999px;
    height: 8px;
    overflow: hidden;
    margin-top: 6px;
}
.prog-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #3b82f6, #6366f1);
    transition: width 0.5s ease;
}
.prog-bar-fill.warn { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.prog-bar-fill.ok   { background: linear-gradient(90deg, #10b981, #34d399); }
.prog-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: #64748b;
    margin-bottom: 4px;
}

/* ── Badge ── */
.badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.03em;
}
.badge-completed    { background: #ecfdf5; color: #059669; }
.badge-in_progress  { background: #fffbeb; color: #d97706; }
.badge-under_review { background: #eff6ff; color: #2563eb; }
.badge-blocked      { background: #fef2f2; color: #dc2626; }
.badge-pending      { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
.badge-low    { background: #ecfdf5; color: #059669; }
.badge-medium { background: #fffbeb; color: #d97706; }
.badge-high   { background: #fef2f2; color: #dc2626; }

/* ── Action item row ── */
.action-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #fee2e2;
    background: #fff5f5;
    margin-bottom: 8px;
    transition: background 0.15s;
}
.action-row:hover { background: #fef2f2; }
.action-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
}
.action-dot.high   { background: #ef4444; }
.action-dot.medium { background: #f59e0b; }
.action-dot.low    { background: #10b981; }
.action-text { font-size: 0.82rem; color: #374151; flex: 1; line-height: 1.5; }
.action-priority {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 999px;
    flex-shrink: 0;
}
.action-priority.high   { background: #fef2f2; color: #dc2626; }
.action-priority.medium { background: #fffbeb; color: #d97706; }

/* ── Overview table ── */
.overview-row {
    display: grid;
    grid-template-columns: 1fr 110px 100px 80px 110px;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.82rem;
    align-items: center;
}
.overview-row.header {
    background: #f8fafc;
    font-weight: 600;
    color: #64748b;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #e2e8f0;
}
.overview-row:not(.header) { border-bottom: 1px solid #f1f5f9; }
.overview-row:not(.header):hover { background: #f8fafc; }

/* ── Export buttons ── */
.stDownloadButton > button {
    background: white !important;
    border: 1.5px solid #e2e8f0 !important;
    border-radius: 8px !important;
    color: #374151 !important;
    font-size: 0.82rem !important;
    font-weight: 500 !important;
    padding: 8px 16px !important;
    width: 100% !important;
    transition: all 0.15s !important;
}
.stDownloadButton > button:hover {
    border-color: #3b82f6 !important;
    color: #3b82f6 !important;
    background: #eff6ff !important;
}

/* ── Streamlit metric overrides ── */
[data-testid="metric-container"] {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px 20px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* ── Dark mode toggle button ── */
.mode-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 0.78rem;
    color: #cbd5e1;
    cursor: pointer;
    margin-top: 8px;
    width: 100%;
    justify-content: center;
    transition: background 0.15s;
}
.mode-btn:hover { background: rgba(255,255,255,0.18); }

/* ── Divider ── */
.divider {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
}
/* Hide Streamlit's own hr */
hr { display: none; }

/* ── Expander styling ── */
[data-testid="stExpander"] {
    border: 1px solid #e2e8f0 !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    background: white !important;
    margin-bottom: 8px !important;
}
[data-testid="stExpander"] summary {
    background: #f8fafc !important;
    padding: 10px 14px !important;
    font-size: 0.85rem !important;
    font-weight: 500 !important;
    color: #374151 !important;
}

/* ── Plotly charts ── */
.js-plotly-plot { border-radius: 8px; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
"""

DARK_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
}
.stApp { background: #0f172a !important; }
#MainMenu, footer, header { visibility: hidden; }
.block-container {
    padding-top: 1.5rem !important;
    padding-bottom: 2rem !important;
    max-width: 1400px !important;
}
[data-testid="stSidebar"] {
    background: #0f172a !important;
    border-right: 1px solid #1e293b !important;
}
[data-testid="stSidebar"] * { color: #94a3b8 !important; }
[data-testid="stSidebar"] [data-baseweb="select"] > div {
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    color: #e2e8f0 !important;
}
[data-testid="stSidebar"] input {
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    color: #e2e8f0 !important;
}
[data-testid="stSidebar"] hr { border-color: #1e293b !important; }
.page-header {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 16px;
    padding: 28px 32px;
    margin-bottom: 24px;
    color: white;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    border: 1px solid #1e293b;
}
.kpi-card, .section-card {
    background: #1e293b !important;
    border-color: #334155 !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
}
.kpi-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
}
.kpi-value, .section-title { color: #f1f5f9 !important; }
.kpi-label { color: #64748b !important; }
.kpi-icon.blue   { background: #1e3a5f; }
.kpi-icon.green  { background: #064e3b; }
.kpi-icon.amber  { background: #451a03; }
.kpi-icon.red    { background: #450a0a; }
.kpi-icon.purple { background: #2e1065; }
.prog-bar-wrap { background: #334155; }
.badge-completed    { background: #064e3b; color: #34d399; }
.badge-in_progress  { background: #451a03; color: #fbbf24; }
.badge-under_review { background: #1e3a5f; color: #60a5fa; }
.badge-blocked      { background: #450a0a; color: #f87171; }
.badge-pending      { background: #1e293b; color: #94a3b8; border-color: #334155; }
.badge-low    { background: #064e3b; color: #34d399; }
.badge-medium { background: #451a03; color: #fbbf24; }
.badge-high   { background: #450a0a; color: #f87171; }
.action-row { border-color: #450a0a; background: #1e0b0b; }
.action-row:hover { background: #270f0f; }
.action-text { color: #e2e8f0; }
.action-priority.high   { background: #450a0a; color: #f87171; }
.action-priority.medium { background: #451a03; color: #fbbf24; }
.overview-row.header { background: #1e293b; color: #64748b; }
.overview-row:not(.header):hover { background: #1e293b; }
.overview-row:not(.header) { border-color: #1e293b; }
.stDownloadButton > button {
    background: #1e293b !important;
    border-color: #334155 !important;
    color: #e2e8f0 !important;
    border-radius: 8px !important;
}
.stDownloadButton > button:hover {
    border-color: #3b82f6 !important;
    color: #60a5fa !important;
    background: #1e3a5f !important;
}
[data-testid="metric-container"] {
    background: #1e293b;
    border-color: #334155;
    border-radius: 12px;
    padding: 16px 20px !important;
}
[data-testid="stExpander"] {
    border-color: #334155 !important;
    background: #1e293b !important;
}
[data-testid="stExpander"] summary {
    background: #0f172a !important;
    color: #e2e8f0 !important;
}
.divider { border-color: #1e293b; }
::-webkit-scrollbar-track { background: #0f172a; }
::-webkit-scrollbar-thumb { background: #334155; }
::-webkit-scrollbar-thumb:hover { background: #475569; }
</style>
"""

# ── Plotly theme ──────────────────────────────────────────────────────────────

def plotly_layout(dark: bool = False) -> dict:
    bg     = "#1e293b" if dark else "white"
    paper  = "#1e293b" if dark else "white"
    text   = "#94a3b8" if dark else "#64748b"
    grid   = "#334155" if dark else "#f1f5f9"
    return dict(
        paper_bgcolor=paper,
        plot_bgcolor=bg,
        font=dict(family="Inter, sans-serif", color=text, size=11),
        xaxis=dict(gridcolor=grid, linecolor=grid, showgrid=True, zeroline=False),
        yaxis=dict(gridcolor=grid, linecolor=grid, showgrid=True, zeroline=False),
        margin=dict(t=16, b=36, l=36, r=16),
        legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(size=11)),
        hoverlabel=dict(
            bgcolor="#1e3a5c" if not dark else "#0f172a",
            font_color="white",
            bordercolor="#3b82f6",
        ),
    )


# ── Data loading helpers ──────────────────────────────────────────────────────

def load_project_names(projects_root: Path = PROJECTS_ROOT) -> List[str]:
    names: List[str] = []
    if projects_root.exists():
        for d in sorted(projects_root.iterdir()):
            if d.is_dir() and list(d.glob("review/*.json")):
                names.append(d.name)
    for demo in ("fenogal", "gastrilex"):
        if demo not in names:
            names.append(f"{demo} (demo)")
    return names


def load_project_report(project_name: str, projects_root: Path = PROJECTS_ROOT) -> Optional[Dict]:
    clean = project_name.replace(" (demo)", "")
    review_dir = projects_root / clean / "review"
    files = list(review_dir.glob("*.json")) if review_dir.exists() else []
    if files:
        latest = max(files, key=lambda p: p.stat().st_mtime)
        with open(latest, "r", encoding="utf-8") as f:
            return json.load(f)
    return _demo_report(clean)


def _demo_report(project: str) -> Dict:
    if project == "gastrilex":
        items = [
            {
                "item": "食品業者登錄證明", "category": "business_reg",
                "status": "completed", "notes": "已完成登錄", "risk_level": "low",
            },
            {
                "item": "產品配方及製造流程說明書", "category": "formulation",
                "status": "in_progress", "notes": "配方修訂中", "risk_level": "medium",
            },
            {
                "item": "原料規格及來源證明", "category": "raw_materials",
                "status": "pending", "notes": "等待供應商文件", "risk_level": "high",
            },
            {
                "item": "成品檢驗規格及方法", "category": "testing_specs",
                "status": "under_review", "notes": "實驗室審查中", "risk_level": "medium",
            },
            {
                "item": "衛生安全性試驗報告", "category": "safety_testing",
                "status": "pending", "notes": "尚未開始", "risk_level": "high",
            },
        ]
        completion = 20.0
        status = "needs_attention"
    else:
        items = [
            {
                "item": "換發新證申請書", "category": "license_renewal",
                "status": "in_progress", "notes": "預計 2026-03-23 完成", "risk_level": "high",
            },
            {
                "item": "成品製造廠 GMP 核備函", "category": "gmp",
                "status": "completed", "notes": "GMP 展延已完成", "risk_level": "low",
            },
            {
                "item": "藥典/廠規檢驗規格變更備查", "category": "specification",
                "status": "under_review", "notes": "TFDA 審查中", "risk_level": "medium",
            },
            {
                "item": "原料藥製造廠 GMP 證明文件", "category": "api_gmp",
                "status": "completed", "notes": "附 QR code GMP 證書", "risk_level": "low",
            },
            {
                "item": "非登不可上傳原料藥 GMP 文件", "category": "api_upload",
                "status": "blocked", "notes": "QR code 驗證失敗", "risk_level": "high",
            },
            {
                "item": "成品元素不純物風險評估報告", "category": "risk_assessment",
                "status": "completed", "notes": "風險評估已核准", "risk_level": "low",
            },
            {
                "item": "ExPress 平臺上傳補正內容", "category": "submission",
                "status": "pending", "notes": "等待所有文件就緒", "risk_level": "medium",
            },
        ]
        completion = 42.9
        status = "needs_attention"

    high_risk = [i for i in items if i["risk_level"] == "high"]
    return {
        "review_date": datetime.now().isoformat(),
        "project": project,
        "document_type": "food_registration" if project == "gastrilex" else "drug_registration_extension",
        "overall_status": status,
        "completion_rate": f"{completion:.1f}%",
        "items": items,
        "risks": high_risk,
        "action_items": [
            {"item": i["item"], "priority": "high", "action": "立即處理"}
            for i in high_risk
        ],
        "summary": {
            "completed": sum(1 for i in items if i["status"] == "completed"),
            "total": len(items),
            "high_risk_items": len(high_risk),
        },
    }


def _parse_completion(s) -> float:
    try:
        return float(str(s).replace("%", ""))
    except Exception:
        return 0.0


# ── HTML helpers ──────────────────────────────────────────────────────────────

def kpi_card(icon: str, value: str, label: str, color: str, delta: str = "", delta_ok: bool = True) -> str:
    delta_html = ""
    if delta:
        cls = "ok" if delta_ok else "warn"
        arrow = "↑" if delta_ok else "↓"
        delta_html = f'<div class="kpi-delta {cls}">{arrow} {delta}</div>'
    return f"""
    <div class="kpi-card {color}">
        <div class="kpi-icon {color}">{icon}</div>
        <div class="kpi-value">{value}</div>
        <div class="kpi-label">{label}</div>
        {delta_html}
    </div>
    """


def badge(text: str, cls: str) -> str:
    icon = STATUS_ICONS.get(text, "")
    return f'<span class="badge badge-{cls}">{icon} {text.replace("_", " ").title()}</span>'


def risk_badge(text: str) -> str:
    icons = {"low": "▼", "medium": "◆", "high": "▲"}
    return f'<span class="badge badge-{text}">{icons.get(text, "")} {text.upper()}</span>'


def prog_bar(pct: float, label: str = "", warn_threshold: float = 30.0) -> str:
    cls = "warn" if pct < warn_threshold else "ok" if pct > 70 else ""
    return f"""
    <div>
        <div class="prog-label"><span>{label}</span><span>{pct:.1f}%</span></div>
        <div class="prog-bar-wrap">
            <div class="prog-bar-fill {cls}" style="width:{pct}%"></div>
        </div>
    </div>
    """


# ── Chart builders ─────────────────────────────────────────────────────────────

def build_progress_chart(report: Dict, dark: bool = False) -> go.Figure:
    summary   = report.get("summary", {})
    completed = summary.get("completed", 0)
    total     = summary.get("total", 1)
    remaining = total - completed
    comp_pct  = _parse_completion(report.get("completion_rate", "0%"))

    colors = (
        ["#3b82f6", "#334155"] if dark else ["#3b82f6", "#e2e8f0"]
    )
    fig = go.Figure(go.Pie(
        values=[completed, remaining],
        labels=["已完成", "未完成"],
        hole=0.68,
        marker=dict(colors=colors, line=dict(width=0)),
        textinfo="none",
        hovertemplate="%{label}: %{value}<extra></extra>",
    ))
    ann_color = "#f1f5f9" if dark else "#1e293b"
    fig.update_layout(
        **plotly_layout(dark),
        annotations=[
            dict(text=f"<b>{comp_pct:.0f}%</b>", x=0.5, y=0.55,
                 font=dict(size=26, color=ann_color), showarrow=False),
            dict(text="完成度", x=0.5, y=0.40,
                 font=dict(size=11, color="#64748b"), showarrow=False),
        ],
        showlegend=True,
        height=240,
        legend=dict(orientation="h", y=-0.08, x=0.5, xanchor="center"),
    )
    return fig


def build_status_bar(items: List[Dict], dark: bool = False) -> go.Figure:
    status_counts: Dict[str, int] = {}
    for item in items:
        s = item.get("status", "pending")
        status_counts[s] = status_counts.get(s, 0) + 1

    labels = list(status_counts.keys())
    values = [status_counts[l] for l in labels]
    display = [l.replace("_", " ").title() for l in labels]
    colors  = [STATUS_COLORS.get(l, "#94a3b8") for l in labels]

    fig = go.Figure(go.Bar(
        x=display, y=values,
        marker=dict(color=colors, line=dict(width=0)),
        text=values, textposition="outside",
        hovertemplate="%{x}: %{y}<extra></extra>",
    ))
    fig.update_layout(
        **plotly_layout(dark),
        height=240,
        bargap=0.35,
        yaxis=dict(showgrid=True, zeroline=False, tick0=0, dtick=1),
    )
    return fig


def build_risk_chart(items: List[Dict], dark: bool = False) -> go.Figure:
    risk_counts = {"low": 0, "medium": 0, "high": 0}
    for i in items:
        r = i.get("risk_level", "medium")
        if r in risk_counts:
            risk_counts[r] += 1

    labels = ["Low", "Medium", "High"]
    values = [risk_counts["low"], risk_counts["medium"], risk_counts["high"]]
    colors = ["#10b981", "#f59e0b", "#ef4444"]

    fig = go.Figure(go.Bar(
        x=labels, y=values,
        marker=dict(color=colors, line=dict(width=0)),
        text=values, textposition="outside",
        hovertemplate="%{x} risk: %{y} items<extra></extra>",
    ))
    fig.update_layout(
        **plotly_layout(dark),
        height=240,
        bargap=0.4,
        yaxis=dict(showgrid=True, zeroline=False, tick0=0, dtick=1),
    )
    return fig


def build_timeline_chart(projects: List[Dict], dark: bool = False) -> go.Figure:
    today = date.today()
    names, days_list, colors = [], [], []
    for p in projects:
        dl = DEADLINES.get(p["name"].lower())
        if dl:
            days = (dl - today).days
            names.append(p["name"].upper())
            days_list.append(max(days, 0))
            colors.append(
                "#ef4444" if days < 30 else "#f59e0b" if days < 90 else "#10b981"
            )

    if not names:
        return go.Figure()

    fig = go.Figure(go.Bar(
        x=names, y=days_list,
        marker=dict(color=colors, line=dict(width=0)),
        text=[f"{d}d" for d in days_list],
        textposition="outside",
        hovertemplate="%{x}: %{y} days remaining<extra></extra>",
    ))
    fig.update_layout(
        **plotly_layout(dark),
        yaxis_title="Days Until Deadline",
        height=240,
        bargap=0.4,
    )
    return fig


def build_radar_chart(all_projects: List[Dict], dark: bool = False) -> go.Figure:
    fig = go.Figure()
    cat_color = "#94a3b8" if dark else "#64748b"
    for p in all_projects:
        comp = p.get("completion", 0)
        risk = max(0, 100 - p.get("high_risk", 0) * 25)
        days = p.get("days_remaining") or 0
        urgency = min(100, max(0, days / 2))
        fig.add_trace(go.Scatterpolar(
            r=[comp, risk, urgency],
            theta=["Completion", "Safety", "Time Buffer"],
            fill="toself",
            name=p["name"].upper(),
            line=dict(width=2),
            opacity=0.7,
        ))
    fig.update_layout(
        **plotly_layout(dark),
        polar=dict(
            bgcolor="#1e293b" if dark else "#f8fafc",
            radialaxis=dict(
                visible=True, range=[0, 100],
                gridcolor="#334155" if dark else "#e2e8f0",
                color=cat_color,
            ),
            angularaxis=dict(
                gridcolor="#334155" if dark else "#e2e8f0",
                color=cat_color,
            ),
        ),
        showlegend=True,
        height=280,
    )
    return fig


# ── Export helpers ─────────────────────────────────────────────────────────────

def export_markdown(report: Dict) -> str:
    lines = [
        f"# Regulatory Review Report — {report.get('project', 'Unknown').upper()}",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}  ",
        f"**Status:** {report.get('overall_status', '').replace('_', ' ').title()}  ",
        f"**Completion:** {report.get('completion_rate', '0%')}",
        "",
        "## Checklist Items",
        "",
        "| Item | Status | Risk |",
        "|------|--------|------|",
    ]
    for item in report.get("items", []):
        lines.append(f"| {item['item']} | {item['status']} | {item['risk_level']} |")

    lines += ["", "## Action Items", ""]
    for action in report.get("action_items", []):
        lines.append(f"- **[{action['priority'].upper()}]** {action['item']}: {action.get('action', '')}")

    return "\n".join(lines)


# ── Phase 2: DB-aware data helpers ───────────────────────────────────────────

def load_project_names_db(company_id: int) -> List[str]:
    """Return project slugs for the current tenant from SQLite."""
    try:
        with get_db() as db:
            projects = (
                db.query(Project)
                .filter_by(company_id=company_id, status="active")
                .order_by(Project.name)
                .all()
            )
            return [p.slug for p in projects]
    except Exception:
        return []


def load_project_report_db(project_slug: str, company_id: int) -> Optional[Dict]:
    """Build a report dict from SQLite (same shape as JSON report)."""
    try:
        with get_db() as db:
            project = (
                db.query(Project)
                .filter_by(company_id=company_id, slug=project_slug)
                .first()
            )
            if project is None:
                return None
            items_raw = (
                db.query(ChecklistItem)
                .filter_by(project_id=project.id)
                .all()
            )
            items = [
                {
                    "item":       ci.item_name,
                    "category":   ci.category or "",
                    "status":     ci.status,
                    "notes":      ci.notes or "",
                    "risk_level": ci.risk_level,
                }
                for ci in items_raw
            ]
            completed   = sum(1 for i in items if i["status"] == "completed")
            high_risk   = [i for i in items if i["risk_level"] == "high"]
            total       = len(items)
            completion  = (completed / total * 100) if total else 0.0
            return {
                "review_date":    datetime.utcnow().isoformat(),
                "project":        project.slug,
                "document_type":  project.schema_type,
                "overall_status": "needs_attention" if high_risk else "on_track",
                "completion_rate": f"{completion:.1f}%",
                "items":          items,
                "risks":          high_risk,
                "action_items":   [
                    {"item": i["item"], "priority": "high", "action": "立即處理"}
                    for i in high_risk
                ],
                "summary": {
                    "completed":       completed,
                    "total":           total,
                    "high_risk_items": len(high_risk),
                },
                "_deadline": project.deadline,
            }
    except Exception:
        return None


def upsert_checklist_item_db(project_slug: str, company_id: int, item_name: str,
                              status: str, notes: str, risk_level: str, user_id: int):
    """Update a checklist item status in SQLite."""
    try:
        with get_db() as db:
            project = db.query(Project).filter_by(company_id=company_id, slug=project_slug).first()
            if project is None:
                return False
            ci = (
                db.query(ChecklistItem)
                .filter_by(project_id=project.id, item_name=item_name)
                .first()
            )
            if ci:
                ci.status     = status
                ci.notes      = notes
                ci.risk_level = risk_level
                ci.updated_by = user_id
                ci.updated_at = datetime.utcnow()
            return True
    except Exception:
        return False


# ── Phase 2: Auth page ────────────────────────────────────────────────────────

def render_auth_page():
    """Login / Register page shown when user is not authenticated."""
    st.markdown(LIGHT_CSS, unsafe_allow_html=True)

    # Centre the form
    _, col, _ = st.columns([1, 2, 1])
    with col:
        st.markdown("""
        <div style="text-align:center;padding:40px 0 24px 0">
            <div style="font-size:3rem">⚕</div>
            <h1 style="font-size:1.6rem;font-weight:700;color:#1e3a5c;margin:8px 0 4px 0">RegReview</h1>
            <p style="color:#64748b;font-size:0.9rem">法規審查管理系統 · Regulatory Review Platform</p>
        </div>
        """, unsafe_allow_html=True)

        tab_login, tab_register = st.tabs(["登入 Login", "註冊 Register"])

        # ── Login tab ──────────────────────────────────────────────────
        with tab_login:
            with st.form("login_form"):
                email    = st.text_input("電子郵件 Email", placeholder="you@company.com")
                password = st.text_input("密碼 Password", type="password")
                submitted = st.form_submit_button("登入", use_container_width=True, type="primary")

            if submitted:
                if not email or not password:
                    st.error("請填寫所有欄位。")
                else:
                    user = verify_login(email, password)
                    if user is None:
                        st.error("電子郵件或密碼錯誤。")
                    else:
                        company = get_company_for_user(user.id)
                        if company is None:
                            st.error("找不到所屬公司，請聯絡管理員。")
                        else:
                            login_session(user, company)
                            st.success(f"歡迎回來，{user.full_name}！")
                            st.rerun()

        # ── Register tab ───────────────────────────────────────────────
        with tab_register:
            st.markdown(
                '<p style="color:#64748b;font-size:0.82rem;margin-bottom:12px">'
                '建立新公司帳號（第一位使用者自動成為管理員）</p>',
                unsafe_allow_html=True,
            )
            with st.form("register_form"):
                company_name = st.text_input("公司名稱 Company Name", placeholder="Universal Integrated Corp.")
                full_name    = st.text_input("姓名 Full Name", placeholder="Josh Tsai")
                reg_email    = st.text_input("電子郵件 Email", placeholder="admin@company.com")
                reg_pw       = st.text_input("密碼 Password (min 8 chars)", type="password")
                reg_pw2      = st.text_input("確認密碼 Confirm Password", type="password")
                reg_submit   = st.form_submit_button("建立帳號", use_container_width=True, type="primary")

            if reg_submit:
                if not all([company_name, full_name, reg_email, reg_pw, reg_pw2]):
                    st.error("請填寫所有欄位。")
                elif reg_pw != reg_pw2:
                    st.error("兩次密碼輸入不一致。")
                else:
                    try:
                        company, user = register_company_and_admin(
                            company_name=company_name,
                            admin_email=reg_email,
                            admin_password=reg_pw,
                            admin_full_name=full_name,
                        )
                        login_session(user, company)
                        st.success(f"帳號建立成功！歡迎，{user.full_name}！")
                        st.rerun()
                    except ValueError as e:
                        st.error(str(e))
                    except Exception as e:
                        st.error(f"系統錯誤：{e}")


# ── Phase 2: Projects management page ────────────────────────────────────────

_SCHEMA_OPTIONS = {
    "drug_registration_extension": "藥品查驗登記 (換發)",
    "food_registration":           "食品登錄",
    "medical_device_registration": "醫療器材查驗登記",
}


def render_projects_page():
    """Full CRUD page for projects (admin / member)."""
    company = get_current_company()
    user    = get_current_user()
    if company is None:
        st.error("Session error — please log in again.")
        return

    st.markdown("""
    <div class="page-header">
        <div class="page-header-badge">📁 Projects</div>
        <h1>專案管理</h1>
        <p class="page-header-sub">建立、編輯、刪除法規審查專案</p>
    </div>
    """, unsafe_allow_html=True)

    # ── List existing projects ─────────────────────────────────────────
    with get_db() as db:
        projects = (
            db.query(Project)
            .filter_by(company_id=company["id"])
            .order_by(Project.created_at.desc())
            .all()
        )
        project_list = [
            {
                "id":          p.id,
                "name":        p.name,
                "slug":        p.slug,
                "schema_type": p.schema_type,
                "deadline":    p.deadline,
                "status":      p.status,
                "created_at":  p.created_at,
            }
            for p in projects
        ]

    if project_list:
        _html = (
            '<div class="section-card">'
            '<div class="section-title"><div class="title-icon">📋</div> 現有專案</div>'
        )
        st.markdown(_html, unsafe_allow_html=True)
        for p in project_list:
            dl_str = p["deadline"].strftime("%Y-%m-%d") if p["deadline"] else "未設定"
            schema_label = _SCHEMA_OPTIONS.get(p["schema_type"], p["schema_type"])
            col_info, col_actions = st.columns([4, 1])
            with col_info:
                st.markdown(f"""
                <div style="padding:12px 0;border-bottom:1px solid #e2e8f0">
                    <span style="font-weight:600;font-size:0.95rem;color:#1e293b">{p['name']}</span>
                    <span style="margin-left:12px;font-size:0.75rem;color:#64748b">{schema_label}</span>
                    <span style="margin-left:12px;font-size:0.75rem;color:#64748b">截止: {dl_str}</span>
                    <span style="margin-left:12px;font-size:0.75rem;padding:2px 8px;border-radius:999px;
                                background:#dbeafe;color:#1d4ed8">{p['status']}</span>
                </div>
                """, unsafe_allow_html=True)
            with col_actions:
                if require_role("admin", "member"):
                    if st.button("封存", key=f"archive_{p['id']}"):
                        with get_db() as db2:
                            proj = db2.query(Project).filter_by(id=p["id"]).first()
                            if proj:
                                proj.status = "archived"
                        st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)
    else:
        st.info("尚無專案。請使用下方表單建立第一個專案。")

    # ── Create new project form ────────────────────────────────────────
    if require_role("admin", "member"):
        _html = (
            '<div class="section-card">'
            '<div class="section-title"><div class="title-icon">➕</div> 建立新專案</div>'
        )
        st.markdown(_html, unsafe_allow_html=True)
        with st.form("create_project_form"):
            proj_name    = st.text_input("專案名稱", placeholder="Fenogal")
            schema_type  = st.selectbox("文件類型", options=list(_SCHEMA_OPTIONS.keys()),
                                        format_func=lambda k: _SCHEMA_OPTIONS[k])
            deadline_val = st.date_input("截止日期", value=date.today())
            description  = st.text_area("說明 (選填)", height=80)
            num_items    = st.number_input("初始檢查項目數量", min_value=0, max_value=20, value=0)
            create_btn   = st.form_submit_button("建立專案", type="primary")

        if create_btn:
            if not proj_name.strip():
                st.error("請輸入專案名稱。")
            else:
                import re as _re
                slug = _re.sub(r"[^\w-]", "-", proj_name.strip().lower())[:100]
                try:
                    with get_db() as db:
                        existing = db.query(Project).filter_by(
                            company_id=company["id"], slug=slug
                        ).first()
                        if existing:
                            st.error(f"專案 {slug!r} 已存在。")
                        else:
                            new_proj = Project(
                                company_id=company["id"],
                                created_by=user["id"],
                                name=proj_name.strip(),
                                slug=slug,
                                schema_type=schema_type,
                                deadline=datetime.combine(deadline_val, datetime.min.time()),
                                description=description.strip() or None,
                            )
                            db.add(new_proj)
                            db.flush()
                            # Add blank checklist items if requested
                            for i in range(int(num_items)):
                                db.add(ChecklistItem(
                                    project_id=new_proj.id,
                                    item_key=f"item{i+1}",
                                    item_name=f"項目 {i+1}",
                                    status="pending",
                                    risk_level="medium",
                                    updated_by=user["id"],
                                ))
                    st.success(f"專案 {proj_name.strip()!r} 建立成功！")
                    st.rerun()
                except Exception as e:
                    st.error(f"建立失敗：{e}")
        st.markdown('</div>', unsafe_allow_html=True)


# ── Main Streamlit app ────────────────────────────────────────────────────────

# ── Phase 4: AI Document Analysis Page ────────────────────────────────────────

def render_ai_analysis_page(dark: bool = False):
    """AI 文件分析頁面 — 上傳 PDF/Word，自動比對 TFDA 法規，產生缺口報告。"""

    st.markdown("""
    <div class="page-header">
        <div class="page-header-badge">🤖 AI Analysis</div>
        <h1>AI 文件缺口分析</h1>
        <p class="page-header-sub">上傳查驗登記文件，AI 自動與 TFDA 法規比對並產生缺口報告</p>
    </div>
    """, unsafe_allow_html=True)

    if not _AI_AVAILABLE:
        st.error(
            "AI 分析模組未載入。請安裝相依套件：\n\n"
            "```bash\npip install anthropic pypdf openpyxl\n```"
        )
        return

    # ── Session state defaults ─────────────────────────────────────────────
    for key, default in [
        ("ai_result", None),
        ("ai_filename", ""),
        ("ai_running", False),
    ]:
        if key not in st.session_state:
            st.session_state[key] = default

    # ── Upload & Config panel ──────────────────────────────────────────────
    card_bg = "#1e293b" if dark else "#ffffff"
    border_c = "#334155" if dark else "#e2e8f0"
    txt_pri  = "#f1f5f9" if dark else "#1e293b"
    txt_sec  = "#94a3b8" if dark else "#64748b"

    st.markdown(f"""
    <div style="background:{card_bg};border:1px solid {border_c};border-radius:12px;
                padding:24px;margin-bottom:20px">
        <div style="font-size:1rem;font-weight:600;color:{txt_pri};margin-bottom:16px">
            📁 文件上傳與設定
        </div>
    """, unsafe_allow_html=True)

    c1, c2 = st.columns([2, 1])
    with c1:
        uploaded_file = st.file_uploader(
            "拖曳或點選上傳文件",
            type=["pdf", "docx", "doc", "xlsx", "xls", "txt"],
            help="支援 PDF、Word（.docx）、Excel（.xlsx）、純文字格式",
        )
    with c2:
        schema_display_options = list(SCHEMA_TYPE_MAP.values())
        schema_display = st.selectbox(
            "申請類型",
            schema_display_options,
            help="選擇與文件對應的 TFDA 法規申請類型",
        )
        # Map display name back to schema key
        schema_key_map = {v: k for k, v in SCHEMA_TYPE_MAP.items()}
        schema_key = schema_key_map.get(schema_display, "drug_registration_extension")

    api_key_input = st.text_input(
        "Anthropic API Key（可選，優先使用環境變數 ANTHROPIC_API_KEY）",
        type="password",
        placeholder="sk-ant-...",
        help="若已設定環境變數，可留空",
    )

    st.markdown("</div>", unsafe_allow_html=True)

    # ── Analysis trigger ───────────────────────────────────────────────────
    can_analyze = uploaded_file is not None and not st.session_state.ai_running
    if st.button("🔍 開始 AI 分析", disabled=not can_analyze,
                 type="primary", use_container_width=True):
        st.session_state.ai_result = None
        st.session_state.ai_running = True

        with st.spinner("正在分析文件… 這可能需要 30–90 秒，請稍候。"):
            try:
                analyzer = GapAnalyzer(api_key=api_key_input or None)
                file_bytes = uploaded_file.read()
                report = analyzer.analyze(
                    file_bytes=file_bytes,
                    filename=uploaded_file.name,
                    project_type=schema_display,
                )
                st.session_state.ai_result = report
                st.session_state.ai_filename = uploaded_file.name
            except Exception as exc:
                st.error(f"分析失敗：{exc}")
            finally:
                st.session_state.ai_running = False
        st.rerun()

    if not can_analyze and uploaded_file is None:
        st.info("請先上傳文件，再點選「開始 AI 分析」。")

    # ── Results ────────────────────────────────────────────────────────────
    report: GapReport = st.session_state.ai_result
    if report is None:
        return

    if report.error:
        st.error(f"分析錯誤：{report.error}")
        return

    st.markdown("---")

    # ── Score cards ────────────────────────────────────────────────────────
    risk_color = {"high": "#ef4444", "medium": "#f59e0b", "low": "#10b981"}.get(
        report.risk_assessment, "#94a3b8"
    )
    score_color = "#10b981" if report.completeness_score >= 80 else \
                  "#f59e0b" if report.completeness_score >= 50 else "#ef4444"

    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.markdown(f"""
        <div style="background:{card_bg};border:1px solid {border_c};border-radius:10px;
                    padding:16px;text-align:center">
            <div style="font-size:2rem;font-weight:700;color:{score_color}">
                {report.completeness_score}%
            </div>
            <div style="font-size:0.75rem;color:{txt_sec};margin-top:4px">完整度評分</div>
        </div>""", unsafe_allow_html=True)
    with m2:
        st.markdown(f"""
        <div style="background:{card_bg};border:1px solid {border_c};border-radius:10px;
                    padding:16px;text-align:center">
            <div style="font-size:2rem;font-weight:700;color:{risk_color}">
                {report.risk_assessment.upper()}
            </div>
            <div style="font-size:0.75rem;color:{txt_sec};margin-top:4px">風險等級</div>
        </div>""", unsafe_allow_html=True)
    with m3:
        st.markdown(f"""
        <div style="background:{card_bg};border:1px solid {border_c};border-radius:10px;
                    padding:16px;text-align:center">
            <div style="font-size:2rem;font-weight:700;color:#ef4444">{len(report.high_gaps)}</div>
            <div style="font-size:0.75rem;color:{txt_sec};margin-top:4px">高風險缺口</div>
        </div>""", unsafe_allow_html=True)
    with m4:
        st.markdown(f"""
        <div style="background:{card_bg};border:1px solid {border_c};border-radius:10px;
                    padding:16px;text-align:center">
            <div style="font-size:2rem;font-weight:700;color:{txt_pri}">
                {len(report.compliant_items)}
            </div>
            <div style="font-size:0.75rem;color:{txt_sec};margin-top:4px">符合項目</div>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Summary ────────────────────────────────────────────────────────────
    if report.summary:
        st.markdown(f"""
        <div style="background:{card_bg};border:1px solid {border_c};border-radius:10px;
                    padding:20px;margin-bottom:16px">
            <div style="font-weight:600;color:{txt_pri};margin-bottom:8px">📝 分析摘要</div>
            <div style="color:{txt_sec};line-height:1.6">{report.summary}</div>
            <div style="margin-top:12px;font-size:0.75rem;color:{txt_sec}">
                預估審查時間：{report.estimated_review_time} ·
                Token 用量：輸入 {report.token_usage.get("input_tokens",0):,} /
                輸出 {report.token_usage.get("output_tokens",0):,} ·
                預估費用：NT${report.cost_ntd:.2f}
            </div>
        </div>""", unsafe_allow_html=True)

    # ── Gap items table ────────────────────────────────────────────────────
    if report.gaps:
        st.markdown(f"""
        <div style="background:{card_bg};border:1px solid {border_c};border-radius:10px;
                    padding:20px;margin-bottom:16px">
            <div style="font-weight:600;color:{txt_pri};margin-bottom:16px">
                ⚠️ 缺口清單（{len(report.gaps)} 項）
            </div>
        """, unsafe_allow_html=True)

        sev_icon  = {"high": "🔴", "medium": "🟡", "low": "🟢"}
        status_zh = {
            "missing": "缺失", "incomplete": "不完整",
            "non_compliant": "不符合", "present": "符合",
        }

        for g in sorted(report.gaps, key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x.severity, 3)):
            icon = sev_icon.get(g.severity, "⚪")
            sev_label_color = {
                "high": "#ef4444", "medium": "#f59e0b", "low": "#10b981"
            }.get(g.severity, "#94a3b8")
            status_label = status_zh.get(g.status, g.status)
            with st.expander(f"{icon} {g.requirement}  —  {status_label}", expanded=(g.severity == "high")):
                col_a, col_b = st.columns(2)
                with col_a:
                    _sev_html = (
                        f"**嚴重程度：** "
                        f"<span style='color:{sev_label_color};font-weight:600'>"
                        f"{g.severity.upper()}</span>"
                    )
                    st.markdown(_sev_html, unsafe_allow_html=True)
                    st.markdown(f"**說明：** {g.explanation}")
                with col_b:
                    st.markdown(f"**建議：** {g.recommendation}")

        st.markdown("</div>", unsafe_allow_html=True)

    # ── Action items ───────────────────────────────────────────────────────
    if report.action_items:
        st.markdown(f"""
        <div style="background:{card_bg};border:1px solid {border_c};border-radius:10px;
                    padding:20px;margin-bottom:16px">
            <div style="font-weight:600;color:{txt_pri};margin-bottom:12px">🎯 優先處理項目</div>
        """, unsafe_allow_html=True)
        for i, item in enumerate(report.action_items, 1):
            st.markdown(f"**{i}.** {item}")
        st.markdown("</div>", unsafe_allow_html=True)

    # ── Export buttons ─────────────────────────────────────────────────────
    st.markdown("#### 匯出報告")
    e1, e2, _e3 = st.columns([1, 1, 2])
    with e1:
        md_content = report.to_markdown()
        st.download_button(
            "⬇ 下載 Markdown 報告",
            data=md_content.encode("utf-8"),
            file_name=f"gap_report_{report.filename}.md",
            mime="text/markdown",
            use_container_width=True,
        )
    with e2:
        json_content = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
        st.download_button(
            "⬇ 下載 JSON 報告",
            data=json_content.encode("utf-8"),
            file_name=f"gap_report_{report.filename}.json",
            mime="application/json",
            use_container_width=True,
        )


def main():
    st.set_page_config(
        page_title="Regulatory Review",
        page_icon="⚕",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    # ── Phase 2: DB init + session ────────────────────────────────────────
    if _AUTH_AVAILABLE:
        try:
            init_db()
        except Exception:
            pass
        init_auth_session()

    # ── Session state defaults ─────────────────────────────────────────────
    if "dark_mode" not in st.session_state:
        st.session_state.dark_mode = False
    if "view" not in st.session_state:
        st.session_state.view = "overview"

    dark = st.session_state.dark_mode

    # ── Inject CSS ────────────────────────────────────────────────────────
    st.markdown(DARK_CSS if dark else LIGHT_CSS, unsafe_allow_html=True)

    # ── Auth gate ─────────────────────────────────────────────────────────
    if _AUTH_AVAILABLE and not is_authenticated():
        render_auth_page()
        return

    # ── Sidebar ───────────────────────────────────────────────────────────
    with st.sidebar:
        st.markdown("""
        <div class="sidebar-logo">
            <div class="sidebar-logo-icon">⚕</div>
            <div>
                <div class="sidebar-logo-text">RegReview</div>
                <div class="sidebar-logo-sub">Regulatory Dashboard</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("""
        <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.08em;color:#64748b;margin-bottom:8px">Navigation</div>
        """, unsafe_allow_html=True)

        nav_items = [
            ("overview",     "📋", "Project Overview"),
            ("timeline",     "📅", "Timeline & Deadlines"),
            ("comparison",   "📊", "Multi-Project View"),
            ("projects",     "📁", "Projects Management"),
            ("ai_analysis",  "🤖", "AI 文件分析"),
        ]
        for key, icon, label in nav_items:
            if st.button(f"{icon}  {label}", key=f"nav_{key}",
                         use_container_width=True):
                st.session_state.view = key
                st.rerun()

        st.markdown('<hr class="divider">', unsafe_allow_html=True)

        st.markdown("""
        <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.08em;color:#64748b;margin-bottom:8px">Project</div>
        """, unsafe_allow_html=True)

        # Load project names: from DB if authenticated, else from JSON files
        if _AUTH_AVAILABLE and is_authenticated():
            _company = get_current_company()
            _db_names = load_project_names_db(_company["id"]) if _company else []
            project_names = _db_names if _db_names else load_project_names()
        else:
            project_names = load_project_names()

        selected = st.selectbox("", project_names, label_visibility="collapsed")

        projects_root_input = st.text_input(
            "Data directory",
            value=str(PROJECTS_ROOT),
            help="Directory containing project folders (JSON fallback)",
        )
        projects_root = Path(projects_root_input).expanduser()

        st.markdown('<hr class="divider">', unsafe_allow_html=True)

        st.markdown("""
        <div style="font-size:0.68rem;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.08em;color:#64748b;margin-bottom:8px">Settings</div>
        """, unsafe_allow_html=True)

        mode_label = "☀️  淺色模式" if dark else "🌙  深色模式"
        if st.button(mode_label, use_container_width=True):
            st.session_state.dark_mode = not dark
            st.rerun()

        auto_refresh = st.checkbox("自動重新整理 (30 秒)", value=False)
        if auto_refresh:
            import time
            st.caption(f"最後更新: {datetime.now().strftime('%H:%M:%S')}")
            time.sleep(0.1)
            st.rerun()

        # ── User info & logout (Phase 2) ───────────────────────────────
        if _AUTH_AVAILABLE and is_authenticated():
            _u = get_current_user()
            _c = get_current_company()
            if _u and _c:
                st.markdown(
                    f'<div style="font-size:0.72rem;color:#94a3b8;margin-top:12px">'
                    f'<b style="color:#cbd5e1">{_u["name"]}</b><br>'
                    f'{_u["email"]}<br>'
                    f'<span style="font-size:0.65rem;opacity:0.7">{_c["name"]} · {_u["role"]}</span>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
            if st.button("登出 Logout", use_container_width=True):
                logout_session()
                st.rerun()

        st.markdown(
            f'<div style="font-size:0.68rem;color:#475569;margin-top:16px;'
            f'text-align:center">'
            f'v3.0 · {datetime.now().strftime("%Y-%m-%d")}</div>',
            unsafe_allow_html=True
        )

    # ── VIEW: PROJECTS MANAGEMENT ─────────────────────────────────────────
    if st.session_state.view == "projects":
        if _AUTH_AVAILABLE:
            render_projects_page()
        else:
            st.warning("Projects management requires the auth/database modules.")
        return

    # ── VIEW: AI DOCUMENT ANALYSIS ────────────────────────────────────────
    if st.session_state.view == "ai_analysis":
        render_ai_analysis_page(dark)
        return

    # ── Load data: DB first, JSON fallback ────────────────────────────────
    report = None
    if _AUTH_AVAILABLE and is_authenticated():
        _company = get_current_company()
        if _company:
            report = load_project_report_db(selected.replace(" (demo)", ""), _company["id"])
    if report is None:
        report = load_project_report(selected, projects_root)

    if not report:
        st.error(f"No review data found for **{selected}**.")
        return

    items:          List[Dict] = report.get("items", [])
    summary                    = report.get("summary", {})
    project_name               = report.get("project", selected)
    comp_pct                   = _parse_completion(report.get("completion_rate", "0%"))
    overall_status             = report.get("overall_status", "unknown")
    high_risk_count            = summary.get("high_risk_items", 0)
    # Deadline: from DB report or hardcoded map
    _db_deadline               = report.get("_deadline")
    deadline                   = (
        _db_deadline.date() if _db_deadline and hasattr(_db_deadline, "date")
        else DEADLINES.get(project_name.lower())
    )
    days_left                  = (deadline - date.today()).days if deadline else None

    # ── VIEW: OVERVIEW ─────────────────────────────────────────────────────
    if st.session_state.view == "overview":

        # Header
        urgency_badge = ""
        if days_left is not None:
            if days_left < 30:
                urgency_badge = (
                    '<span style="background:#fef2f2;color:#dc2626;'
                    'padding:3px 10px;border-radius:999px;'
                    'font-size:0.72rem;font-weight:600;margin-left:10px">🔴 緊急</span>'
                )
            elif days_left < 90:
                urgency_badge = (
                    '<span style="background:#fffbeb;color:#d97706;'
                    'padding:3px 10px;border-radius:999px;'
                    'font-size:0.72rem;font-weight:600;margin-left:10px">🟡 需關注</span>'
                )
            else:
                urgency_badge = (
                    '<span style="background:#ecfdf5;color:#059669;'
                    'padding:3px 10px;border-radius:999px;'
                    'font-size:0.72rem;font-weight:600;margin-left:10px">🟢 進度正常</span>'
                )

        doc_type  = report.get("document_type", "").replace("_", " ").title()
        rev_date  = report.get("review_date", "")[:10]
        dl_str    = deadline.strftime("%Y-%m-%d") if deadline else "N/A"

        st.markdown(f"""
        <div class="page-header">
            <div class="page-header-badge">⚕ 法規審查系統</div>
            <h1>{project_name.upper()}{urgency_badge}</h1>
            <p class="page-header-sub">
                {doc_type} &nbsp;·&nbsp; 上次審查: {rev_date}
                &nbsp;·&nbsp; 截止日期: {dl_str}
                {f'&nbsp;·&nbsp; <b>剩餘 {days_left} 天</b>' if days_left is not None else ''}
            </p>
        </div>
        """, unsafe_allow_html=True)

        # KPI Cards
        deadline_pct = 0.0
        if days_left is not None:
            window = 180
            deadline_pct = max(0.0, min(100.0, (window - days_left) / window * 100))

        kpi_html = f"""
        <div class="kpi-grid">
            {kpi_card("📈", f"{comp_pct:.1f}%", "完成度", "blue",
                      delta=f"{summary.get('completed',0)} / {summary.get('total', len(items))} 項",
                      delta_ok=True)}
            {kpi_card("✅", str(summary.get("completed", 0)), "已完成項目", "green")}
            {kpi_card("⚠️", str(high_risk_count), "高風險項目",
                      "red" if high_risk_count > 0 else "green",
                      delta="需立即處理" if high_risk_count else "一切正常",
                      delta_ok=high_risk_count == 0)}
            {kpi_card("📅", f"{days_left}天" if days_left is not None else "N/A", "剩餘天數",
                      "red" if (days_left or 99) < 30 else "amber" if (days_left or 99) < 90 else "green")}
            {kpi_card("📋", str(summary.get("total", len(items))), "總項目數", "purple")}
        </div>
        """
        st.markdown(kpi_html, unsafe_allow_html=True)

        # Progress bars
        st.markdown(f"""
        <div class="section-card">
            <div class="section-title">
                <div class="title-icon">📊</div> Progress Overview
            </div>
            {prog_bar(comp_pct, "Document Completion")}
            <div style="margin-top: 14px">
            {prog_bar(deadline_pct, "Timeline Elapsed", warn_threshold=75.0)}
            </div>
        </div>
        """, unsafe_allow_html=True)

        # Charts row
        c1, c2, c3 = st.columns(3)
        with c1:
            _html = (
                '<div class="section-card">'
                '<div class="section-title"><div class="title-icon">🔵</div> Completion</div>'
            )
            st.markdown(_html, unsafe_allow_html=True)
            st.plotly_chart(build_progress_chart(report, dark), use_container_width=True, key="prog_chart")
            st.markdown('</div>', unsafe_allow_html=True)
        with c2:
            _html = (
                '<div class="section-card">'
                '<div class="section-title"><div class="title-icon">📊</div> Status Breakdown</div>'
            )
            st.markdown(_html, unsafe_allow_html=True)
            st.plotly_chart(build_status_bar(items, dark), use_container_width=True, key="status_chart")
            st.markdown('</div>', unsafe_allow_html=True)
        with c3:
            _html = (
                '<div class="section-card">'
                '<div class="section-title"><div class="title-icon">⚠️</div> Risk Distribution</div>'
            )
            st.markdown(_html, unsafe_allow_html=True)
            st.plotly_chart(build_risk_chart(items, dark), use_container_width=True, key="risk_chart")
            st.markdown('</div>', unsafe_allow_html=True)

        # Checklist table
        _html = (
            '<div class="section-card">'
            '<div class="section-title"><div class="title-icon">📋</div> Checklist Items</div>'
        )
        st.markdown(_html, unsafe_allow_html=True)

        # Filter controls
        f1, f2, f3 = st.columns([1, 1, 2])
        with f1:
            all_statuses = list({i.get("status", "pending") for i in items})
            sel_status = st.multiselect(
                "Filter by Status", all_statuses, default=all_statuses,
                label_visibility="collapsed", placeholder="All statuses"
            )
        with f2:
            sel_risk = st.multiselect(
                "Filter by Risk", ["low", "medium", "high"],
                default=["low", "medium", "high"],
                label_visibility="collapsed", placeholder="All risk levels"
            )
        with f3:
            search_q = st.text_input("", placeholder="🔍  Search items...", label_visibility="collapsed")

        filtered = [
            i for i in items
            if (not sel_status or i.get("status") in sel_status)
            and (not sel_risk or i.get("risk_level") in sel_risk)
            and (not search_q or search_q.lower() in i.get("item", "").lower()
                 or search_q.lower() in i.get("notes", "").lower())
        ]

        df = pd.DataFrame([
            {
                "Item":     i.get("item", ""),
                "Category": i.get("category", "").replace("_", " ").title(),
                "Status":   i.get("status", ""),
                "Risk":     i.get("risk_level", ""),
                "Notes":    i.get("notes", ""),
            }
            for i in filtered
        ])

        def color_status(val):
            c = STATUS_COLORS.get(val, "#94a3b8")
            return f"background-color: {c}20; color: {c}; font-weight: 600; border-radius: 4px"

        def color_risk(val):
            c = RISK_COLORS.get(val, "#94a3b8")
            return f"background-color: {c}20; color: {c}; font-weight: 600; border-radius: 4px"

        styled = (
            df.style
            .map(color_status, subset=["Status"])
            .map(color_risk, subset=["Risk"])
            .set_properties(**{"font-size": "13px"})
        )
        st.dataframe(
            styled,
            use_container_width=True,
            height=min(520, (len(filtered) + 1) * 38 + 6),
        )
        _count_html = (
            f'<div style="font-size:0.75rem;color:#64748b;margin-top:6px">'
            f'{len(filtered)} of {len(items)} items shown</div>'
        )
        st.markdown(_count_html, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

        # Add New Task Section
        _html = (
            '<div class="section-card">'
            '<div class="section-title"><div class="title-icon">➕</div> 新增審查項目</div>'
        )
        st.markdown(_html, unsafe_allow_html=True)

        with st.form("add_task_form"):
            col1, col2 = st.columns(2)
            with col1:
                new_item_name = st.text_input("項目名稱", placeholder="輸入審查項目名稱...")
                new_item_category = st.selectbox(
                    "類別",
                    ["document", "gmp", "specification", "risk_assessment", "platform_upload", "other"]
                )
            with col2:
                new_item_status = st.selectbox(
                    "狀態", ["pending", "in_progress", "completed", "blocked", "under_review"]
                )
                new_item_risk = st.selectbox("風險等級", ["low", "medium", "high"])
            new_item_notes = st.text_area("備註", placeholder="輸入相關備註...")

            submitted = st.form_submit_button("➕ 新增項目", use_container_width=True)

            if submitted and new_item_name:
                # Load existing report
                report_path = projects_root / project_name / "review" / f"{project_name}-review-latest.json"
                if report_path.exists():
                    with open(report_path, 'r', encoding='utf-8') as f:
                        existing_report = json.load(f)

                    # Add new item
                    new_item = {
                        "item": new_item_name,
                        "category": new_item_category,
                        "status": new_item_status,
                        "risk_level": new_item_risk,
                        "notes": new_item_notes,
                        "last_updated": datetime.now().isoformat()
                    }

                    if "items" not in existing_report:
                        existing_report["items"] = []
                    existing_report["items"].append(new_item)

                    # Update summary
                    total_items = len(existing_report["items"])
                    completed_items = sum(1 for i in existing_report["items"] if i.get("status") == "completed")
                    high_risk_items = sum(1 for i in existing_report["items"] if i.get("risk_level") == "high")

                    existing_report["summary"]["total"] = total_items
                    existing_report["summary"]["completed"] = completed_items
                    existing_report["summary"]["high_risk_items"] = high_risk_items
                    existing_report["completion_rate"] = f"{completed_items / total_items * 100:.1f}%"
                    existing_report["review_date"] = datetime.now().isoformat()

                    # Save updated report
                    with open(report_path, 'w', encoding='utf-8') as f:
                        json.dump(existing_report, f, ensure_ascii=False, indent=2)

                    st.success(f"✅ 已新增項目: {new_item_name}")
                    st.rerun()
                else:
                    st.error("❌ 找不到專案報告檔案")

        st.markdown('</div>', unsafe_allow_html=True)

        # Action items
        action_items = report.get("action_items", [])
        if action_items:
            st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">⚡</div> Action Items</div>', unsafe_allow_html=True)
            for action in action_items:
                priority = action.get("priority", "medium")
                st.markdown(f"""
                <div class="action-row">
                    <div class="action-dot {priority}"></div>
                    <div class="action-text">
                        <strong>{action['item']}</strong><br>
                        <span style="opacity:0.75">{action.get('action', '')}</span>
                    </div>
                    <span class="action-priority {priority}">{priority.upper()}</span>
                </div>
                """, unsafe_allow_html=True)
            st.markdown('</div>', unsafe_allow_html=True)

        # Export
        st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">📤</div> Export Report</div>', unsafe_allow_html=True)
        e1, e2, e3 = st.columns(3)
        with e1:
            st.download_button(
                "⬇  Markdown (.md)",
                data=export_markdown(report).encode("utf-8"),
                file_name=f"{project_name}-review-{date.today()}.md",
                mime="text/markdown",
                use_container_width=True,
            )
        with e2:
            st.download_button(
                "⬇  JSON (.json)",
                data=json.dumps(report, ensure_ascii=False, indent=2, default=str).encode("utf-8"),
                file_name=f"{project_name}-review-{date.today()}.json",
                mime="application/json",
                use_container_width=True,
            )
        with e3:
            if WORD_AVAILABLE:
                try:
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
                        gen = WordGenerator()
                        gen.generate(report, tmp.name)
                        with open(tmp.name, "rb") as f:
                            word_bytes = f.read()
                    st.download_button(
                        "⬇  Word (.docx)",
                        data=word_bytes,
                        file_name=f"{project_name}-review-{date.today()}.docx",
                        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        use_container_width=True,
                    )
                except Exception as ex:
                    st.button("⬇  Word (.docx)", disabled=True, help=str(ex), use_container_width=True)
            else:
                st.button("⬇  Word (.docx)", disabled=True,
                          help="Install python-docx to enable Word export",
                          use_container_width=True)
        st.markdown('</div>', unsafe_allow_html=True)

        # Check for updates
        st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">🔄</div> 程式更新</div>', unsafe_allow_html=True)

        if st.button("🔍 檢查更新", use_container_width=True):
            with st.spinner("檢查中..."):
                update_info = check_for_updates()

            if update_info.get('available'):
                st.success(f"✅ 發現新版本: v{update_info['latest']}")
                st.info(f"📋 更新說明: {update_info.get('notes', '無')[:200]}...")
                st.markdown(f"[⬇️ 下載最新版本]({update_info['url']})", unsafe_allow_html=True)
            else:
                st.info(f"✓ 目前版本 v{update_info['current']} 已是最新")

        st.markdown('</div>', unsafe_allow_html=True)

        # OpenClaw Sync
        st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">☁️</div> OpenClaw 同步</div>', unsafe_allow_html=True)

        if st.button("🔄 同步到 OpenClaw", use_container_width=True):
            with st.spinner("同步中..."):
                sync_result = sync_to_openclaw(project_name, report)

            if sync_result.get('success'):
                st.success(f"✅ 同步成功！")
                st.info(f"📁 同步檔案: {sync_result.get('file', 'N/A')}")
                st.info(f"📡 同步方式: {sync_result.get('method', 'N/A')}")

                # Show OpenClaw link
                st.markdown(f"[🌐 在 OpenClaw 中查看]({OPENCLAW_GATEWAY_URL})", unsafe_allow_html=True)
            else:
                st.error(f"❌ 同步失敗: {sync_result.get('error', '未知錯誤')}")

        st.markdown('</div>', unsafe_allow_html=True)

    # ── VIEW: TIMELINE ─────────────────────────────────────────────────────
    elif st.session_state.view == "timeline":
        st.markdown("""
        <div class="page-header">
            <div class="page-header-badge">📅 Timeline</div>
            <h1>Deadlines & Milestones</h1>
            <p class="page-header-sub">Deadline countdown for all tracked projects</p>
        </div>
        """, unsafe_allow_html=True)

        all_projects = []
        for name in project_names:
            r = load_project_report(name, projects_root)
            if r:
                dl = DEADLINES.get(r.get("project", name).lower())
                days = (dl - date.today()).days if dl else None
                all_projects.append({
                    "name":           r.get("project", name),
                    "completion":     _parse_completion(r.get("completion_rate", "0%")),
                    "status":         r.get("overall_status", "unknown"),
                    "high_risk":      r.get("summary", {}).get("high_risk_items", 0),
                    "days_remaining": days,
                    "deadline":       str(dl) if dl else "N/A",
                })

        if all_projects:
            # Deadline cards
            cols = st.columns(len(all_projects))
            for col, p in zip(cols, all_projects):
                with col:
                    days = p.get("days_remaining")
                    color = "red" if (days or 99) < 30 else "amber" if (days or 99) < 90 else "green"
                    st.markdown(f"""
                    <div class="kpi-card {color}">
                        <div class="kpi-icon {color}">📅</div>
                        <div class="kpi-value">{days if days is not None else 'N/A'}<span style="font-size:1rem;font-weight:400"> d</span></div>
                        <div class="kpi-label">{p['name'].upper()}</div>
                        <div class="kpi-delta {'warn' if (days or 99) < 30 else 'ok'}">Deadline: {p['deadline']}</div>
                    </div>
                    """, unsafe_allow_html=True)

            st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">📊</div> Days Until Deadline</div>', unsafe_allow_html=True)
            st.plotly_chart(build_timeline_chart(all_projects, dark), use_container_width=True, key="timeline_chart")
            st.markdown('</div>', unsafe_allow_html=True)

            # Gantt-style progress per project
            st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">📈</div> Completion vs Deadline Urgency</div>', unsafe_allow_html=True)
            for p in all_projects:
                days = p.get("days_remaining") or 0
                comp = p.get("completion", 0)
                window = 180
                elapsed = max(0.0, min(100.0, (window - days) / window * 100))
                st.markdown(f"""
                <div style="margin-bottom:16px">
                    <div style="font-size:0.85rem;font-weight:600;color:{'#f1f5f9' if dark else '#1e293b'};
                                margin-bottom:6px">{p['name'].upper()}</div>
                    {prog_bar(comp, "Completion")}
                    <div style="margin-top:8px">{prog_bar(elapsed, "Timeline Elapsed", warn_threshold=75.0)}</div>
                </div>
                """, unsafe_allow_html=True)
            st.markdown('</div>', unsafe_allow_html=True)

    # ── VIEW: COMPARISON ──────────────────────────────────────────────────
    elif st.session_state.view == "comparison":
        st.markdown("""
        <div class="page-header">
            <div class="page-header-badge">📊 Comparison</div>
            <h1>Multi-Project Overview</h1>
            <p class="page-header-sub">Side-by-side comparison of all regulatory projects</p>
        </div>
        """, unsafe_allow_html=True)

        all_projects = []
        for name in project_names:
            r = load_project_report(name, projects_root)
            if r:
                dl = DEADLINES.get(r.get("project", name).lower())
                days = (dl - date.today()).days if dl else None
                all_projects.append({
                    "name":           r.get("project", name),
                    "completion":     _parse_completion(r.get("completion_rate", "0%")),
                    "status":         r.get("overall_status", "unknown"),
                    "high_risk":      r.get("summary", {}).get("high_risk_items", 0),
                    "days_remaining": days,
                    "deadline":       str(dl) if dl else "N/A",
                    "total_items":    r.get("summary", {}).get("total", 0),
                    "completed_items": r.get("summary", {}).get("completed", 0),
                })

        if all_projects:
            # Summary table header
            hdr_color = "#f8fafc" if not dark else "#0f172a"
            row_color = "white"   if not dark else "#1e293b"
            txt_sec   = "#64748b"
            txt_pri   = "#1e293b" if not dark else "#f1f5f9"

            st.markdown(f"""
            <div class="section-card">
                <div class="section-title"><div class="title-icon">📋</div> Projects Summary</div>
                <div class="overview-row header">
                    <span>Project</span>
                    <span>Completion</span>
                    <span>Status</span>
                    <span>High Risk</span>
                    <span>Deadline</span>
                </div>
            """, unsafe_allow_html=True)

            for p in all_projects:
                comp = p["completion"]
                bar = f'<div class="prog-bar-wrap" style="margin-top:4px"><div class="prog-bar-fill {"ok" if comp>70 else "warn" if comp<30 else ""}" style="width:{comp}%"></div></div>'
                risk_cls = "badge-high" if p["high_risk"] > 0 else "badge-low"
                days = p["days_remaining"]
                dl_color = "#dc2626" if (days or 99) < 30 else "#d97706" if (days or 99) < 90 else "#059669"
                st.markdown(f"""
                <div class="overview-row">
                    <span style="font-weight:600;color:{txt_pri}">{p['name'].upper()}</span>
                    <span style="font-size:0.78rem">
                        <span style="font-weight:600;color:{txt_pri}">{comp:.0f}%</span>{bar}
                    </span>
                    <span><span class="badge badge-pending">{p['status'].replace('_',' ').title()}</span></span>
                    <span><span class="badge {risk_cls}">{p['high_risk']}</span></span>
                    <span style="font-size:0.78rem;font-weight:500;color:{dl_color}">{p['deadline']}</span>
                </div>
                """, unsafe_allow_html=True)

            st.markdown('</div>', unsafe_allow_html=True)

            # Radar chart
            r1, r2 = st.columns(2)
            with r1:
                st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">🕸</div> Project Health Radar</div>', unsafe_allow_html=True)
                st.plotly_chart(build_radar_chart(all_projects, dark), use_container_width=True, key="radar")
                st.markdown('</div>', unsafe_allow_html=True)

            with r2:
                st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">📅</div> Timeline Comparison</div>', unsafe_allow_html=True)
                st.plotly_chart(build_timeline_chart(all_projects, dark), use_container_width=True, key="comp_timeline")
                st.markdown('</div>', unsafe_allow_html=True)

            # Expandable details per project
            st.markdown('<div class="section-card"><div class="section-title"><div class="title-icon">🔍</div> Detailed Breakdown</div>', unsafe_allow_html=True)
            for p in all_projects:
                with st.expander(f"{'🔴' if p['high_risk'] > 1 else '🟡' if p['high_risk'] > 0 else '🟢'}  {p['name'].upper()}  —  {p['completion']:.0f}% complete"):
                    r = load_project_report(p['name'], projects_root)
                    if r:
                        sub_items = r.get("items", [])
                        sub_df = pd.DataFrame([
                            {"Item": i["item"], "Status": i["status"], "Risk": i["risk_level"], "Notes": i["notes"]}
                            for i in sub_items
                        ])

                        def cs(val):
                            c = STATUS_COLORS.get(val, "#94a3b8")
                            return f"background-color:{c}20;color:{c};font-weight:600"

                        def cr(val):
                            c = RISK_COLORS.get(val, "#94a3b8")
                            return f"background-color:{c}20;color:{c};font-weight:600"

                        st.dataframe(
                            sub_df.style.map(cs, subset=["Status"]).map(cr, subset=["Risk"]),
                            use_container_width=True,
                            height=min(400, (len(sub_items) + 1) * 38 + 6),
                        )
            st.markdown('</div>', unsafe_allow_html=True)


if __name__ == "__main__":
    main()
