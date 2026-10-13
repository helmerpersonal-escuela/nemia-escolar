@echo off
REM Doble clic para encender el lector NFC de VUNLEK (ACR122U)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0lector-vunlek.ps1"
pause
