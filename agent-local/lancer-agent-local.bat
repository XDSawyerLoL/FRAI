@echo off
cd /d "%~dp0"
echo Installation/verification des dependances...
call npm install
if errorlevel 1 goto fail
call npx playwright install chromium
if errorlevel 1 goto fail
echo.
echo Agent local disponible sur http://127.0.0.1:8798
echo Laissez cette fenetre ouverte pendant l'utilisation de l'assistant.
echo.
node server.js
pause
exit /b 0
:fail
echo Erreur pendant l'installation. Verifiez que Node.js est installe.
pause
exit /b 1
