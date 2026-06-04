# Full data migration: iyqooryhmshlajuhabmc -> sukehkrhvasfnoheyvvx
# Requires database password from each project's Dashboard → Settings → Database

param(
  [switch]$DryRun,
  [switch]$Confirm
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$OldRef = "iyqooryhmshlajuhabmc"
$NewRef = "sukehkrhvasfnoheyvvx"

Write-Host ""
Write-Host "=== نقل بيانات Supabase الكامل ===" -ForegroundColor Cyan
Write-Host "من: $OldRef"
Write-Host "إلى: $NewRef"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js required"
}

if (-not (Test-Path "node_modules/pg")) {
  Write-Host "Installing pg..." -ForegroundColor Yellow
  npm install pg --no-save
}

Write-Host "أدخل كلمة مرور قاعدة البيانات للمشروع القديم ($OldRef):" -ForegroundColor Yellow
$oldSecure = Read-Host "Old DB password" -AsSecureString
$oldPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($oldSecure)
)

Write-Host "أدخل كلمة مرور قاعدة البيانات للمشروع الجديد ($NewRef):" -ForegroundColor Yellow
$newSecure = Read-Host "New DB password" -AsSecureString
$newPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($newSecure)
)

$env:OLD_DB_PASSWORD = $oldPlain
$env:NEW_DB_PASSWORD = $newPlain
$env:OLD_PROJECT_REF = $OldRef
$env:NEW_PROJECT_REF = $NewRef

$nodeArgs = @("scripts/migrate-data-full.mjs")
if ($DryRun) {
  node scripts/migrate-data-full.mjs --dry-run
  exit $LASTEXITCODE
}

if (-not $Confirm) {
  Write-Host ""
  Write-Host "Step 1: dry-run (counts only)..." -ForegroundColor Cyan
  node scripts/migrate-data-full.mjs --dry-run
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host ""
  $answer = Read-Host "Proceed with LIVE migration? This ERASES data on NEW project (type yes)"
  if ($answer -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
  }
}

node scripts/migrate-data-full.mjs --confirm
exit $LASTEXITCODE
