$ErrorActionPreference = 'Stop'

function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), [System.Text.Encoding]::UTF8)
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, $enc)
}

$files = @(
  'src\app\bible\index.tsx',
  'src\app\admin\bible\monitor.tsx'
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file)) {
    Write-Host "Skipping missing file: $file" -ForegroundColor Yellow
    continue
  }

  $text = Read-Utf8 $file

  # Fix both intended Unicode punctuation and common UTF-8/Windows mojibake variants.
  $replacements = [ordered]@{
    'Read · Record the passage · Reflect · Submit' = 'Read | Record the passage | Reflect | Submit'
    'Read Â· Record the passage Â· Reflect Â· Submit' = 'Read | Record the passage | Reflect | Submit'
    ' pending · +' = ' pending | +'
    ' pending Â· +' = ' pending | +'
    ' typed characters · minimum 20 if using text' = ' typed characters | minimum 20 if using text'
    ' typed characters Â· minimum 20 if using text' = ' typed characters | minimum 20 if using text'
    '✓ Validated · +' = 'VALIDATED | +'
    'âœ“ Validated Â· +' = 'VALIDATED | +'
    'âœ“ Validated · +' = 'VALIDATED | +'
    '✓ Validated Â· +' = 'VALIDATED | +'
    "?'✓ Photo attached':'Optional when typed evidence is complete'" = "?'Photo attached':'Optional when typed evidence is complete'"
    "?'âœ“ Photo attached':'Optional when typed evidence is complete'" = "?'Photo attached':'Optional when typed evidence is complete'"
    "!a?'—':" = "!a?'-':"
    "!a?'â€”':" = "!a?'-':"
    "` · `${row.submitted_on_time?'ON TIME':'LATE'}" = "` | `${row.submitted_on_time?'ON TIME':'LATE'}"
    "` Â· `${row.submitted_on_time?'ON TIME':'LATE'}" = "` | `${row.submitted_on_time?'ON TIME':'LATE'}"
  }

  foreach ($key in $replacements.Keys) {
    $text = $text.Replace($key, $replacements[$key])
  }

  # Catch any remaining common mojibake sequences in these Daily Bible UI files.
  $text = $text.Replace('Â·', '|')
  $text = $text.Replace('â€”', '-')
  $text = $text.Replace('âœ“', 'OK')
  $text = $text.Replace('·', '|')
  $text = $text.Replace('—', '-')
  $text = $text.Replace('✓', 'OK')

  Write-Utf8NoBom $file $text
  Write-Host "Fixed Daily Bible text characters: $file" -ForegroundColor Green
}

Write-Host ''
Write-Host 'DAILY BIBLE CHARACTER HOTFIX COMPLETE' -ForegroundColor Cyan
Write-Host 'Next: npx tsc --noEmit' -ForegroundColor Cyan
