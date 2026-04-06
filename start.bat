@echo off
chcp 65001 >nul 2>&1
title Tank WebGL Server

cd /d "%~dp0"

echo ========================================
echo   Battle City - Tank WebGL Server
echo ========================================
echo.

:: Kill process using port 9000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":9000" ^| findstr "LISTENING"') do (
    echo [INFO] Killing old server PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)
ping -n 2 127.0.0.1 >nul 2>&1

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js.
    pause
    exit /b 1
)

echo [INFO] Starting server at http://localhost:9000
echo [INFO] Press Ctrl+C to stop.
echo.
node serve.js
