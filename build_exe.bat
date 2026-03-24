@echo off
REM ============================================================
REM  RegulatoryReview — Build Script
REM  Usage: build_exe.bat  (run from repository root)
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ===================================================
echo  RegulatoryReview Desktop Builder
echo ===================================================
echo.

REM ── 1. Check Python ──────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ and add it to PATH.
    pause & exit /b 1
)
echo [OK] Python found

REM ── 2. Install / upgrade build dependencies ──────────────────
echo.
echo [*] Installing dependencies...
pip install --quiet --upgrade pyinstaller streamlit plotly pandas rich pystray pillow fpdf python-docx
if errorlevel 1 (
    echo [ERROR] pip install failed.
    pause & exit /b 1
)
echo [OK] Dependencies installed

REM ── 3. Clean previous build ──────────────────────────────────
echo.
echo [*] Cleaning previous build artefacts...
if exist build  rmdir /s /q build
if exist dist   rmdir /s /q dist
echo [OK] Clean done

REM ── 4. Run PyInstaller ────────────────────────────────────────
echo.
echo [*] Running PyInstaller (this may take 2-5 minutes)...
pyinstaller RegulatoryReview.spec --noconfirm
if errorlevel 1 (
    echo [ERROR] PyInstaller failed. Check output above.
    pause & exit /b 1
)
echo [OK] Build succeeded

REM ── 5. Verify output ─────────────────────────────────────────
if not exist "dist\RegulatoryReview.exe" (
    echo [ERROR] dist\RegulatoryReview.exe not found.
    pause & exit /b 1
)

for %%F in ("dist\RegulatoryReview.exe") do set SIZE=%%~zF
set /a SIZE_MB=!SIZE! / 1048576
echo [OK] dist\RegulatoryReview.exe created (!SIZE_MB! MB)

REM ── 6. Create desktop shortcut ───────────────────────────────
echo.
echo [*] Creating desktop shortcut...
set EXE_PATH=%CD%\dist\RegulatoryReview.exe
set SHORTCUT=%USERPROFILE%\Desktop\法規審查工具.lnk

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$sc = $ws.CreateShortcut('%SHORTCUT%'); " ^
  "$sc.TargetPath = '%EXE_PATH%'; " ^
  "$sc.WorkingDirectory = '%CD%\dist'; " ^
  "$sc.Description = 'Regulatory Review Dashboard'; " ^
  "$sc.Save()"

if exist "%SHORTCUT%" (
    echo [OK] Desktop shortcut created: %SHORTCUT%
) else (
    echo [WARN] Shortcut creation failed (non-critical)
)

REM ── 7. Done ──────────────────────────────────────────────────
echo.
echo ===================================================
echo  BUILD COMPLETE
echo  Executable : dist\RegulatoryReview.exe
echo  Shortcut   : %SHORTCUT%
echo.
echo  Double-click the shortcut (or the .exe) to launch.
echo  The dashboard will open in your default browser.
echo ===================================================
echo.
pause
