# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for RegulatoryReview Desktop
Build with:  pyinstaller RegulatoryReview.spec
"""

import sys
from pathlib import Path

ROOT = Path(SPECPATH)   # regulatory-review/

block_cipher = None

# ── Hidden imports needed by Streamlit ────────────────────────────────────────
HIDDEN_IMPORTS = [
    # Streamlit internals
    "streamlit",
    "streamlit.web.cli",
    "streamlit.runtime.scriptrunner.magic_funcs",
    "streamlit.components.v1",
    # Plotly
    "plotly",
    "plotly.express",
    "plotly.graph_objects",
    # Data
    "pandas",
    "numpy",
    # Optional generators
    "fpdf",
    "docx",
    # Tray icon (optional — OK if missing)
    "pystray",
    "PIL",
    "PIL.Image",
    "PIL.ImageDraw",
    # Standard
    "email",
    "email.mime",
    "email.mime.text",
    "email.mime.multipart",
    "email.mime.base",
    "json",
    "pathlib",
    "threading",
    "subprocess",
    "webbrowser",
    "urllib.request",
    # Rich (used by review.py)
    "rich",
    "rich.console",
    "rich.table",
    "rich.panel",
    "rich.progress",
]

# ── Data files to bundle ───────────────────────────────────────────────────────
import streamlit as _st
import plotly as _plotly

DATAS = [
    # All scripts
    (str(ROOT / "scripts"),  "scripts"),
    (str(ROOT / "outputs"),  "outputs"),
    (str(ROOT / "config"),   "config"),
    # Streamlit static assets
    (str(Path(_st.__file__).parent / "static"),   "streamlit/static"),
    (str(Path(_st.__file__).parent / "runtime"),  "streamlit/runtime"),
    # Plotly bundled js
    (str(Path(_plotly.__file__).parent),          "plotly"),
]

a = Analysis(
    [str(ROOT / "launcher.py")],
    pathex=[str(ROOT), str(ROOT / "scripts")],
    binaries=[],
    datas=DATAS,
    hiddenimports=HIDDEN_IMPORTS,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "scipy", "pytest"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="RegulatoryReview",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # no black console window
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon="assets/icon.ico",  # uncomment if you add an icon file
)
