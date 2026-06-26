@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installe Node.js LTS puis relance.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Dependances absentes. Lancement de l'installation...
  call npm install
  call npx playwright install chromium
)
echo Lancement de l'agent local Assistant France Travail...
npm start
pause
