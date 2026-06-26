@echo off
cd /d "%~dp0\agent-local"
start "" http://127.0.0.1:8798/
call lancer-agent-local.bat
