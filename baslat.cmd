@echo off
rem PC'de tek tıkla aç: arayüz kodun şu anki commit'inden derlenmemişse önce derler.
cd /d "%~dp0"
node scripts\derleme-guncel.js
if errorlevel 1 call npm run build
start "" http://127.0.0.1:4321
node server\index.js
