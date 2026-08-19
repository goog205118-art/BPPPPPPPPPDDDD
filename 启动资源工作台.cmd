@echo off
setlocal
cd /d "%~dp0"
if not exist "%TEMP%\ResourceWorkbench" mkdir "%TEMP%\ResourceWorkbench"
set "RESOURCE_WORKBENCH_STORAGE_DIR=%TEMP%\ResourceWorkbench"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then run this file again.
  pause
  exit /b 1
)

netstat -ano | findstr /R /C:":4173 .*LISTENING" >nul
if not errorlevel 1 (
  echo Resource Workbench is already running at http://localhost:4173
  echo Open that address in your browser, or close the existing service window before starting again.
  pause
  exit /b 0
)

echo.
echo Resource Workbench is starting.
echo Open http://localhost:4173 in your browser after the service is ready.
echo Keep this window open while using the workbench. Press Ctrl+C to stop it.
echo.

node tools\local-server.cjs

if errorlevel 1 (
  echo.
  echo The local service stopped unexpectedly.
  pause
)

endlocal
