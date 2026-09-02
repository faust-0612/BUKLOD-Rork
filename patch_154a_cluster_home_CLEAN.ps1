$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "BUKLOD PATCH 154A - CLEAN" -ForegroundColor Cyan
Write-Host "Cluster labels + Home Messages/Points" -ForegroundColor Cyan
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
    $backup = "$Path.bak154a"
    if (-not (Test-Path -LiteralPath $backup)) {
        Copy-Item -LiteralPath $Path -Destination $backup
        Write-Host "Backup created: $backup" -ForegroundColor DarkGray
    }
}

function Require-Contains(
    [string]$Content,
    [string]$Needle,
    [string]$Label
) {
    if (-not $Content.Contains($Needle)) {
        throw "PATCH 154A stopped: anchor not found [$Label]"
    }
}

# ============================================================
# PATHS
# ============================================================

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
        throw "PATCH 154A stopped: required file missing: $path"
    }
}

# ============================================================
# LOAD CURRENT SOURCE
# ============================================================

$homeText   = Get-Content -LiteralPath $homePath -Raw
$buklod = Get-Content -LiteralPath $buklodPath -Raw
$prayer = Get-Content -LiteralPath $prayerPath -Raw
$post   = Get-Content -LiteralPath $postPath -Raw

# ============================================================
# VALIDATE ALL IMPORTANT ANCHORS FIRST
# Nothing is changed until these checks pass.
# ============================================================

if ($homeText -notmatch "PATCH_154A_HOME_ACTIONS") {
    Require-Contains $homeText "Good day," "Home greeting"
    Require-Contains $homeText "router.push(" "Home router"
    Require-Contains $homeText "'/notifications'" "Current Home notification action"
}

if ($buklod -notmatch "PATCH_154A_CLUSTER_LABELS") {
    Require-Contains $buklod "import {supabase} from '@/lib/supabase';" "BUKLOD supabase import"
}
Require-Contains $buklod "setPosts(next);" "BUKLOD setPosts"
Require-Contains $buklod "item.author_name||'BUKLOD Member'" "BUKLOD author"
Require-Contains $buklod "No active Group. Choose LOCAL or PUBLIC." "BUKLOD no-group warning"

if ($prayer -notmatch "PATCH_154A_CLUSTER_LABELS") {
    Require-Contains $prayer "import { supabase } from '@/lib/supabase';" "Prayer supabase import"
}
Require-Contains $prayer "setItems(data??[]);" "Prayer setItems"
Require-Contains $prayer "item.profiles?.full_name||'BUKLOD Member'" "Prayer author"

if ($post -notmatch "PATCH_154A_CLUSTER_LABELS") {
    Require-Contains $post "import {supabase} from '@/lib/supabase';" "Post supabase import"
}
Require-Contains $post "setPost({...row,media_url:url});setComments(c??[]);" "Post load rows"
Require-Contains $post "style={s.author}>{post.author_name}</Text>" "Post author"
Require-Contains $post "style={s.commentName}>{c.commenter_name}</Text>" "Comment author"

Write-Host "PASS: All source anchors validated." -ForegroundColor Green

# ============================================================
# BACKUPS
# ============================================================

foreach ($path in $required) {
    Backup-Once $path
}

# ============================================================
# DATABASE MIGRATION
# Internal database names remain group/group_id for compatibility.
# ============================================================

$migrationPath =
    "supabase\migrations\20260811214000_patch154a_cluster_labels.sql"

$migration = @'
-- ============================================================================
-- PATCH 154A
-- USER-FACING BUKLOD CLUSTER LABEL SUPPORT
--
-- IMPORTANT:
-- Existing buklod_groups, group_members, group_id, and audience='group'
-- identifiers are intentionally retained internally for compatibility.
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
Write-Host "Created: $migrationPath" -ForegroundColor Green

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

  // Safe fallback before the migration is pushed.
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
Write-Host "Created: $helperPath" -ForegroundColor Green

# ============================================================
# HOME
# Personal Messages LEFT
# Points Dashboard RIGHT
# ============================================================

$homeText = Get-Content -LiteralPath $homePath -Raw

if ($homeText -notmatch "MaterialCommunityIcons") {
    $homeText = $homeText.Replace(
        "import { router } from 'expo-router';",
        "import { router } from 'expo-router';`r`nimport { MaterialCommunityIcons } from '@expo/vector-icons';"
    )
}

if ($homeText -notmatch "PATCH_154A_HOME_ACTIONS") {
    $homePattern = '(?s)<View style=\{shared\.row\}>\s*<View style=\{\{ flex: 1 \}\}>\s*<Text style=\{shared\.muted\}>\s*Good day,\s*</Text>\s*<Text style=\{shared\.h1\}>\s*\{profile\?\.full_name \|\|\s*''BUKLOD Member''\}\s*</Text>\s*</View>\s*<Pressable\s+onPress=\{\(\) =>\s*router\.push\(\s*''/notifications''\s*\)\s*\}\s*>\s*<Text[\s\S]*?</Text>\s*</Pressable>\s*</View>'

    $rx = [regex]::new($homePattern)
    $match = $rx.Match($homeText)

    if (-not $match.Success) {
        throw "PATCH 154A stopped: exact Home header block was not found. Backups are intact."
    }

    $homeReplacement = @'
{/* PATCH_154A_HOME_ACTIONS */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          accessibilityLabel="Personal Messages"
          onPress={() =>
            router.push('/connect' as any)
          }
          style={({ pressed }) => ({
            width: 48,
            height: 48,
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
            size={24}
            color={colors.greenDark}
          />
        </Pressable>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
          }}
        >
          <Text style={shared.muted}>
            Good day,
          </Text>

          <Text
            style={[
              shared.h1,
              { textAlign: 'center' },
            ]}
          >
            {profile?.full_name ||
              'BUKLOD Member'}
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Points Dashboard"
          onPress={() =>
            router.push('/points')
          }
          style={({ pressed }) => ({
            width: 48,
            height: 48,
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
            size={24}
            color={colors.greenDark}
          />
        </Pressable>
      </View>
'@

    $homeText =
        $homeText.Substring(0, $match.Index) +
        $homeReplacement +
        $homeText.Substring(
            $match.Index + $match.Length
        )
}

Write-Utf8 $homePath $homeText
Write-Host "Updated: Home Messages LEFT / Points RIGHT" -ForegroundColor Green

# ============================================================
# BUKLOD COMMUNITY
# ============================================================

$buklod = Get-Content -LiteralPath $buklodPath -Raw

if ($buklod -notmatch "PATCH_154A_CLUSTER_LABELS") {
    $buklod = $buklod.Replace(
        "import {supabase} from '@/lib/supabase';",
        "import {supabase} from '@/lib/supabase';`r`nimport {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS"
    )
}

$buklod = $buklod.Replace(
    "})); setPosts(next);",
    "})); const clusterMap=await getClusterLabels(next.map((p:any)=>p.user_id)); setPosts(next.map((p:any)=>({...p,cluster_name:clusterMap[p.user_id]??null})));"
)

$buklod = $buklod.Replace(
    "<Text style={s.author}>{item.author_name||'BUKLOD Member'}</Text>",
    "<Text style={s.author}>{item.author_name||'BUKLOD Member'} Â· {formatClusterName(item.cluster_name)}</Text>"
)

$buklod = $buklod.Replace(
    "group:'Only active members of your BUKLOD Group can see this post.'",
    "group:'Only active members of your BUKLOD Cluster can see this post.'"
)

$buklod = $buklod.Replace(
    "Alert.alert('BUKLOD','No active Group. Choose LOCAL or PUBLIC.');",
    "Alert.alert('BUKLOD','You are not yet assigned to a Cluster. Choose LOCAL or PUBLIC.');"
)

$buklod = $buklod.Replace(
    "style={s.chipText}>{a.toUpperCase()}</Text>",
    "style={s.chipText}>{a==='group'?'CLUSTER':a.toUpperCase()}</Text>"
)

$buklod = $buklod.Replace(
    "style={s.chipText}>{f.toUpperCase()}</Text>",
    "style={s.chipText}>{f==='group'?'CLUSTER':f.toUpperCase()}</Text>"
)

$buklod = $buklod.Replace(
    "{m.group_name?` | ${m.group_name}`:''}",
    "{m.group_name?` | ${formatClusterName(m.group_name)}`:' | No Cluster'}"
)

Write-Utf8 $buklodPath $buklod
Write-Host "Updated: BUKLOD Community Cluster presentation" -ForegroundColor Green

# ============================================================
# PRAYER WALL
# ============================================================

$prayer = Get-Content -LiteralPath $prayerPath -Raw

if ($prayer -notmatch "PATCH_154A_CLUSTER_LABELS") {
    $prayer = $prayer.Replace(
        "import { supabase } from '@/lib/supabase';",
        "import { supabase } from '@/lib/supabase';`r`nimport { getClusterLabels, formatClusterName } from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS"
    )
}

$prayer = $prayer.Replace(
    "setItems(data??[]);",
    "const rows=(data??[]) as any[]; const clusterMap=await getClusterLabels(rows.map((row:any)=>row.user_id)); setItems(rows.map((row:any)=>({...row,cluster_name:clusterMap[row.user_id]??null})));"
)

$prayer = $prayer.Replace(
    "<Text style={shared.h2}>{item.profiles?.full_name||'BUKLOD Member'}</Text>",
    "<Text style={shared.h2}>{item.profiles?.full_name||'BUKLOD Member'} Â· {formatClusterName(item.cluster_name)}</Text>"
)

Write-Utf8 $prayerPath $prayer
Write-Host "Updated: Prayer Wall Cluster labels" -ForegroundColor Green

# ============================================================
# POST DETAIL + COMMENTS
# ============================================================

$post = Get-Content -LiteralPath $postPath -Raw

if ($post -notmatch "PATCH_154A_CLUSTER_LABELS") {
    $post = $post.Replace(
        "import {supabase} from '@/lib/supabase';",
        "import {supabase} from '@/lib/supabase';`r`nimport {getClusterLabels,formatClusterName} from '@/lib/clusterLabels'; // PATCH_154A_CLUSTER_LABELS"
    )
}

$post = $post.Replace(
    "setPost({...row,media_url:url});setComments(c??[]);",
    "const commentRows=(c??[]) as any[]; const clusterMap=await getClusterLabels([row.user_id,...commentRows.map((x:any)=>x.user_id)]); setPost({...row,media_url:url,cluster_name:clusterMap[row.user_id]??null}); setComments(commentRows.map((x:any)=>({...x,cluster_name:clusterMap[x.user_id]??null})));"
)

$post = $post.Replace(
    "style={s.author}>{post.author_name}</Text>",
    "style={s.author}>{post.author_name} Â· {formatClusterName(post.cluster_name)}</Text>"
)

$post = $post.Replace(
    "style={s.commentName}>{c.commenter_name}</Text>",
    "style={s.commentName}>{c.commenter_name} Â· {formatClusterName(c.cluster_name)}</Text>"
)

Write-Utf8 $postPath $post
Write-Host "Updated: Post and Comment Cluster labels" -ForegroundColor Green

# ============================================================
# TARGETED USER-FACING TERMINOLOGY
# Never rename database identifiers, table names, enum values, or routes.
# ============================================================

$uiPaths = @(
    "src\app\admin\index.tsx",
    "src\app\admin\groups.tsx",
    "src\app\admin\member-master.tsx",
    "src\app\admin\local-members.tsx",
    "src\app\(tabs)\me.tsx"
)

$replacements = @(
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

    $text = Get-Content -LiteralPath $path -Raw
    $original = $text

    foreach ($pair in $replacements) {
        $text = $text.Replace(
            $pair[0],
            $pair[1]
        )
    }

    if ($text -ne $original) {
        Write-Utf8 $path $text
        Write-Host "Terminology updated: $path" -ForegroundColor Green
    }
}

# ============================================================
# VERIFY SOURCE TEXT
# ============================================================

Write-Host ""
Write-Host "=== HOME CHECK ===" -ForegroundColor Cyan
Select-String `
    -LiteralPath $homePath `
    -Pattern `
      "PATCH_154A_HOME_ACTIONS|/connect|/points|message-text-outline|circle-multiple-outline" `
    -Context 0,1

Write-Host ""
Write-Host "=== CLUSTER CHECK ===" -ForegroundColor Cyan
Select-String `
    -LiteralPath `
      $buklodPath,`
      $prayerPath,`
      $postPath `
    -Pattern `
      "formatClusterName|getClusterLabels|BUKLOD Cluster|No Cluster|CLUSTER" `
    -Context 0,1

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
    throw "PATCH 154A source changes were written, but TypeScript reported errors. Send the errors before continuing."
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "PATCH 154A COMPLETE - TYPESCRIPT PASS" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "DO NOT RUN supabase db push YET." -ForegroundColor Yellow
Write-Host "Send the final output first." -ForegroundColor Yellow
