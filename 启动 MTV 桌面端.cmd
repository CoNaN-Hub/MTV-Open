@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title MTV 桌面端启动器

rem ============================================================
rem  MTV 导演画布 —— 桌面端启动器（自检式）
rem  双击即可：1) 确保 dev server(5180) 就绪  2) 关掉旧进程  3) 启动桌面端并等窗口出现
rem  日志：<仓库>\.mtv-launcher.log
rem ============================================================

rem 仓库根 = 本脚本所在目录（开源仓不写死盘符 / 用户名路径）
set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"
set "EXE=%REPO%\src-tauri\target\debug\mtv-desktop.exe"
set "URL=http://localhost:5180/"
set "LOG=%REPO%\.mtv-launcher.log"

echo ================================================
echo   MTV 导演画布 - 桌面端启动器
echo ================================================
echo.
echo [%date% %time%] launcher start > "%LOG%"

if not exist "%EXE%" (
  echo [错误] 找不到桌面端程序：
  echo        %EXE%
  echo.
  echo 请先构建桌面端：
  echo        cd /d "%REPO%"
  echo        npm run tauri build -- --debug
  echo.
  echo [错误] 找不到 %EXE% >> "%LOG%"
  pause
  exit /b 1
)

echo [1/3] 检查 dev server (%URL%) ...
powershell -NoProfile -Command "try{ $r=Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 3; if($r.StatusCode -eq 200){exit 0} }catch{}; exit 1"
if errorlevel 1 (
  echo       未检测到，正在后台启动 npm run dev ...
  echo [%date% %time%] starting dev server >> "%LOG%"
  pushd "%REPO%"
  start "MTV dev server" /min cmd /k npm run dev
  popd
  echo       等待就绪（最多 90 秒）...
  powershell -NoProfile -Command "for($i=0;$i -lt 90;$i++){ try{ $r=Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2; if($r.StatusCode -eq 200){ exit 0 } }catch{}; Start-Sleep -Seconds 1 }; exit 1"
  if errorlevel 1 (
    echo       [警告] 90 秒内 dev server 仍未就绪。
    echo               请查看最小化的「MTV dev server」窗口里的报错
    echo               （最常见是依赖没装：cd /d "%REPO%" 然后 npm install）。
    echo [%date% %time%] dev server NOT ready >> "%LOG%"
    echo.
    echo       仍会尝试启动桌面端，界面可能白屏。
    echo.
  ) else (
    echo       dev server 已就绪。
    echo [%date% %time%] dev server ready >> "%LOG%"
  )
) else (
  echo       dev server 已在运行。
  echo [%date% %time%] dev server already up >> "%LOG%"
)

echo [2/3] 关闭已在运行的 MTV 桌面端 ...
powershell -NoProfile -Command "Get-Process mtv-desktop -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 800"

echo [3/3] 启动桌面端 ...
start "" "%EXE%"
echo [%date% %time%] exe launched >> "%LOG%"
echo       等待窗口出现（最多 30 秒）...
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 60;$i++){ $p=Get-Process mtv-desktop -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1; if($p){ Write-Host ('      OK: PID ' + $p.Id + '  窗口: ' + $p.MainWindowTitle); $ok=$true; break }; Start-Sleep -Milliseconds 500 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo       [错误] 30 秒内没看到桌面端窗口，看日志：%LOG%
  echo [%date% %time%] window not shown >> "%LOG%"
  pause
  exit /b 1
)

echo.
echo 完成。这个窗口 3 秒后自动关闭（下次直接双击桌面上的「MTV 桌面端」即可）。
echo [%date% %time%] done >> "%LOG%"
ping -n 3 127.0.0.1 >nul
exit /b 0
