#requires -Version 5.1
param(
  [string]$QuizRoot = "$HOME\Downloads\BUKLOD_Quiz_Standalone",
  [switch]$ExportWeb,
  [switch]$DeployWeb
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " BUKLOD QUIZ DEVICE SESSION SELF-HEAL R1" -ForegroundColor Cyan
Write-Host " TOKEN-HASH TAKEOVER / WEB ENTRY ONLY / ZERO EXAM LOGIC CHANGE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$target = Join-Path $QuizRoot 'app\login.tsx'
if (!(Test-Path -LiteralPath $target -PathType Leaf)) {
  throw "STOPPED: Quiz login source not found: $target"
}

Set-Location $QuizRoot

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupRoot = Join-Path $QuizRoot ".buklod-backups\quiz_device_session_self_heal_r1_$stamp"
$backupFile = Join-Path $backupRoot 'app\login.tsx'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupFile) | Out-Null
Copy-Item -LiteralPath $target -Destination $backupFile -Force

$text = [System.IO.File]::ReadAllText($target)
$marker = 'BUKLOD_QUIZ_DEVICE_SESSION_SELF_HEAL_R1'

if ($text.Contains($marker)) {
  Write-Host "Already patched: $marker" -ForegroundColor Yellow
} else {
  Write-Host "1/4 Patching token-hash session takeover..." -ForegroundColor Yellow

  if (!$text.Contains("useLocalSearchParams")) {
    $oldImport = "import { router } from 'expo-router';"
    $newImport = "import { router, useLocalSearchParams } from 'expo-router';"
    $importCount = ([regex]::Matches($text, [regex]::Escape($oldImport))).Count
    if ($importCount -ne 1) {
      throw "STOPPED SAFELY: expected exactly one expo-router import anchor, found $importCount. Backup: $backupFile"
    }
    $text = $text.Replace($oldImport, $newImport)
  }

  $componentAnchor = "export default function Login() {"
  $componentCount = ([regex]::Matches($text, [regex]::Escape($componentAnchor))).Count
  if ($componentCount -ne 1) {
    throw "STOPPED SAFELY: expected exactly one Login component anchor, found $componentCount. Backup: $backupFile"
  }

  $insert = @'

  /* BUKLOD_QUIZ_DEVICE_SESSION_SELF_HEAL_R1
   * Main -> Quiz direct token-hash takeover.
   * The token hash is one-time and contains no Main refresh/access token.
   * Clear only this device's stale Quiz session, verify the dedicated Quiz
   * token into a fresh session, clean the URL, then continue to Quiz Home.
   */
  const buklodMainEntryParams = useLocalSearchParams<{
    buklod_quiz_token_hash?: string | string[];
  }>();
  const buklodMainEntryRawToken = buklodMainEntryParams.buklod_quiz_token_hash;
  const buklodMainEntryTokenHash = String(
    Array.isArray(buklodMainEntryRawToken)
      ? buklodMainEntryRawToken[0] ?? ''
      : buklodMainEntryRawToken ?? '',
  ).trim();
  const [buklodMainEntryBooting, setBuklodMainEntryBooting] = useState(
    () => Boolean(buklodMainEntryTokenHash),
  );

  useEffect(() => {
    if (!buklodMainEntryTokenHash) {
      setBuklodMainEntryBooting(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setBuklodMainEntryBooting(true);

      try {
        /*
         * Local scope only: never sign this user out from other devices.
         * Ignore stale-session cleanup failures because verifyOtp below is
         * authoritative and will install the fresh dedicated Quiz session.
         */
        await Promise.race([
          supabase.auth.signOut({ scope: 'local' }).catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
        ]);

        const handoff: any = await Promise.race([
          supabase.auth.verifyOtp({
            token_hash: buklodMainEntryTokenHash,
            type: 'email',
          }),
          new Promise<any>((resolve) => {
            setTimeout(() => {
              resolve({
                data: { session: null },
                error: new Error('BUKLOD_QUIZ_DEVICE_SESSION_TIMEOUT'),
              });
            }, 10_000);
          }),
        ]);

        if (cancelled) return;

        if (handoff?.error || !handoff?.data?.session?.user) {
          const message = String(handoff?.error?.message ?? '');

          setBuklodMainEntryBooting(false);
          Alert.alert(
            'BUKLOD Quiz session refresh failed',
            /BUKLOD_QUIZ_DEVICE_SESSION_TIMEOUT/i.test(message)
              ? 'Quiz verified the handoff request but this device did not finish saving the new session in time. Check the connection, then open BUKLOD Quiz once again.'
              : 'This device could not install the fresh BUKLOD Quiz session. Return to BUKLOD Main and open BUKLOD Quiz once again.',
          );
          return;
        }

        /*
         * Remove the one-time token from browser history after success.
         * Avoid direct DOM typings so Expo native TypeScript remains clean.
         */
        const webWindow = (globalThis as any)?.window;
        const URLCtor = (globalThis as any)?.URL;
        if (
          Platform.OS === 'web' &&
          webWindow?.location?.href &&
          URLCtor
        ) {
          try {
            const cleanUrl = new URLCtor(webWindow.location.href);
            cleanUrl.searchParams.delete('buklod_quiz_token_hash');
            webWindow.history?.replaceState?.({}, '', cleanUrl.toString());
          } catch {
            // Session is already installed; URL cleanup is best-effort only.
          }
        }

        router.replace('/home');
      } catch (error: any) {
        if (cancelled) return;

        setBuklodMainEntryBooting(false);
        const message = String(error?.message ?? error ?? '');

        Alert.alert(
          'BUKLOD Quiz connection problem',
          /network|failed to fetch|fetch failed|timeout|abort/i.test(message)
            ? 'This device could not complete the Quiz session refresh. Check the connection, then open BUKLOD Quiz once again.'
            : message || 'BUKLOD Quiz could not refresh this device session.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buklodMainEntryTokenHash]);
'@

  $text = $text.Replace(
    $componentAnchor,
    $componentAnchor + $insert
  )

  $bootAnchor = "if (buklodClassroomHandoffBooting) {"
  $bootCount = ([regex]::Matches($text, [regex]::Escape($bootAnchor))).Count
  if ($bootCount -ne 1) {
    throw "STOPPED SAFELY: expected exactly one Classroom handoff boot anchor, found $bootCount. Backup: $backupFile"
  }
  $text = $text.Replace(
    $bootAnchor,
    "if (buklodMainEntryBooting || buklodClassroomHandoffBooting) {"
  )

  if (!$text.Contains($marker)) {
    throw "STOPPED SAFELY: patch marker missing before write. Backup: $backupFile"
  }

  [System.IO.File]::WriteAllText(
    (Resolve-Path $target),
    $text,
    (New-Object System.Text.UTF8Encoding($false))
  )

  Write-Host "Patched: $target" -ForegroundColor Green
  Write-Host "Backup : $backupFile" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "2/4 Verifying protected auth-only scope..." -ForegroundColor Yellow
$after = [System.IO.File]::ReadAllText($target)
foreach ($required in @(
  'BUKLOD_QUIZ_DEVICE_SESSION_SELF_HEAL_R1',
  'useLocalSearchParams',
  'buklod_quiz_token_hash',
  "scope: 'local'",
  'supabase.auth.verifyOtp',
  "type: 'email'",
  "router.replace('/home')"
)) {
  if (!$after.Contains($required)) {
    throw "VERIFY FAILED: missing required marker: $required"
  }
}
Write-Host "Auth-only contract PASS." -ForegroundColor Green

Write-Host ""
Write-Host "3/4 TypeScript QA..." -ForegroundColor Yellow
& npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
  throw "TypeScript QA failed. Restore from: $backupFile"
}
Write-Host "TypeScript PASS." -ForegroundColor Green

$shouldExport = $ExportWeb -or $DeployWeb
if ($shouldExport) {
  Write-Host ""
  Write-Host "4/4 Web export..." -ForegroundColor Yellow
  & npx expo export --platform web --clear
  if ($LASTEXITCODE -ne 0) {
    throw "Web export failed. No deploy attempted."
  }
  if (!(Test-Path -LiteralPath (Join-Path $QuizRoot 'dist\index.html') -PathType Leaf)) {
    throw "Web export did not produce dist\index.html."
  }
  Write-Host "Web export PASS." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "4/4 Web export skipped. Use -ExportWeb or -DeployWeb when ready." -ForegroundColor DarkGray
}

if ($DeployWeb) {
  Write-Host ""
  Write-Host "Deploying BUKLOD Quiz WEB ONLY..." -ForegroundColor Yellow
  & npx eas-cli@latest deploy --prod --non-interactive
  if ($LASTEXITCODE -ne 0) {
    throw "Expo web deploy failed. Source patch + QA remain intact."
  }
  Write-Host "BUKLOD Quiz production web deploy COMPLETE." -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " DEVICE SESSION SELF-HEAL R1 COMPLETE" -ForegroundColor Green
Write-Host " Exam / attempt / answer / score / timer / records unchanged." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
