@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   MTV Director Canvas - Build Release EXE
echo   Window stays open. Output also saved to
echo   build.log
echo ============================================
echo.
powershell -NoExit -Command "cd '%~dp0'; npm run tauri build 2>&1 | Tee-Object -FilePath 'build.log'; if ($LASTEXITCODE -eq 0) { Write-Host ''; Write-Host '[OK] Build finished. Opening output folder...' -ForegroundColor Green; explorer 'src-tauri\target\release\bundle' } else { Write-Host ''; Write-Host '[FAILED] See errors above or build.log' -ForegroundColor Red }"
