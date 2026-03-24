#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RegulatoryReview Desktop Launcher
Starts the Streamlit dashboard and opens the browser automatically.
"""

import os
import sys
import time
import threading
import subprocess
import webbrowser
from pathlib import Path


PORT = 8501
URL  = f"http://localhost:{PORT}"


def _find_dashboard() -> Path:
    """Locate web_dashboard.py relative to the exe / script."""
    if getattr(sys, "frozen", False):
        # Running inside PyInstaller bundle
        base = Path(sys._MEIPASS)
    else:
        base = Path(__file__).parent

    candidate = base / "scripts" / "web_dashboard.py"
    if candidate.exists():
        return candidate

    # Fallback: same directory
    fallback = base / "web_dashboard.py"
    if fallback.exists():
        return fallback

    raise FileNotFoundError(f"web_dashboard.py not found near {base}")


def _open_browser_when_ready():
    """Poll until Streamlit is up, then open the browser."""
    import urllib.request
    for _ in range(30):          # wait up to 30 s
        time.sleep(1)
        try:
            urllib.request.urlopen(URL, timeout=1)
            webbrowser.open(URL)
            return
        except Exception:
            pass
    # Give up silently — the server may still start later
    webbrowser.open(URL)


def _tray_icon(stop_event: threading.Event):
    """Optional system-tray icon (requires pystray + Pillow)."""
    try:
        import pystray
        from PIL import Image, ImageDraw

        # Draw a simple blue square icon
        img = Image.new("RGB", (64, 64), color="#1e3a5c")
        draw = ImageDraw.Draw(img)
        draw.rectangle([8, 8, 56, 56], fill="#3b82f6")
        draw.text((14, 20), "RR", fill="white")

        def on_open(_icon, _item):
            webbrowser.open(URL)

        def on_quit(icon, _item):
            stop_event.set()
            icon.stop()

        menu = pystray.Menu(
            pystray.MenuItem("Open Dashboard", on_open, default=True),
            pystray.MenuItem("Quit", on_quit),
        )
        icon = pystray.Icon("RegulatoryReview", img, "Regulatory Review", menu)
        icon.run()
    except Exception:
        # pystray / Pillow not available — just wait for stop
        stop_event.wait()


def main():
    dashboard = _find_dashboard()

    # Ensure scripts/ is on sys.path so review.py imports work
    sys.path.insert(0, str(dashboard.parent))

    # Build streamlit command
    streamlit_bin = Path(sys.executable).parent / "streamlit.exe"
    if not streamlit_bin.exists():
        streamlit_bin = "streamlit"   # hope it's on PATH

    cmd = [
        str(streamlit_bin), "run",
        str(dashboard),
        f"--server.port={PORT}",
        "--server.headless=true",
        "--server.enableCORS=false",
        "--browser.gatherUsageStats=false",
    ]

    # Start Streamlit as a subprocess (hidden console on Windows)
    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NO_WINDOW

    proc = subprocess.Popen(
        cmd,
        creationflags=creation_flags,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Open browser in background once the server is ready
    browser_thread = threading.Thread(target=_open_browser_when_ready, daemon=True)
    browser_thread.start()

    # System tray (blocks until user clicks Quit)
    stop_event = threading.Event()
    try:
        _tray_icon(stop_event)
    except KeyboardInterrupt:
        pass
    finally:
        proc.terminate()
        proc.wait()


if __name__ == "__main__":
    main()
