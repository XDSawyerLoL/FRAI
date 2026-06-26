@echo off
cd /d "%~dp0"
echo Installation des dependances de l'agent local...
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installe Node.js LTS puis relance ce fichier.
  pause
  exit /b 1
)
npm install
npx playwright install chromium
echo Installation terminee.
pause
