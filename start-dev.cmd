@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   MTV Director Canvas - Dev Mode
echo   First run compiles Rust, please wait...
echo ============================================
echo.
npm run tauri dev
echo.
echo [Exit] Dev server stopped.
pause
