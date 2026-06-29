@echo off
REM ============================================================
REM  Push ALLUR to GitHub.
REM  Usage:  push-to-github.bat https://github.com/<you>/<repo>.git
REM  (Create the empty repo on github.com first, then run this.)
REM ============================================================
setlocal

if "%~1"=="" (
  echo.
  echo   Provide your GitHub repo URL, e.g.:
  echo   push-to-github.bat https://github.com/yourname/allur.git
  echo.
  exit /b 1
)

cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Install it from https://git-scm.com/download/win and re-run.
  exit /b 1
)

if not exist ".git" git init
git add .
git commit -m "ALLUR: Vercel migration" || echo (nothing new to commit)
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin "%~1"
git push -u origin main

echo.
echo Done. Next: import the repo at vercel.com and follow DEPLOY.md.
endlocal
