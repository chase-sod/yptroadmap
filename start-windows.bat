@echo off
cd /d "%~dp0"
title Scouts Queensland YPT Roadmap Server
echo ==================================================
echo   Scouts Queensland Youth Program Team Roadmap   
echo ==================================================
echo Starting local server for direct OneDrive file auto-save...
echo Opening http://localhost:8080 in your default browser...
start http://localhost:8080
python -m http.server 8080
pause
