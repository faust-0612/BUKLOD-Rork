$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "BUKLOD PATCH 154A - CLEAN V2" -ForegroundColor Cyan
Write-Host "Current-source compatible" -ForegroundColor Cyan
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
    $backup = "$Path.bak154a_v2"
    if (-not (Test-Path -LiteralPath $backup)) {
        Copy-Item -LiteralPath $Path -Destination $backup
        Write-Host "Backup: $backup" -ForegroundColor DarkGray
    }
}

function Stop-Patch([string]$Message) {
    throw "PATCH 154A V2 stopped: $Message"
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
# PRE-VALIDATION
# ============================================================

if ($homeText -notmatch "PATCH_154A_HOME_ACTIONS") {
    if ($homeText -notmatch "Good day,") {
        Stop-Patch "Home greeting not found"
    }

    if ($homeText -notmatch "router\.push\(\s*'/notifications'\s*\)") {
        Stop-Patch "Home notification action not found"
    }
}

if ($buklodText -notmatch "COMMUNITY_AUTHOR_CIRCLE_RANK") {
    Stop-Patch "current BUKLOD Circle Rank block not found"
}

if ($buklodText -notmatch "const authorIds") {
    Stop-Patch "BUKLOD authorIds block not found"
}

if ($buklodText -notmatch "setPosts\(\s*next\.map") {
    Stop-Patch "current BUKLOD setPosts(next.map...) block not found"
}

if ($buklodText -notmatch "author_rank_name") {
    Stop-Patch "BUKLOD author rank mapping not found"
}

if ($prayerText -notmatch "setItems\(data\?\?\[\]\);") {
    Stop-Patch "Prayer setItems block not found"
}

if ($postText -notmatch "setPost\(\{\.\.\.row,media_url:url\}\);setComments\(c\?\?\[\]\);") {
    Stop-Patch "Post load block not found"
}

Write-Host "PASS: Current-source anchors validated." -ForegroundColor Green

foreach ($path in $required) {
    Backup-Once $path
}

# ============================================================
# SQL MIGRATION
# Preserve existing group_* DB identifiers internally.
# ============================================================

$migrationPath =
    "supabase\migrations\20260811215500_patch154a_cluster_labels.sql"

$migration = @'
-- ============================================================================
-- PATCH 154A V2
-- USER-FACING CLUSTER LABEL SUPPORT
--
-- Legacy database names stay unchanged:
--   buklod_groups
--   group_members
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
      and exists (
          select 1
          from public.profiles caller
          where caller.id = (select auth.uid())
            and caller.is_active = true
      )
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
# TS HELPER
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
# Message icon LEFT
# Points icon RIGHT
# Replace the existing right notification action.
# ============================================================

$homeText = Get-Content -LiteralPath $homePath -Raw

if ($homeText -notmatch "MaterialCommunityIcons") {
    $homeText = $homeText.Replace(
        "import { router } from 'expo-router';",
        "import { router } from 'expo-router';`r`nimport { MaterialCommunityIcons } from '@expo/vector-icons';"
    )
}

if ($homeText -notmatch "PATCH_154A_HOME_ACTIONS") {

    # Insert left message button immediately after the greeting row opens.
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

    # Replace the current right notification Pressable with Points.
    $notificationPattern =
        "(?s)<Pressable\s+onPress=\{\(\) =>\s*router\.push\(\s*'/notifications'\s*\)\s*\}.*?</Pressable>"

    $notificationRx =
        [regex]::new($notificationPattern)

    $notificationMatch =
        $notificationRx.Match($homeText)

    if (-not $notificationMatch.Success) {
        Stop-Patch "Home right notification Pressable not found"
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
# Preserve COMMUNITY_AUTHOR_CIRCLE_RANK.
# Add Cluster lookup before existing setPosts(next.map(...)).
# ============================================================

$buklodText =
    Get-Content -LiteralPath $buklodPath -Raw

if ($buklodText -notmatch "PATCH_154A_CLUSTER_LABELS") {
    $buklodText = $buklodText.Replace(
        "import {supabase} from '@/lib/supabase';",
        "import {supabase} from '@/lib/supabase';`r`nimport {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS"
    )
}

if ($buklodText -notmatch "PATCH_154A_CLUSTER_MAP") {
    $setPostsIndex =
        $buklodText.IndexOf(
            "  setPosts("
        )

    if ($setPostsIndex -lt 0) {
        Stop-Patch "BUKLOD setPosts insertion position not found"
    }

    $clusterBlock = @'
  // PATCH_154A_CLUSTER_MAP
  const clusterMap =
    await getClusterLabels(
      authorIds as string[]
    );

'@

    $buklodText =
        $buklodText.Substring(
            0,
            $setPostsIndex
        ) +
        $clusterBlock +
        $buklodText.Substring(
            $setPostsIndex
        )
}

# Add cluster_name to the CURRENT existing map object without touching rank.
if ($buklodText -notmatch "cluster_name:\s*clusterMap") {

    $mapPattern =
        '(?s)(setPosts\(\s*next\.map\(\(p:\s*any\)\s*=>\s*\(\{\s*\.\.\.p,)'

    $mapRx = [regex]::new($mapPattern)
    $mapMatch = $mapRx.Match($buklodText)

    if (-not $mapMatch.Success) {
        Stop-Patch "BUKLOD current next.map object not found"
    }

    $mapReplacement =
        $mapMatch.Groups[1].Value +
        "`r`n      cluster_name:" +
        "`r`n        clusterMap[p.user_id] ??" +
        "`r`n        null,"

    $buklodText =
        $buklodText.Substring(
            0,
            $mapMatch.Index
        ) +
        $mapReplacement +
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
Write-Host "Updated BUKLOD: Cluster labels; Circle Rank preserved" -ForegroundColor Green

# ============================================================
# PRAYER WALL
# ============================================================

$prayerText =
    Get-Content -LiteralPath $prayerPath -Raw

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
# ============================================================

$postText =
    Get-Content -LiteralPath $postPath -Raw

if ($postText -notmatch "PATCH_154A_CLUSTER_LABELS") {
    $postText = $postText.Replace(
        "import {supabase} from '@/lib/supabase';",
        "import {supabase} from '@/lib/supabase';`r`nimport {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS"
    )
}

$postText = $postText.Replace(
    "setPost({...row,media_url:url});setComments(c??[]);",
    "const commentRows=(c??[]) as any[]; const clusterMap=await getClusterLabels([row.user_id,...commentRows.map((x:any)=>x.user_id)]); setPost({...row,media_url:url,cluster_name:clusterMap[row.user_id]??null}); setComments(commentRows.map((x:any)=>({...x,cluster_name:clusterMap[x.user_id]??null})));"
)

$postText = $postText.Replace(
    "style={s.author}>{post.author_name}</Text>",
    "style={s.author}>{post.author_name} · {formatClusterName(post.cluster_name)}</Text>"
)

$postText = $postText.Replace(
    "style={s.commentName}>{c.commenter_name}</Text>",
    "style={s.commentName}>{c.commenter_name} · {formatClusterName(c.cluster_name)}</Text>"
)

Write-Utf8 $postPath $postText
Write-Host "Updated Post + Comment Cluster labels" -ForegroundColor Green

# ============================================================
# TARGETED USER-FACING GROUP -> CLUSTER
# Only known UI phrases. Never rename DB identifiers.
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
    @("Group Assignments", "Cluster Assignments")
)

foreach ($path in $uiPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        continue
    }

    Backup-Once $path

    $text =
        Get-Content -LiteralPath $path -Raw

    $before = $text

    foreach ($pair in $terms) {
        $text =
            $text.Replace(
                $pair[0],
                $pair[1]
            )
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
Write-Host "=== HOME ===" -ForegroundColor Cyan

Select-String `
    -LiteralPath $homePath `
    -Pattern `
      "PATCH_154A_HOME_ACTIONS|/connect|/points|message-text-outline|circle-multiple-outline" `
    -Context 0,1

Write-Host ""
Write-Host "=== BUKLOD CURRENT LOAD ===" -ForegroundColor Cyan

Select-String `
    -LiteralPath $buklodPath `
    -Pattern `
      "COMMUNITY_AUTHOR_CIRCLE_RANK|PATCH_154A_CLUSTER_MAP|cluster_name|author_rank_name|setPosts" `
    -Context 1,3

Write-Host ""
Write-Host "=== CLUSTER LABELS ===" -ForegroundColor Cyan

Select-String `
    -LiteralPath `
      $buklodPath,`
      $prayerPath,`
      $postPath `
    -Pattern `
      "formatClusterName|getClusterLabels|BUKLOD Cluster|No Cluster|CLUSTER" `
    -Context 0,1

Write-Host ""
Write-Host "=== WEEKLY BIBLE LEGACY CONTROL ===" -ForegroundColor Cyan

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
    throw "PATCH 154A V2 wrote backups and changes, but TypeScript reported errors. Do not db push. Send the TypeScript errors."
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "PATCH 154A V2 COMPLETE - TYPESCRIPT PASS" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "DO NOT RUN supabase db push YET." -ForegroundColor Yellow
Write-Host "Send the final output first." -ForegroundColor Yellow
