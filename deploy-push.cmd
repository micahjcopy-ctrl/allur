@echo off
cd /d "%~dp0"
echo ============================================
echo  Pushing ALLUR to github.com/micahjcopy-ctrl/allur
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git is not installed or not on PATH.
  echo Install from https://git-scm.com/download/win and re-run.
  pause
  exit /b 1
)

if not exist ".git" git init

REM Ensure a commit identity exists (local to this repo only).
git config user.email >nul 2>nul || git config user.email "micahjcopy@gmail.com"
git config user.name  >nul 2>nul || git config user.name  "Micah"

git add -A
git commit -m "ALLUR: Vercel migration" || echo (nothing new to commit)
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin https://github.com/micahjcopy-ctrl/allur.git
echo.
echo Pushing... (a browser sign-in window may appear the first time)
git push -u origin main

echo.
echo ============================================
echo  Push step finished. Review the output above.
echo ============================================
pause
