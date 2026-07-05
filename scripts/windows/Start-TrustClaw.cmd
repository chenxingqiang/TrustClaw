@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-TrustClaw.ps1" %*
exit /b %ERRORLEVEL%
