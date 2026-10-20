@echo off
rem ============================================================================
rem   TENSA ZANGETSU: SOUL ALTAR DEFENSE - WINDOWS 1-CLICK LAUNCHER
rem ============================================================================

cd /d "%~dp0"
title Tensa Zangetsu: Soul Altar Defense

echo ========================================================
echo   TENSA ZANGETSU: SOUL ALTAR DEFENSE
echo   Desktop Web Arcade Game
echo ========================================================
echo.

rem Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js detected. Starting local server...
    start "" http://localhost:8080/
    node server.js
) else (
    echo [INFO] Node.js not found in PATH.
    echo [OK] Launching index.html directly in your default browser...
    start "" "%~dp0index.html"
)
