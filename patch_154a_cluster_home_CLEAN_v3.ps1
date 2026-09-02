$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "BUKLOD PATCH 154A - CLEAN V3" -ForegroundColor Cyan
Write-Host "Exact current-source compatible" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

function Write-Utf8([string]$Path, [string]$Content) {
    $full = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Path))
    $dir = [System.IO.Path]::GetDirectoryName($full)

    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $full,
        $Content,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Backup-Once([string]$Path) {
    $backup = "$Path.bak154a_v3"
    if (-not (Test-Path -LiteralPath $backup)) {
        Copy-Item -LiteralPath $Path -Destination $backup
        Write-Host "Backup: $backup" -ForegroundColor DarkGray
    }
}

function Stop-Patch([string]$Message) {
    throw "PATCH 154A V3 stopped: $Message"
}

$homePath   = "src\app\(tabs)\home.tsx"
$buklodPath = "src\app\(tabs)\buklod.tsx"
$prayerPath = "src\app\(tabs)\prayer.tsx"
$postPath   = "src\app\post\[id].tsx"

$required = @(
    $homePath,
    $buklodPath,
    $prayerPath,
    $postPath
)

foreach ($path in $required) {
    if (-not (Test-Path -LiteralPath $path)) {
        Stop-Patch "required file missing: $path"
    }
}

$homeText   = Get-Content -LiteralPath $homePath -Raw
$buklodText = Get-Content -LiteralPath $buklodPath -Raw
$prayerText = Get-Content -LiteralPath $prayerPath -Raw
$postText   = Get-Content -LiteralPath $postPath -Raw

# ============================================================
# PRE-VALIDATION: EXACT CURRENT SOURCE
# ============================================================

if ($homeText -notmatch "Good day,") {
    Stop-Patch "Home greeting not found"
}

if ($homeText -notmatch "router\.push\(\s*'/notifications'\s*\)") {
    Stop-Patch "Home notification action not found"
}

if ($buklodText -notmatch "COMMUNITY_AUTHOR_CIRCLE_RANK") {
    Stop-Patch "BUKLOD Circle Rank block not found"
}

if ($buklodText -notmatch "const authorIds") {
    Stop-Patch "BUKLOD authorIds block not found"
}

if ($buklodText -notmatch "setPosts\(\s*next\.map") {
    Stop-Patch "BUKLOD setPosts(next.map...) block not found"
}

if ($buklodText -notmatch "author_rank_name") {
    Stop-Patch "BUKLOD author rank mapping not found"
}

if ($prayerText -notmatch "setItems\(data\?\?\[\]\);") {
    Stop-Patch "Prayer setItems block not found"
}

if ($postText -notmatch "POST_AUTHOR_CIRCLE_RANK") {
    Stop-Patch "Post Circle Rank block not found"
}

if ($postText -notmatch "setPost\(\{\s*\.\.\.row,\s*media_url:url,\s*author_rank_name:") {
    Stop-Patch "current Post setPost rank block not found"
}

if ($postText -notmatch "setComments\(c\?\?\[\]\);") {
    Stop-Patch "current Post setComments block not found"
}

if ($postText -notmatch "\{post\.author_name\}") {
    Stop-Patch "current Post author rendering not found"
}

if ($postText -notmatch "\{c\.commenter_name\}") {
    Stop-Patch "current Comment author rendering not found"
}

Write-Host "PASS: All current-source anchors validated." -ForegroundColor Green

foreach ($path in $required) {
    Backup-Once $path
}

# ============================================================
# SQL MIGRATION
# Legacy DB names are preserved intentionally.
# ============================================================

$migrationPath =
    "supabase\migrations\20260811221000_patch154a_cluster_labels.sql"

$migration = @'
-- ============================================================================
-- PATCH 154A V3
-- USER-FACING CLUSTER LABEL SUPPORT
--
-- Legacy database identifiers remain unchanged:
--   public.buklod_groups
--   public.group_members
--   group_id
--   audience = 'group'
-- ============================================================================

create or replace function public.get_cluster_labels_for_users(
    p_user_ids uuid[]
)
returns table (
    user_id uuid,
    cluster_name text
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        gm.user_id,
        min(bg.name)::text as cluster_name
    from public.group_members gm
    join public.buklod_groups bg
      on bg.id = gm.group_id
    where gm.is_active = true
      and gm.user_id = any(
          coalesce(
              p_user_ids,
              '{}'::uuid[]
          )
      )
      and auth.uid() is not null
    group by gm.user_id;
$$;

revoke all
on function public.get_cluster_labels_for_users(uuid[])
from public;

grant execute
on function public.get_cluster_labels_for_users(uuid[])
to authenticated;

comment on function public.get_cluster_labels_for_users(uuid[])
is
'Returns active BUKLOD Cluster labels while legacy group database identifiers remain internal.';
'@

Write-Utf8 $migrationPath $migration
Write-Host "Created migration: $migrationPath" -ForegroundColor Green

# ============================================================
# SHARED CLUSTER LABEL HELPER
# ============================================================

$helperPath = "src\lib\clusterLabels.ts"

$helper = @'
import { supabase } from '@/lib/supabase';

export type ClusterLabelMap =
  Record<string, string | null>;

export async function getClusterLabels(
  userIds: Array<string | null | undefined>
): Promise<ClusterLabelMap> {
  const ids = Array.from(
    new Set(
      userIds.filter(
        (id): id is string =>
          typeof id === 'string' &&
          id.length > 0
      )
    )
  );

  if (!ids.length) {
    return {};
  }

  const { data, error } =
    await (supabase as any).rpc(
      'get_cluster_labels_for_users',
      {
        p_user_ids: ids,
      }
    );

  // Graceful until the local migration is pushed.
  if (error) {
    console.warn(
      'Cluster labels unavailable:',
      error.message
    );
    return {};
  }

  const map: ClusterLabelMap = {};

  for (const row of data ?? []) {
    if (!row?.user_id) continue;

    map[String(row.user_id)] =
      row.cluster_name
        ? String(row.cluster_name)
        : null;
  }

  return map;
}

export function formatClusterName(
  value?: string | null
): string {
  const name = String(value ?? '').trim();

  if (!name) {
    return 'No Cluster';
  }

  if (/^cluster\b/i.test(name)) {
    return name;
  }

  return `Cluster ${name}`;
}
'@

Write-Utf8 $helperPath $helper
Write-Host "Created helper: $helperPath" -ForegroundColor Green

# ============================================================
# HOME
# LEFT = Personal Messages
# RIGHT = Points Dashboard
# ============================================================

$homeText = Get-Content -LiteralPath $homePath -Raw

if ($homeText -notmatch "MaterialCommunityIcons") {
    $homeText = $homeText.Replace(
        "import { router } from 'expo-router';",
        "import { router } from 'expo-router';`r`nimport { MaterialCommunityIcons } from '@expo/vector-icons';"
    )
}

if ($homeText -notmatch "PATCH_154A_HOME_ACTIONS") {
    $rowPattern =
        '(?s)(<EnvironmentBadge\s*/>\s*<View style=\{shared\.row\}>)'

    $rowRx = [regex]::new($rowPattern)
    $rowMatch = $rowRx.Match($homeText)

    if (-not $rowMatch.Success) {
        Stop-Patch "Home header row anchor not found"
    }

    $leftButton = @'

        {/* PATCH_154A_HOME_ACTIONS */}
        <Pressable
          accessibilityLabel="Personal Messages"
          onPress={() =>
            router.push('/connect' as any)
          }
          style={({ pressed }) => ({
            width: 46,
            height: 46,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.greenSoft,
            borderWidth: 1,
            borderColor: colors.line,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <MaterialCommunityIcons
            name="message-text-outline"
            size={23}
            color={colors.greenDark}
          />
        </Pressable>
'@

    $insertAt = $rowMatch.Index + $rowMatch.Length

    $homeText =
        $homeText.Substring(0, $insertAt) +
        $leftButton +
        $homeText.Substring($insertAt)

    $notificationPattern =
        "(?s)<Pressable\s+onPress=\{\(\) =>\s*router\.push\(\s*'/notifications'\s*\)\s*\}.*?</Pressable>"

    $notificationRx =
        [regex]::new($notificationPattern)

    $notificationMatch =
        $notificationRx.Match($homeText)

    if (-not $notificationMatch.Success) {
        Stop-Patch "Home notification button block not found"
    }

    $pointsButton = @'
<Pressable
          accessibilityLabel="Points Dashboard"
          onPress={() =>
            router.push('/points')
          }
          style={({ pressed }) => ({
            width: 46,
            height: 46,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.greenSoft,
            borderWidth: 1,
            borderColor: colors.line,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <MaterialCommunityIcons
            name="circle-multiple-outline"
            size={23}
            color={colors.greenDark}
          />
        </Pressable>
'@

    $homeText =
        $homeText.Substring(
            0,
            $notificationMatch.Index
        ) +
        $pointsButton +
        $homeText.Substring(
            $notificationMatch.Index +
            $notificationMatch.Length
        )
}

Write-Utf8 $homePath $homeText
Write-Host "Updated Home: Messages LEFT / Points RIGHT" -ForegroundColor Green

# ============================================================
# BUKLOD COMMUNITY
# Preserve existing COMMUNITY_AUTHOR_CIRCLE_RANK logic.
# ============================================================

$buklodText = Get-Content -LiteralPath $buklodPath -Raw

if ($buklodText -notmatch "PATCH_154A_CLUSTER_LABELS") {
    $buklodText = $buklodText.Replace(
        "import {supabase} from '@/lib/supabase';",
        "import {supabase} from '@/lib/supabase';`r`nimport {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS"
    )
}

if ($buklodText -notmatch "PATCH_154A_CLUSTER_MAP") {
    $setPostsIndex = $buklodText.IndexOf("  setPosts(")

    if ($setPostsIndex -lt 0) {
        Stop-Patch "BUKLOD setPosts insertion point not found"
    }

    $clusterBlock = @'
  // PATCH_154A_CLUSTER_MAP
  const clusterMap =
    await getClusterLabels(
      authorIds as string[]
    );

'@

    $buklodText =
        $buklodText.Substring(0, $setPostsIndex) +
        $clusterBlock +
        $buklodText.Substring($setPostsIndex)
}

if ($buklodText -notmatch "cluster_name:\s*clusterMap") {
    $mapPattern =
        '(?s)(setPosts\(\s*next\.map\(\(p:\s*any\)\s*=>\s*\(\{\s*\.\.\.p,)'

    $mapRx = [regex]::new($mapPattern)
    $mapMatch = $mapRx.Match($buklodText)

    if (-not $mapMatch.Success) {
        Stop-Patch "BUKLOD next.map object not found"
    }

    $replacement =
        $mapMatch.Groups[1].Value +
        "`r`n      cluster_name:" +
        "`r`n        clusterMap[p.user_id] ??" +
        "`r`n        null,"

    $buklodText =
        $buklodText.Substring(0, $mapMatch.Index) +
        $replacement +
        $buklodText.Substring(
            $mapMatch.Index +
            $mapMatch.Length
        )
}

$buklodText = $buklodText.Replace(
    "group:'Only active members of your BUKLOD Group can see this post.'",
    "group:'Only active members of your BUKLOD Cluster can see this post.'"
)

$buklodText = $buklodText.Replace(
    "Alert.alert('BUKLOD','No active Group. Choose LOCAL or PUBLIC.');",
    "Alert.alert('BUKLOD','You are not yet assigned to a Cluster. Choose LOCAL or PUBLIC.');"
)

$buklodText = $buklodText.Replace(
    "<Text style={s.author}>{item.author_name||'BUKLOD Member'}</Text>",
    "<Text style={s.author}>{item.author_name||'BUKLOD Member'} · {formatClusterName(item.cluster_name)}</Text>"
)

$buklodText = $buklodText.Replace(
    "style={s.chipText}>{a.toUpperCase()}</Text>",
    "style={s.chipText}>{a==='group'?'CLUSTER':a.toUpperCase()}</Text>"
)

$buklodText = $buklodText.Replace(
    "style={s.chipText}>{f.toUpperCase()}</Text>",
    "style={s.chipText}>{f==='group'?'CLUSTER':f.toUpperCase()}</Text>"
)

$buklodText = $buklodText.Replace(
    "{m.group_name?` | ${m.group_name}`:''}",
    "{m.group_name?` | ${formatClusterName(m.group_name)}`:' | No Cluster'}"
)

Write-Utf8 $buklodPath $buklodText
Write-Host "Updated BUKLOD Cluster labels; Circle Rank preserved" -ForegroundColor Green

# ============================================================
# PRAYER WALL
# ============================================================

$prayerText = Get-Content -LiteralPath $prayerPath -Raw

if ($prayerText -notmatch "PATCH_154A_CLUSTER_LABELS") {
    $prayerText = $prayerText.Replace(
        "import { supabase } from '@/lib/supabase';",
        "import { supabase } from '@/lib/supabase';`r`nimport { getClusterLabels, formatClusterName } from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS"
    )
}

$prayerText = $prayerText.Replace(
    "setItems(data??[]);",
    "const rows=(data??[]) as any[]; const clusterMap=await getClusterLabels(rows.map((row:any)=>row.user_id)); setItems(rows.map((row:any)=>({...row,cluster_name:clusterMap[row.user_id]??null})));"
)

$prayerText = $prayerText.Replace(
    "<Text style={shared.h2}>{item.profiles?.full_name||'BUKLOD Member'}</Text>",
    "<Text style={shared.h2}>{item.profiles?.full_name||'BUKLOD Member'} · {formatClusterName(item.cluster_name)}</Text>"
)

Write-Utf8 $prayerPath $prayerText
Write-Host "Updated Prayer Wall Cluster labels" -ForegroundColor Green

# ============================================================
# POST DETAIL + COMMENTS
# Exact current block includes POST_AUTHOR_CIRCLE_RANK.
# ============================================================

$postText = Get-Content -LiteralPath $postPath -Raw

if ($postText -notmatch "PATCH_154A_CLUSTER_LABELS") {
    $postText = $postText.Replace(
        "import {supabase} from '@/lib/supabase';",
        "import {supabase} from '@/lib/supabase';`r`nimport {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS"
    )
}

if ($postText -notmatch "PATCH_154A_POST_CLUSTER_MAP") {

    $setPostIndex = $postText.IndexOf("  setPost({")

    if ($setPostIndex -lt 0) {
        Stop-Patch "Post setPost insertion point not found"
    }

    $clusterBlock = @'
  // PATCH_154A_POST_CLUSTER_MAP
  const commentRows=(c??[]) as any[];
  const clusterMap=await getClusterLabels([
   row.user_id,
   ...commentRows.map((x:any)=>x.user_id)
  ]);

'@

    $postText =
        $postText.Substring(0, $setPostIndex) +
        $clusterBlock +
        $postText.Substring($setPostIndex)
}

if ($postText -notmatch "cluster_name:\s*clusterMap\[row\.user_id\]") {
    $postSetPattern =
        '(?s)(setPost\(\{\s*\.\.\.row,\s*media_url:url,)'

    $postSetRx = [regex]::new($postSetPattern)
    $postSetMatch = $postSetRx.Match($postText)

    if (-not $postSetMatch.Success) {
        Stop-Patch "Post setPost object not found"
    }

    $replacement =
        $postSetMatch.Groups[1].Value +
        "`r`n   cluster_name:" +
        "`r`n    clusterMap[row.user_id]??null,"

    $postText =
        $postText.Substring(0, $postSetMatch.Index) +
        $replacement +
        $postText.Substring(
            $postSetMatch.Index +
            $postSetMatch.Length
        )
}

$postText = $postText.Replace(
    "  setComments(c??[]);",
    "  setComments(commentRows.map((x:any)=>({...x,cluster_name:clusterMap[x.user_id]??null})));"
)

$postText = $postText.Replace(
    "   {post.author_name}",
    "   {post.author_name} · {formatClusterName(post.cluster_name)}"
)

$postText = $postText.Replace(
    "style={s.commentName}>{c.commenter_name}</Text>",
    "style={s.commentName}>{c.commenter_name} · {formatClusterName(c.cluster_name)}</Text>"
)

Write-Utf8 $postPath $postText
Write-Host "Updated Post + Comment Cluster labels; Post Circle Rank preserved" -ForegroundColor Green

# ============================================================
# TARGETED USER-FACING GROUP -> CLUSTER
# No DB identifier/route rename.
# ============================================================

$uiPaths = @(
    "src\app\admin\index.tsx",
    "src\app\admin\groups.tsx",
    "src\app\admin\member-master.tsx",
    "src\app\admin\local-members.tsx",
    "src\app\(tabs)\me.tsx"
)

$terms = @(
    @("BUKLOD Groups", "BUKLOD Clusters"),
    @("BUKLOD Group", "BUKLOD Cluster"),
    @("BUKLOD groups", "BUKLOD clusters"),
    @("BUKLOD group", "BUKLOD cluster"),
    @("Group Members", "Cluster Members"),
    @("Group Member", "Cluster Member"),
    @("Group Leader", "Cluster Leader"),
    @("No active Group", "No active Cluster"),
    @("No Group", "No Cluster"),
    @("Group Assignment", "Cluster Assignment"),
    @("Group Assignments", "Cluster Assignments"),
    @("groups and cluster organization", "clusters and member organization"),
    @("groups and follow-up", "clusters and follow-up")
)

foreach ($path in $uiPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        continue
    }

    Backup-Once $path

    $text = Get-Content -LiteralPath $path -Raw
    $before = $text

    foreach ($pair in $terms) {
        $text = $text.Replace($pair[0], $pair[1])
    }

    if ($text -ne $before) {
        Write-Utf8 $path $text
        Write-Host "Updated terminology: $path" -ForegroundColor Green
    }
}

# ============================================================
# VERIFY
# ============================================================

Write-Host ""
Write-Host "=== HOME CHECK ===" -ForegroundColor Cyan

Select-String `
    -LiteralPath $homePath `
    -Pattern `
      "PATCH_154A_HOME_ACTIONS|/connect|/points|message-text-outline|circle-multiple-outline" `
    -Context 0,1

Write-Host ""
Write-Host "=== BUKLOD RANK + CLUSTER CHECK ===" -ForegroundColor Cyan

Select-String `
    -LiteralPath $buklodPath `
    -Pattern `
      "COMMUNITY_AUTHOR_CIRCLE_RANK|PATCH_154A_CLUSTER_MAP|cluster_name|author_rank_name|setPosts" `
    -Context 1,3

Write-Host ""
Write-Host "=== POST RANK + CLUSTER CHECK ===" -ForegroundColor Cyan

Select-String `
    -LiteralPath $postPath `
    -Pattern `
      "POST_AUTHOR_CIRCLE_RANK|PATCH_154A_POST_CLUSTER_MAP|cluster_name|author_rank_name|setComments" `
    -Context 1,3

Write-Host ""
Write-Host "=== WEEKLY BIBLE LEGACY CONTROL CHECK ===" -ForegroundColor Cyan

$weeklyLegacy =
    Get-ChildItem "src\app" `
        -Recurse `
        -File `
        -Include *.tsx,*.ts |
    Where-Object {
        $_.Name -notmatch "\.bak"
    } |
    Select-String `
        -Pattern `
          "Weekly Bible Reading|OPEN WEEKLY MONITORING"

if ($weeklyLegacy) {
    $weeklyLegacy
}
else {
    Write-Host "PASS: No obsolete Weekly Bible Reading control text found." -ForegroundColor Green
}

# ============================================================
# TYPESCRIPT
# ============================================================

Write-Host ""
Write-Host "=== TYPESCRIPT CHECK ===" -ForegroundColor Cyan

& npx tsc --noEmit

if ($LASTEXITCODE -ne 0) {
    throw "PATCH 154A V3 wrote backups and changes, but TypeScript reported errors. DO NOT db push. Send the TypeScript errors."
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "PATCH 154A V3 COMPLETE - TYPESCRIPT PASS" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "DO NOT RUN supabase db push YET." -ForegroundColor Yellow
Write-Host "Send the final output first." -ForegroundColor Yellow
