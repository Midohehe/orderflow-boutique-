# Updates local config to point at a new Supabase project.
# Usage:
#   .\scripts\connect-supabase.ps1 -ProjectRef "abcdefgh" -AnonKey "eyJ..."
# Or run without args to be prompted interactively.

param(
  [string]$ProjectRef,
  [string]$AnonKey,
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

function Read-Required([string]$Prompt) {
  do {
    $value = Read-Host $Prompt
  } while ([string]::IsNullOrWhiteSpace($value))
  return $value.Trim()
}

if (-not $ProjectRef) {
  $ProjectRef = Read-Required "Supabase Project Ref (Dashboard -> Project Settings -> General)"
}
if (-not $AnonKey) {
  $AnonKey = Read-Required "Supabase anon public key (Dashboard -> Project Settings -> API)"
}

$ProjectRef = $ProjectRef.Trim()
$AnonKey = $AnonKey.Trim()
$Url = "https://$ProjectRef.supabase.co"

$envPath = Join-Path $ProjectRoot ".env"
$envContent = @"
VITE_SUPABASE_PROJECT_ID="$ProjectRef"
VITE_SUPABASE_PUBLISHABLE_KEY="$AnonKey"
VITE_SUPABASE_URL="$Url"
"@

Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "Updated $envPath"

$configPath = Join-Path $ProjectRoot "supabase\config.toml"
if (Test-Path $configPath) {
  $config = Get-Content $configPath -Raw
  $config = $config -replace 'project_id = ".*"', "project_id = `"$ProjectRef`""
  Set-Content -Path $configPath -Value $config -Encoding UTF8 -NoNewline
  Write-Host "Updated $configPath"
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. npx supabase login"
Write-Host "  2. npx supabase link --project-ref $ProjectRef"
Write-Host "  3. npx supabase db push"
Write-Host "  4. npx supabase functions deploy"
Write-Host "  5. Set edge function secrets in Supabase Dashboard (AI_API_KEY, SITE_URL, etc.)"
Write-Host "  6. npm run dev"
