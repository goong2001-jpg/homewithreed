@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [ai-office] 브리지 서버를 시작합니다. 창을 닫으면 꺼집니다.
node server\server.js
pause
