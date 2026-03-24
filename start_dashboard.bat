@echo off
REM ============================================================
REM  Quick-start without building the EXE (dev / fallback mode)
REM  Starts Streamlit directly and opens the browser.
REM ============================================================
cd /d "%~dp0"

echo [*] Starting Regulatory Review Dashboard...

REM Check streamlit
streamlit --version >nul 2>&1
if errorlevel 1 (
    echo [*] Installing streamlit + deps...
    pip install --quiet streamlit plotly pandas rich
)

REM Open browser after 3 s (give server time to start)
start "" /b cmd /c "timeout /t 3 >nul && start http://localhost:8501"

REM Run dashboard
streamlit run scripts/web_dashboard.py ^
    --server.port=8501 ^
    --server.headless=true ^
    --browser.gatherUsageStats=false
