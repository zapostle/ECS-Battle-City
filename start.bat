@echo off
chcp 65001 >nul
title Tank WebGL Server - Port 9000

echo ========================================
echo   Battle City - Tank WebGL Server
echo ========================================
echo.

cd /d "%~dp0"

:: Kill any process using port 9000 (restart support)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :9000 ^| findstr LISTENING 2^>nul') do (
    echo [INFO] Stopping process on port 9000 (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
    timeout /t 1 >nul
)

echo [INFO] Starting server at http://localhost:9000
echo [INFO] Press Ctrl+C to stop the server.
echo.

python serve.py
pause
