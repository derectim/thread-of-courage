@echo off
chcp 65001 >nul
title Нитка храбрости — локальный сервер
cd /d "%~dp0"

powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) { exit 0 }; exit 1 } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://localhost:5173/"
  exit /b 0
)

if not exist "node_modules" (
  echo Первый запуск: устанавливаю необходимые компоненты...
  call npm install
  if errorlevel 1 (
    echo Не удалось установить компоненты.
    pause
    exit /b 1
  )
)

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:5173/'"
echo Игра запускается. Чтобы остановить сервер, закройте это окно.
call npm run dev

if errorlevel 1 (
  echo.
  echo Не удалось запустить игру. Возможно, порт 5173 уже занят.
  pause
)
