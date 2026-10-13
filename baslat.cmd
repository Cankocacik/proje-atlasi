@echo off
cd /d "%~dp0"
if not exist dist\index.html call npm run build
start "" http://127.0.0.1:4321
node server\index.js
