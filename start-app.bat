@echo off
title Viora Bills - One-Click Launcher
color 0B

echo ===================================================
echo           VIORA BILLS - LAUNCHER
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking PostgreSQL on port 5433...
powershell -NoProfile -Command "(Test-NetConnection -ComputerName 127.0.0.1 -Port 5433 -WarningAction SilentlyContinue).TcpTestSucceeded" > "%temp%\pg_check.txt"
set /p PG_STATUS=<"%temp%\pg_check.txt"
del "%temp%\pg_check.txt"

if "%PG_STATUS%"=="True" (
    echo [OK] PostgreSQL is already running on port 5433.
) else (
    echo [STARTING] Launching PostgreSQL database engine...
    start "Viora Database Engine" /min "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D "%~dp0.db_data" -p 5433
    timeout /t 3 /nobreak >nul
)

echo.
echo [2/3] Launching Dedicated Role Portals:
echo   - Port 5173 : Billing Admin Desk (Generate Bills, Clients, Collections)
echo   - Port 5174 : Customer Purchase Portal (Subscriptions, Plans, 12-Digit Super Admin Key)
echo   - Port 5175 : Super Admin Control Desk (Product Catalog, Admin Codes, Billing Authorization)
echo   - Port 5000 : Unified Backend API Engine
echo.
echo ===================================================
echo Opening portals in your browser...
echo Press Ctrl + C in this window to stop all services.
echo ===================================================
echo.

start http://localhost:5173
start http://localhost:5174
start http://localhost:5175

npm run dev
pause

