# Deploy Cloudflare Worker (was-la-edge) using credentials from .env
# Required in .env:
#   CLOUDFLARE_API_TOKEN=...
#   VITE_SUPABASE_PUBLISHABLE_KEY=...  (used as SUPABASE_ANON_KEY secret)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$workerDir = Join-Path $root "cloudflare-worker"

if (-not (Test-Path $envFile)) {
  Write-Error ".env not found at $envFile"
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $key = $matches[1].Trim()
    $val = $matches[2].Trim().Trim('"').Trim("'")
    if ([string]::IsNullOrWhiteSpace($val)) { return }
    switch ($key) {
      "CLOUDFLARE_API_TOKEN" { $env:CLOUDFLARE_API_TOKEN = $val }
      "VITE_SUPABASE_PUBLISHABLE_KEY" { $script:SupabaseKey = $val }
    }
  }
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Error @"
CLOUDFLARE_API_TOKEN missing in .env

Add this line to .env (Cloudflare → Profile → API Tokens → Edit Cloudflare Workers):
CLOUDFLARE_API_TOKEN=your_token_here
"@
}

if (-not $script:SupabaseKey) {
  Write-Error "VITE_SUPABASE_PUBLISHABLE_KEY missing in .env"
}

Set-Location $workerDir
Write-Host "Checking Cloudflare auth..." -ForegroundColor Cyan
npx wrangler whoami

Write-Host "Uploading SUPABASE_ANON_KEY secret..." -ForegroundColor Cyan
$script:SupabaseKey | npx wrangler secret put SUPABASE_ANON_KEY

Write-Host "Deploying worker..." -ForegroundColor Cyan
npx wrangler deploy

Write-Host ""
Write-Host "Done. Add Routes in Cloudflare Dashboard if not set yet:" -ForegroundColor Green
Write-Host "  www.was-la.com/p/*"
Write-Host "  www.was-la.com/cdn/img"
Write-Host "  was-la.com/p/*"
Write-Host "  was-la.com/cdn/img"
