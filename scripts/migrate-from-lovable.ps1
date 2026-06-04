# Migrate data FROM Lovable Cloud TO your own Supabase (sukehkrhvasfnoheyvvx)
#
# Lovable Cloud hides the database password. We use a temporary edge function bridge.

param([switch]$DryRun)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host ""
Write-Host "=== نقل من Lovable Cloud ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "الخطوة 1 (مرة واحدة في Lovable):" -ForegroundColor Yellow
Write-Host "  - افتح مشروع Lovable الأصلي"
Write-Host "  - اطلب: انشئ edge function اسمها migrate-helper"
Write-Host "  - الصق الكود من: scripts/lovable-migrate-helper/index.ts"
Write-Host "  - غيّر ACCESS_KEY لسلسلة عشوائية طويلة"
Write-Host "  - deploy مع verify_jwt = false"
Write-Host "  - انسخ URL الدالة من Cloud -> Edge Functions"
Write-Host ""

if (-not (Test-Path "node_modules/pg")) {
  npm install pg --no-save | Out-Null
}

if ($DryRun) {
  node scripts/migrate-from-lovable.mjs --dry-run
  exit $LASTEXITCODE
}

Write-Host "معاينة (dry-run)..." -ForegroundColor Cyan
node scripts/migrate-from-lovable.mjs --dry-run
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
$go = Read-Host "تنفيذ النقل الفعلي؟ يحذف بيانات المشروع الجديد (اكتب yes)"
if ($go -ne "yes") { exit 0 }

node scripts/migrate-from-lovable.mjs --confirm
exit $LASTEXITCODE
