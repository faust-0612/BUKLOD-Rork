$ErrorActionPreference = "Stop"

$ScopeP = "src\app\scope\index.tsx"
$CommP  = "src\components\BuklodExclusiveScopeCommunity.tsx"
$Stamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$Utf8   = [System.Text.UTF8Encoding]::new($false)

if (!(Test-Path -LiteralPath $ScopeP)) {
    throw "Missing $ScopeP"
}

if (!(Test-Path -LiteralPath $CommP)) {
    throw "Missing $CommP"
}

Copy-Item -LiteralPath $ScopeP `
    -Destination "$ScopeP.before_CLUSTER_CLEAN_NAV_$Stamp.bak" `
    -Force

Copy-Item -LiteralPath $CommP `
    -Destination "$CommP.before_CLUSTER_CLEAN_NAV_$Stamp.bak" `
    -Force

$Scope = [System.IO.File]::ReadAllText(
    (Resolve-Path -LiteralPath $ScopeP)
)

$Comm = [System.IO.File]::ReadAllText(
    (Resolve-Path -LiteralPath $CommP)
)

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " CLUSTER CLEAN NAV + REALTIME FIX" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# ------------------------------------------------------------
# 1. HIDE UPPER HOME / COMMUNITY TABS FOR CLUSTER
# ------------------------------------------------------------

if ($Scope -notmatch "const\s+isCluster\s*=") {
    throw "isCluster variable is missing from scope workspace."
}

if (
    $Scope -notmatch
    "isCluster\s*&&\s*\{\s*display\s*:\s*['""]none['""]\s*\}"
) {
    if (
        [regex]::IsMatch(
            $Scope,
            "styles\.tabs\s*,"
        )
    ) {
        $Scope = [regex]::Replace(
            $Scope,
            "styles\.tabs\s*,",
            "styles.tabs,`r`n          isCluster && { display: 'none' },",
            1
        )
    }
    elseif (
        $Scope.Contains(
            "style={styles.tabs}"
        )
    ) {
        $Scope = $Scope.Replace(
            "style={styles.tabs}",
            "style={[styles.tabs, isCluster && { display: 'none' }]}"
        )
    }
    else {
        throw "Could not locate scoped HOME / COMMUNITY tabs."
    }

    Write-Host "PASS: Cluster upper HOME / COMMUNITY hidden." -ForegroundColor Green
}
else {
    Write-Host "PASS: Cluster upper tabs were already hidden." -ForegroundColor DarkGreen
}

# ------------------------------------------------------------
# 2. HIDE "EXCLUSIVE CLUSTER COMMUNITY" CARD
# ------------------------------------------------------------

if (
    $Comm -notmatch
    "scope\.scope_type\s*===\s*['""]CLUSTER['""].*?display\s*:\s*['""]none['""]"
) {
    $NoticePattern =
        "style\s*=\s*\{\s*styles\.scopeNotice\s*\}"

    $NoticeCount =
        [regex]::Matches(
            $Comm,
            $NoticePattern
        ).Count

    if ($NoticeCount -ne 1) {
        throw "Expected exactly 1 scopeNotice style. Found $NoticeCount."
    }

    $Comm = [regex]::Replace(
        $Comm,
        $NoticePattern,
        "style={[styles.scopeNotice, scope.scope_type === 'CLUSTER' && { display: 'none' }]}",
        1
    )

    Write-Host "PASS: Exclusive Cluster Community instruction card hidden." -ForegroundColor Green
}
else {
    Write-Host "PASS: Cluster instruction card was already hidden." -ForegroundColor DarkGreen
}

# ------------------------------------------------------------
# 3. FIX COMMUNITY REALTIME CHANNEL COLLISION
# ------------------------------------------------------------

$OldCommunity =
    '`exclusive-scope-community:${scope.scope_id}`'

$NewCommunity =
    '`exclusive-scope-community:${scope.scope_id}:${Date.now()}:${Math.random().toString(36).slice(2)}`'

if ($Comm.Contains($OldCommunity)) {
    $Comm =
        $Comm.Replace(
            $OldCommunity,
            $NewCommunity
        )

    Write-Host "PASS: Community realtime channel made unique." -ForegroundColor Green
}
elseif ($Comm.Contains($NewCommunity)) {
    Write-Host "PASS: Community realtime channel already unique." -ForegroundColor DarkGreen
}
else {
    throw "Community realtime channel anchor not found."
}

# ------------------------------------------------------------
# 4. FIX COMMENT REALTIME CHANNEL COLLISION TOO
# ------------------------------------------------------------

$OldComments =
    '`exclusive-scope-comments:${postId}`'

$NewComments =
    '`exclusive-scope-comments:${postId}:${Date.now()}:${Math.random().toString(36).slice(2)}`'

if ($Comm.Contains($OldComments)) {
    $Comm =
        $Comm.Replace(
            $OldComments,
            $NewComments
        )

    Write-Host "PASS: Comment realtime channel made unique." -ForegroundColor Green
}
elseif ($Comm.Contains($NewComments)) {
    Write-Host "PASS: Comment realtime channel already unique." -ForegroundColor DarkGreen
}
else {
    Write-Host "INFO: No static comments channel found." -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 5. SAVE
# ------------------------------------------------------------

[System.IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $ScopeP),
    $Scope,
    $Utf8
)

[System.IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $CommP),
    $Comm,
    $Utf8
)

# ------------------------------------------------------------
# 6. STATIC QA
# ------------------------------------------------------------

$ScopeCheck =
    [System.IO.File]::ReadAllText(
        (Resolve-Path -LiteralPath $ScopeP)
    )

$CommCheck =
    [System.IO.File]::ReadAllText(
        (Resolve-Path -LiteralPath $CommP)
    )

if (
    $ScopeCheck -notmatch
    "isCluster\s*&&\s*\{\s*display\s*:\s*['""]none['""]\s*\}"
) {
    throw "QA FAILED: Cluster upper tabs are still visible."
}

if (
    $CommCheck.Contains(
        '`exclusive-scope-community:${scope.scope_id}`'
    )
) {
    throw "QA FAILED: old Community realtime channel remains."
}

if (
    $CommCheck -notmatch
    "exclusive-scope-community:\$\{scope\.scope_id\}:\$\{Date\.now\(\)\}"
) {
    throw "QA FAILED: unique Community realtime channel missing."
}

Write-Host ""
Write-Host "Static QA passed." -ForegroundColor Green

Write-Host ""
Write-Host "Running TypeScript..." -ForegroundColor Yellow

& npx tsc --noEmit

if ($LASTEXITCODE -ne 0) {
    throw "TypeScript failed."
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " CLUSTER CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host " - Upper HOME / COMMUNITY removed from Cluster" -ForegroundColor White
Write-Host " - Exclusive Cluster Community card removed" -ForegroundColor White
Write-Host " - Bottom nav remains active" -ForegroundColor White
Write-Host " - Public Connect remains available" -ForegroundColor White
Write-Host " - Community realtime collision fixed" -ForegroundColor White
Write-Host " - Comment realtime collision protected" -ForegroundColor White
