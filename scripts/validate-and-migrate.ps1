# Validates migration export before linking a NEW Supabase project.
# Does NOT modify .env, link, or run db push unless -ExecuteMigration is passed
# AND validation gate file exists.
#
# Usage:
#   .\scripts\validate-and-migrate.ps1                    # inventory + validation only
#   .\scripts\validate-and-migrate.ps1 -NewProjectRef xyz # link only (no db push)
#   .\scripts\validate-and-migrate.ps1 -NewProjectRef xyz -ExecuteMigration  # after manual approval

param(
  [string]$NewProjectRef,
  [switch]$ExecuteMigration,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host "=== Phase 1: Export / inventory (local repo) ===" -ForegroundColor Cyan
node scripts/migration-inventory.mjs

$exportDir = Join-Path $ProjectRoot "supabase\migration-export"
$inventoryPath = Join-Path $exportDir "schema-inventory.json"
if (-not (Test-Path $inventoryPath)) {
  throw "Inventory not generated at $inventoryPath"
}

$countsJson = node -e "const i=require('./supabase/migration-export/schema-inventory.json'); console.log(JSON.stringify({migration_files:i.migration_files,counts:i.counts}))"
$summary = $countsJson | ConvertFrom-Json
Write-Host "Migrations: $($summary.migration_files)"
Write-Host "Tables: $($summary.counts.tables_created_in_migrations)"
Write-Host "RLS policies: $($summary.counts.rls_policies)"
Write-Host "Triggers: $($summary.counts.triggers)"
Write-Host "Functions: $($summary.counts.functions)"
Write-Host "Edge functions: $($summary.counts.edge_functions)"

$gatePath = Join-Path $exportDir "VALIDATION_APPROVED.json"
$approved = Test-Path $gatePath

Write-Host ""
Write-Host "=== Validation gate ===" -ForegroundColor Cyan
if (-not $approved) {
  Write-Host "BLOCKED: Create supabase/migration-export/VALIDATION_APPROVED.json after review." -ForegroundColor Yellow
  Write-Host "Template:" -ForegroundColor Yellow
  @'
{
  "approved_by": "your-name",
  "approved_at": "2026-06-03T00:00:00Z",
  "new_project_ref": "YOUR_NEW_REF",
  "notes": "Reviewed MIGRATION_PLAN.md and schema-inventory.json"
}
'@ | Write-Host
} else {
  Write-Host "Validation gate: APPROVED" -ForegroundColor Green
}

if ($NewProjectRef) {
  if (-not $approved -and $ExecuteMigration) {
    throw "Cannot run migrations without VALIDATION_APPROVED.json"
  }

  Write-Host ""
  Write-Host "=== Link new project (no .env change) ===" -ForegroundColor Cyan
  Write-Host "Run manually: npx supabase login"
  Write-Host "Then: npx supabase link --project-ref $NewProjectRef"
  Write-Host "NOTE: .env is NOT updated automatically. Use connect-supabase.ps1 only after validation."

  if ($ExecuteMigration) {
    Write-Host ""
    Write-Host "=== Execute migrations ===" -ForegroundColor Cyan
    npx supabase db push
    Write-Host "Next: npx supabase functions deploy"
    Write-Host "Next: regenerate types.ts from new project"
  }
}

Write-Host ""
Write-Host "Production traffic: DO NOT switch VITE_SUPABASE_* until post-migration validation passes." -ForegroundColor Magenta
