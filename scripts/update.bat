@echo off
cd /d "%~dp0\.."

echo ===== 1. pull latest code =====
git pull

echo ===== 2. install deps =====
call pnpm install

echo ===== 3. build all =====
call pnpm run build

echo ===== 4. setup env (first time only) =====
if not exist ".env.production" (
  echo Creating .env.production from template...
  copy .env.production.example .env.production
  echo [WARN] Edit .env.production with your secret keys!
)

echo ===== 5. init database (first time only) =====
if not exist "data\twice.db" (
  echo Initializing database...
  node backend\dist\db\init.js
)

echo ===== 6. stop old server =====
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000.*LISTENING') do taskkill /PID %%a /F 2>nul
timeout /t 2 /nobreak >nul

echo ===== 7. start server =====
echo Server starting at http://localhost:3000
start /b node backend\dist\server.js

echo ===== DONE =====
