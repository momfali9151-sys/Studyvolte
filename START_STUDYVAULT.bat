@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed.
  echo Please install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing StudyVault packages...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Please send me a screenshot of this window.
    pause
    exit /b 1
  )
)
echo.
echo Starting StudyVault...
start "StudyVault Browser" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
call npm start
pause
