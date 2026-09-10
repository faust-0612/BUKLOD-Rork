$ErrorActionPreference = 'Stop'

$path = Join-Path $PSScriptRoot '..\src\components\points\BuklodCharacterStudioFull.tsx'
$path = [System.IO.Path]::GetFullPath($path)
if (-not (Test-Path $path)) { throw "Missing Character Studio file: $path" }

$text = Get-Content $path -Raw
$old = @'
    const off = subscribeBuklodCharacterSelectionV2((id, next) => {
      if (!alive || id !== userId) return;
      setState(next);
      if (!isSystemAdmin || previewId === next.active_character_id) {
        setPreviewId(next.active_character_id);
        setQaLevel(next.character_level);
      }
    });
    return () => { alive = false; off(); };
  }, [isSystemAdmin, previewId, userId, visible]);
'@
$new = @'
    const off = subscribeBuklodCharacterSelectionV2((id, next) => {
      if (!alive || id !== userId) return;
      setState(next);
    });
    return () => { alive = false; off(); };
  }, [userId, visible]);
'@

if ($text.Contains($old)) {
  $text = $text.Replace($old, $new)
  Set-Content $path $text -Encoding utf8
  Write-Host 'Character QA preview stabilization applied.' -ForegroundColor Green
} elseif ($text.Contains('}, [userId, visible]);')) {
  Write-Host 'Character QA preview stabilization already applied.' -ForegroundColor Cyan
} else {
  throw 'Expected Character Studio effect block was not found. Refusing broad overwrite.'
}
