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

:: Try python, then py launcher
where python >nul 2>&1
if %errorlevel% neq 0 (
    where py >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Python not found! Please install Python.
        pause
        exit /b 1
    )
    echo [INFO] Starting server at http://localhost:9000 (using py)
    echo [INFO] Press Ctrl+C to stop.
    echo.
    py serve.py
) else (
    echo [INFO] Starting server at http://localhost:9000
    echo [INFO] Press Ctrl+C to stop.
    echo.
    python serve.py
)
