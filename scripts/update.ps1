# TWICE Discography — one-command update + restart (for local dev / git clone only)
# Windows deployment machine uses GitHub Actions auto-deploy instead.
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."

if (-not (Test-Path ".git")) {
  Write-Host "ERROR: No .git directory found." -ForegroundColor Red
  Write-Host "This script is for local development machines with a git clone." -ForegroundColor Yellow
  Write-Host "The Windows deployment machine auto-deploys via GitHub Actions on every push to main." -ForegroundColor Yellow
  Write-Host "No manual update needed — just push your changes to GitHub." -ForegroundColor Yellow
  exit 1
}

Write-Host "===== 1. pull latest code =====" -ForegroundColor Cyan
git pull

Write-Host "===== 2. install deps =====" -ForegroundColor Cyan
pnpm install

Write-Host "===== 3. build all =====" -ForegroundColor Cyan
pnpm run build

Write-Host "===== 4. setup .env.production (first time only) =====" -ForegroundColor Cyan
if (-not (Test-Path ".env.production")) {
  Copy-Item ".env.production.example" ".env.production"
  Write-Host "Edit .env.production with your secret keys!" -ForegroundColor Yellow
}

Write-Host "===== 5. init database (first time only) =====" -ForegroundColor Cyan
if (-not (Test-Path "data\twice.db")) {
  node backend\dist\db\init.js
  Write-Host "Database initialized." -ForegroundColor Yellow
}

Write-Host "===== 6. stop old server on port 3000 =====" -ForegroundColor Cyan
$pid = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force; Start-Sleep 2 }

Write-Host "===== 7. start server =====" -ForegroundColor Cyan
Start-Process -NoNewWindow node -ArgumentList "backend\dist\server.js"
Start-Sleep 3
Write-Host "Server running at http://localhost:3000" -ForegroundColor Green

Write-Host "===== DONE =====" -ForegroundColor Green
