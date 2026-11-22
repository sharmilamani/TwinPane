@echo off
setlocal
cd /d "%~dp0"
title Building Twinpane

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if exist package-lock.json (
  echo Installing the exact build tool versions recorded in package-lock.json...
  call npm ci
) else (
  echo Installing build tools for the first time. This records exact versions in package-lock.json.
  call npm install
)
if errorlevel 1 goto :failed

echo Checking build tools for known vulnerabilities...
call npm audit --omit=optional
echo.

echo Building the Windows installer...
call npm run dist
if errorlevel 1 goto :failed

echo.
echo Done. Your installer is in the "dist" folder:
echo   Twinpane-Setup-1.0.0.exe     (installs with Start menu and right-click entries)
echo   Twinpane-1.0.0-portable.exe  (runs without installing)
echo Keep package-lock.json so later builds use the same versions.
start "" "%~dp0dist"
pause
exit /b 0

:failed
echo.
echo The build failed. Scroll up to see the error.
pause
exit /b 1
