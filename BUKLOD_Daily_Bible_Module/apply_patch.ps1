$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path,[string]$Content) {
  [System.IO.File]::WriteAllText($Path,$Content,[System.Text.UTF8Encoding]::new($false))
}

$mePath = "src\app\(tabs)\me.tsx"
$adminPath = "src\app\admin\index.tsx"
$layoutPath = "src\app\_layout.tsx"

$me = Get-Content -LiteralPath $mePath -Raw
if ($me -notmatch 'title="Daily Bible Reading"') {
  $pattern = '(?s)(<MenuRow\s+icon="school-outline"\s+title="My Learning".*?\/>)'
  $add = @'

        <MenuRow
          icon="book-open-variant"
          title="Daily Bible Reading"
          subtitle="Today’s passage, reflection and weekly progress"
          onPress={() => router.push('/bible')}
        />
'@
  $me = [regex]::Replace($me,$pattern,{param($m)$m.Groups[1].Value+$add},1)
  Write-Utf8NoBom $mePath $me
}

$admin = Get-Content -LiteralPath $adminPath -Raw
if ($admin -notmatch 'title="Weekly Bible Reading"') {
  $pattern = '(?s)(<AdminRow\s+icon="book-open-page-variant-outline"\s+title="Devotional Content".*?\/>)'
  $add = @'

              <AdminRow
                icon="book-open-variant"
                title="Weekly Bible Reading"
                subtitle="Set daily passages, reflection questions and monitor submissions"
                path="/admin/bible"
              />
'@
  $admin = [regex]::Replace($admin,$pattern,{param($m)$m.Groups[1].Value+$add},1)
  Write-Utf8NoBom $adminPath $admin
}

$layout = Get-Content -LiteralPath $layoutPath -Raw
if ($layout -notmatch 'name="bible/index"') {
  $layout = [regex]::Replace(
    $layout,
    '(<Stack\.Screen name="learn/lesson"[^>]*/>)',
    '$1'+"`r`n                "+'<Stack.Screen name="bible/index" />',
    1
  )
}
if ($layout -notmatch 'name="admin/bible/index"') {
  $insert = '$1'+"`r`n                "+'<Stack.Screen name="admin/bible/index" />'+"`r`n                "+'<Stack.Screen name="admin/bible/monitor" />'
  $layout = [regex]::Replace($layout,'(<Stack\.Screen name="admin/index"[^>]*/>)',$insert,1)
}
Write-Utf8NoBom $layoutPath $layout

Write-Host "Daily Bible menus/routes patched." -ForegroundColor Green
