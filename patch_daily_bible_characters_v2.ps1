$ErrorActionPreference = 'Stop'

function Read-Utf8([string]$Path) {
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  return [System.IO.File]::ReadAllText($resolved, [System.Text.Encoding]::UTF8)
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($resolved, $Text, $enc)
}

function Replace-LiteralResult([string]$Text, [string]$Pattern, [string]$Replacement, [string]$Label) {
  $rx = New-Object System.Text.RegularExpressions.Regex($Pattern)
  if (-not $rx.IsMatch($Text)) {
    Write-Host "Already clean or pattern not found: $Label" -ForegroundColor Yellow
    return $Text
  }

  $result = $rx.Replace(
    $Text,
    [System.Text.RegularExpressions.MatchEvaluator]{
      param($m)
      return $Replacement
    }
  )

  Write-Host "Fixed: $Label" -ForegroundColor Green
  return $result
}

$memberPath = 'src\app\bible\index.tsx'
$monitorPath = 'src\app\admin\bible\monitor.tsx'

if (-not (Test-Path -LiteralPath $memberPath)) {
  throw "Missing file: $memberPath"
}

$member = Read-Utf8 $memberPath

$member = Replace-LiteralResult $member '<Text style=\{shared\.muted\}>Read[^<]*Submit</Text>' '<Text style={shared.muted}>Read | Record the passage | Reflect | Submit</Text>' 'Daily Bible subtitle'
$member = Replace-LiteralResult $member '<Text style=\{styles\.meta\}>\{pending\} pending[^<]*\+\{points\} BUKLOD Points per approved reading</Text>' '<Text style={styles.meta}>{pending} pending | +{points} BUKLOD Points per approved reading</Text>' 'weekly points summary'

$dayPattern = @'
\{!a\?.*?:s\?\.status==='approved'\?'VALID':s\?\.status==='pending_admin'\?'PEND':s\?\.status==='rejected'\?'REVISE':'OPEN'\}
'@
$dayReplacement = @'
{!a?'-':s?.status==='approved'?'VALID':s?.status==='pending_admin'?'PEND':s?.status==='rejected'?'REVISE':'OPEN'}
'@
$member = Replace-LiteralResult $member $dayPattern.Trim() $dayReplacement.Trim() 'empty-day marker'

$member = Replace-LiteralResult $member '<Text style=\{styles\.meta\}>\{bibleText\.trim\(\)\.length\} typed characters[^<]*minimum 20 if using text</Text>' '<Text style={styles.meta}>{bibleText.trim().length} typed characters | minimum 20 if using text</Text>' 'Bible text character count'
$member = Replace-LiteralResult $member '<Text style=\{styles\.meta\}>\{answer\.trim\(\)\.length\} typed characters[^<]*minimum 20 if using text</Text>' '<Text style={styles.meta}>{answer.trim().length} typed characters | minimum 20 if using text</Text>' 'reflection character count'

$approvedPattern = @'
\{submission\?\.status==='approved' && <Text style=\{styles\.valid\}>[^<]*\+\{points\} BUKLOD Points</Text>\}
'@
$approvedReplacement = @'
{submission?.status==='approved' && <Text style={styles.valid}>VALIDATED | +{points} BUKLOD Points</Text>}
'@
$member = Replace-LiteralResult $member $approvedPattern.Trim() $approvedReplacement.Trim() 'validated status'

$photoPattern = @'
<Text style=\{styles\.photoMeta\}>\{attached\?'[^']*Photo attached':'Optional when typed evidence is complete'\}</Text>
'@
$photoReplacement = @'
<Text style={styles.photoMeta}>{attached?'Photo attached':'Optional when typed evidence is complete'}</Text>
'@
$member = Replace-LiteralResult $member $photoPattern.Trim() $photoReplacement.Trim() 'photo attached status'

Write-Utf8NoBom $memberPath $member

if (Test-Path -LiteralPath $monitorPath) {
  $monitor = Read-Utf8 $monitorPath

  $monitor = Replace-LiteralResult $monitor '<Text style=\{styles\.nav\}>[^<]*PREV</Text>' '<Text style={styles.nav}>PREV</Text>' 'monitor PREV label'
  $monitor = Replace-LiteralResult $monitor '<Text style=\{styles\.nav\}>NEXT[^<]*</Text>' '<Text style={styles.nav}>NEXT</Text>' 'monitor NEXT label'

  $submittedPattern = @'
(?m)^\s*\{row\.submitted_at\?.*submitted_on_time.*$
'@
  $submittedReplacement = @'
                      {row.submitted_at?` | ${row.submitted_on_time?'ON TIME':'LATE'}`:''}
'@
  $monitor = Replace-LiteralResult $monitor $submittedPattern.Trim() $submittedReplacement.TrimEnd() 'monitor submitted status separator'

  Write-Utf8NoBom $monitorPath $monitor
} else {
  Write-Host "Skipping missing file: $monitorPath" -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'DAILY BIBLE CHARACTER HOTFIX V2 COMPLETE' -ForegroundColor Cyan
Write-Host 'Next: npx tsc --noEmit' -ForegroundColor Cyan
