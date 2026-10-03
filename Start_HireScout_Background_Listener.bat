@echo off
title 🤖 HireScout Background Listener
cd /d "%~dp0"
cls
echo.
echo  ===================================================================
echo    🤖 HireScout Continuous Global Voice ^& 3x Spacebar Listener
echo  ===================================================================
echo.
echo  Listening in background for "Hey Scout" or 3x Rapid Spacebar...
echo  (Minimize this window to keep listener running silently in background)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0listen_space_global.ps1"
pause
