$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $Root "app.config.js"))) {
  $Root = $PSScriptRoot
  if (-not (Test-Path -LiteralPath (Join-Path $Root "app.config.js"))) {
    $Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  }
}

Set-Location $Root

function Get-LocalEnvValue {
  param([string]$Name)
  $envFile = Join-Path $Root ".env.local"
  if (-not (Test-Path -LiteralPath $envFile)) { return "" }
  $text = [System.IO.File]::ReadAllText($envFile)
  $m = [regex]::Match(
    $text,
    "(?m)^\s*" + [regex]::Escape($Name) + "\s*=\s*(.*?)\s*$"
  )
  if (-not $m.Success) { return "" }
  return $m.Groups[1].Value.Trim().Trim("'", '"')
}

function Get-SecureMapsKey {
  $secure = Read-Host -AsSecureString "Paste Google Maps Android API key (input hidden)"
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

Write-Host "BUKLOD — Set EAS production Google Maps Android key"
Write-Host "The key will not be printed."
Write-Host ""

$key = Get-LocalEnvValue "GOOGLE_MAPS_ANDROID_API_KEY"
$source = "local .env.local"

if (-not $key) {
  $key = Get-SecureMapsKey
  $source = "secure prompt"
}

if (-not $key -or $key.Length -lt 20) {
  throw "A Google Maps Android API key is required. No key was stored."
}

npx.cmd eas-cli@latest env:set production --name GOOGLE_MAPS_ANDROID_API_KEY --value $key --visibility sensitive --scope project --non-interactive

$key = $null
[GC]::Collect()

Write-Host ""
Write-Host "EAS production GOOGLE_MAPS_ANDROID_API_KEY was submitted from $source."
Write-Host "Verify presence only:"
Write-Host "  npx.cmd eas-cli@latest env:list production --scope project --format short --non-interactive"
Write-Host "Do not print or commit the key."
