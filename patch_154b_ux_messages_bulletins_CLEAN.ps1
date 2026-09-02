$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "BUKLOD PATCH 154B - UX / MESSAGES / BULLETINS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

function Full-Path([string]$RelPath) {
    return [System.IO.Path]::GetFullPath(
        (Join-Path (Get-Location) $RelPath)
    )
}

function Read-Utf8([string]$RelPath) {
    return [System.IO.File]::ReadAllText(
        (Full-Path $RelPath),
        [System.Text.Encoding]::UTF8
    )
}

function Write-Utf8([string]$RelPath, [string]$Content) {
    $full = Full-Path $RelPath
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

function Backup-Once([string]$RelPath) {
    if (-not (Test-Path -LiteralPath $RelPath)) {
        return
    }

    $backup = "$RelPath.bak154b"

    if (-not (Test-Path -LiteralPath $backup)) {
        Copy-Item -LiteralPath $RelPath -Destination $backup
        Write-Host "Backup: $backup" -ForegroundColor DarkGray
    }
}

function Stop-Patch([string]$Message) {
    throw "PATCH 154B stopped: $Message"
}

function Replace-Once(
    [string]$Text,
    [string]$Old,
    [string]$New,
    [string]$Label
) {
    $index = $Text.IndexOf($Old)

    if ($index -lt 0) {
        Stop-Patch "anchor not found [$Label]"
    }

    return $Text.Substring(0, $index) +
        $New +
        $Text.Substring($index + $Old.Length)
}

$layoutPath      = "src\app\(tabs)\_layout.tsx"
$messagesTabPath = "src\app\(tabs)\messages.tsx"
$homePath        = "src\app\(tabs)\home.tsx"
$connectPath     = "src\app\connect\[id].tsx"
$connectListPath = "src\app\connect\index.tsx"
$loginPath       = "src\app\(auth)\login.tsx"
$groupsPath      = "src\app\admin\groups.tsx"
$groupDetailPath = "src\app\admin\group\[id].tsx"
$usersPath       = "src\app\admin\users.tsx"
$memberMasterPath = "src\app\admin\member-master.tsx"
$localMembersPath = "src\app\admin\local-members.tsx"
$mePath           = "src\app\(tabs)\me.tsx"
$packagePath       = "package.json"
$packageLockPath   = "package-lock.json"

$required = @(
    $layoutPath,
    $homePath,
    $connectPath,
    $connectListPath,
    $loginPath,
    $packagePath
)

foreach ($path in $required) {
    if (-not (Test-Path -LiteralPath $path)) {
        Stop-Patch "required file missing: $path"
    }
}

$layoutText  = Read-Utf8 $layoutPath
$homeText    = Read-Utf8 $homePath
$connectText = Read-Utf8 $connectPath
$loginText   = Read-Utf8 $loginPath

# ============================================================
# PRE-VALIDATION
# ============================================================

if ($layoutText -notmatch '<Tabs\.Screen\s+name="word"') {
    Stop-Patch "Word bottom-tab entry not found"
}

if ($homeText -notmatch 'PATCH_154A_HOME_ACTIONS') {
    Stop-Patch "Home 154A header action marker not found"
}

if ($homeText -notmatch '<SectionTitle>\s*MISSION BULLETIN\s*</SectionTitle>') {
    Stop-Patch "Mission Bulletin section not found"
}

if ($homeText -notmatch '<SectionTitle>\s*REMINDERS\s*</SectionTitle>') {
    Stop-Patch "REMINDERS section not found"
}

if ($homeText -notmatch '<PilotLaunchCard\s*/>') {
    Stop-Patch "PilotLaunchCard anchor not found"
}

if ($connectText -notmatch 'reactCue:\s*\{') {
    Stop-Patch "Message reactCue style not found"
}

if ($connectText -notmatch 'openReaction\(\s*selected\s*\)') {
    Stop-Patch "Message drawer React action not found"
}

if ($loginText -notmatch "const \[identifier, setIdentifier\] = useState\(''\);") {
    Stop-Patch "Login identifier state not found"
}

if ($loginText -notmatch "const \[password, setPassword\] = useState\(''\);") {
    Stop-Patch "Login password state not found"
}

if ($loginText -notmatch "router\.replace\('/'\);") {
    Stop-Patch "Login success navigation anchor not found"
}

Write-Host "PASS: Patch 154B anchors validated." -ForegroundColor Green

$backupPaths = @(
    $layoutPath,
    $homePath,
    $connectPath,
    $connectListPath,
    $loginPath,
    $groupsPath,
    $groupDetailPath,
    $usersPath,
    $memberMasterPath,
    $localMembersPath,
    $mePath,
    $packagePath,
    $packageLockPath
)

foreach ($path in $backupPaths) {
    Backup-Once $path
}

# ============================================================
# 1. SECURE REMEMBER PASSWORD
# ============================================================

$packageText = Read-Utf8 $packagePath

if ($packageText -notmatch '"expo-secure-store"') {
    Write-Host ""
    Write-Host "Installing expo-secure-store..." -ForegroundColor Cyan

    & npx.cmd expo install expo-secure-store

    if ($LASTEXITCODE -ne 0) {
        Stop-Patch "expo-secure-store installation failed"
    }

    Write-Host "Installed expo-secure-store." -ForegroundColor Green
}
else {
    Write-Host "expo-secure-store already installed." -ForegroundColor DarkGray
}

$loginText = Read-Utf8 $loginPath

if ($loginText -notmatch 'PATCH_154B_REMEMBER_PASSWORD') {

    if ($loginText -match "import \{ useState \} from 'react';") {
        $loginText = $loginText.Replace(
            "import { useState } from 'react';",
            "import { useEffect, useState } from 'react';"
        )
    }
    elseif ($loginText -notmatch '\buseEffect\b') {
        $reactMatch = [regex]::Match(
            $loginText,
            "import\s*\{(?<names>[^}]*)\}\s*from\s*'react';"
        )

        if (-not $reactMatch.Success) {
            Stop-Patch "Login React import not found"
        }

        $names = $reactMatch.Groups['names'].Value.Trim()
        $replacement = "import { $names, useEffect } from 'react';"

        $loginText =
            $loginText.Substring(0, $reactMatch.Index) +
            $replacement +
            $loginText.Substring($reactMatch.Index + $reactMatch.Length)
    }

    if ($loginText -notmatch "from 'expo-secure-store'") {
        $routerAnchor = "import { router } from 'expo-router';"

        if (-not $loginText.Contains($routerAnchor)) {
            Stop-Patch "Login expo-router import anchor not found"
        }

        $loginText = $loginText.Replace(
            $routerAnchor,
            $routerAnchor + "`r`nimport * as SecureStore from 'expo-secure-store';"
        )
    }

    $stateAnchor = "  const [busy, setBusy] = useState(false);"

    if (-not $loginText.Contains($stateAnchor)) {
        Stop-Patch "Login busy-state anchor not found"
    }

    $rememberState = @'

  // PATCH_154B_REMEMBER_PASSWORD
  const [rememberPassword, setRememberPassword] =
    useState(false);
  const [rememberLoaded, setRememberLoaded] =
    useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const saved =
          await SecureStore.getItemAsync(
            'buklod.remembered_credentials.v1'
          );

        if (!active || !saved) {
          return;
        }

        const parsed = JSON.parse(saved);

        if (
          typeof parsed?.identifier === 'string' &&
          typeof parsed?.password === 'string'
        ) {
          setIdentifier(parsed.identifier);
          setPassword(parsed.password);
          setRememberPassword(true);
        }
      } catch (error) {
        console.warn(
          'Could not restore remembered BUKLOD credentials.',
          error
        );
      } finally {
        if (active) {
          setRememberLoaded(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);
'@

    $loginText = $loginText.Replace(
        $stateAnchor,
        $stateAnchor + $rememberState
    )

    $successAnchor = "    router.replace('/');"

    $rememberSave = @'
    try {
      if (rememberPassword) {
        await SecureStore.setItemAsync(
          'buklod.remembered_credentials.v1',
          JSON.stringify({
            identifier: raw,
            password,
          })
        );
      } else {
        await SecureStore.deleteItemAsync(
          'buklod.remembered_credentials.v1'
        );
      }
    } catch (storageError) {
      console.warn(
        'Could not update remembered BUKLOD credentials.',
        storageError
      );
    }

'@

    $loginText = Replace-Once `
        $loginText `
        $successAnchor `
        ($rememberSave + $successAnchor) `
        "Login success remember-save"

    $loginButtonPattern =
        '(?s)(\s*<Pressable\s+onPress=\{login\}\s+disabled=\{busy\})'

    $loginButtonRx = [regex]::new($loginButtonPattern)
    $loginButtonMatch = $loginButtonRx.Match($loginText)

    if (-not $loginButtonMatch.Success) {
        Stop-Patch "Login button anchor not found"
    }

    $rememberUi = @'

          <Pressable
            onPress={() =>
              setRememberPassword(
                (value) => !value
              )
            }
            disabled={!rememberLoaded || busy}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: rememberPassword,
              disabled: !rememberLoaded || busy,
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              marginBottom: 14,
              opacity:
                !rememberLoaded || busy
                  ? 0.55
                  : 1,
            }}
          >
            <Ionicons
              name={
                rememberPassword
                  ? 'checkbox-outline'
                  : 'square-outline'
              }
              size={22}
              color={colors.greenDark}
            />
            <Text
              style={{
                color: colors.greenDark,
                fontWeight: '800',
                fontSize: 13,
              }}
            >
              Remember password on this device
            </Text>
          </Pressable>
'@

    $insertAt = $loginButtonMatch.Index

    $loginText =
        $loginText.Substring(0, $insertAt) +
        $rememberUi +
        $loginText.Substring($insertAt)
}

Write-Utf8 $loginPath $loginText
Write-Host "Updated Login: secure Remember Password restored." -ForegroundColor Green

# ============================================================
# 2. BOTTOM NAV: MESSAGES REPLACES WORD
#    WORD remains available from Home.
# ============================================================

$layoutText = Read-Utf8 $layoutPath

if ($layoutText -notmatch "MaterialCommunityIcons") {
    $layoutText = $layoutText.Replace(
        "import { ActivityIndicator, Text, View } from 'react-native';",
        "import { ActivityIndicator, Text, View } from 'react-native';`r`nimport { MaterialCommunityIcons } from '@expo/vector-icons';"
    )
}

if ($layoutText -notmatch 'name="messages"') {
    $wordPattern =
        '(?m)^\s*<Tabs\.Screen\s+name="word"\s+options=\{\{.*?\}\}\s*/>\s*$'

    $wordRx = [regex]::new($wordPattern)
    $wordMatch = $wordRx.Match($layoutText)

    if (-not $wordMatch.Success) {
        Stop-Patch "Exact Word tab line not found"
    }

    $newTabs = @'
  {/* PATCH_154B_MESSAGES_PRIMARY_TAB */}
  <Tabs.Screen
    name="word"
    options={{ href: null }}
  />
  <Tabs.Screen
    name="messages"
    options={{
      title: 'Messages',
      tabBarIcon: ({ color }) => (
        <MaterialCommunityIcons
          name="message-text-outline"
          size={23}
          color={color}
        />
      ),
    }}
  />
'@

    $layoutText =
        $layoutText.Substring(0, $wordMatch.Index) +
        $newTabs +
        $layoutText.Substring($wordMatch.Index + $wordMatch.Length)
}

Write-Utf8 $layoutPath $layoutText

$messagesTab = @'
/*
 * PATCH_154B_MESSAGES_PRIMARY_TAB
 * Reuse the existing BUKLOD Connect conversation list
 * as a primary bottom-tab screen.
 */
export { default } from '../connect/index';
'@

Write-Utf8 $messagesTabPath $messagesTab
Write-Host "Updated bottom navigation: Messages replaces visible Word tab." -ForegroundColor Green

# ============================================================
# 3. HOME
#    - Header left becomes WORD
#    - Right remains Points
#    - Remove REMINDERS visually
#    - Show ALL active Mission Bulletins
# ============================================================

$homeText = Read-Utf8 $homePath

# Ensure useEffect is available for HomeMissionBulletins.
$reactImport = [regex]::Match(
    $homeText,
    "import\s*\{(?<names>[^}]*)\}\s*from\s*'react';"
)

if ($reactImport.Success) {
    $reactNames = $reactImport.Groups['names'].Value

    if ($reactNames -notmatch '\buseEffect\b') {
        $newNames =
            ($reactNames.Trim().TrimEnd(',') + ', useEffect')

        $newImport =
            "import { $newNames } from 'react';"

        $homeText =
            $homeText.Substring(0, $reactImport.Index) +
            $newImport +
            $homeText.Substring($reactImport.Index + $reactImport.Length)
    }
}

$markerIndex = $homeText.IndexOf("PATCH_154A_HOME_ACTIONS")

if ($markerIndex -lt 0) {
    Stop-Patch "Home 154A marker vanished"
}

$headerPressableStart =
    $homeText.IndexOf("<Pressable", $markerIndex)

$headerPressableEnd =
    $homeText.IndexOf("</Pressable>", $headerPressableStart)

if (
    $headerPressableStart -lt 0 -or
    $headerPressableEnd -lt 0
) {
    Stop-Patch "Home left header Pressable not found"
}

$headerPressableEnd += "</Pressable>".Length

$headerBlock =
    $homeText.Substring(
        $headerPressableStart,
        $headerPressableEnd -
        $headerPressableStart
    )

$headerBlock = $headerBlock.Replace(
    'accessibilityLabel="Personal Messages"',
    'accessibilityLabel="Word and Bible"'
)

$headerBlock = [regex]::Replace(
    $headerBlock,
    "router\.push\(\s*'/connect'\s+as\s+any\s*\)",
    "router.push('/word')"
)

$headerBlock = $headerBlock.Replace(
    'name="message-text-outline"',
    'name="book-open-page-variant-outline"'
)

$homeText =
    $homeText.Substring(0, $headerPressableStart) +
    $headerBlock +
    $homeText.Substring($headerPressableEnd)

# Wrap the old single-bulletin Card in false so its old state/query
# remains referenced, while the new multiple bulletin component is visible.
if ($homeText -notmatch 'PATCH_154B_MULTI_BULLETINS') {
    $missionPattern =
        '(?s)(<SectionTitle>\s*MISSION BULLETIN\s*</SectionTitle>\s*)(<Card>.*?</Card>)(\s*<PilotLaunchCard\s*/>)'

    $missionRx = [regex]::new($missionPattern)
    $missionMatch = $missionRx.Match($homeText)

    if (-not $missionMatch.Success) {
        Stop-Patch "Mission Bulletin card block not found"
    }

    $missionReplacement =
        $missionMatch.Groups[1].Value +
        "      {/* PATCH_154B_MULTI_BULLETINS */}`r`n" +
        "      <HomeMissionBulletins />`r`n" +
        "      {false && (`r`n" +
        $missionMatch.Groups[2].Value +
        "`r`n      )}" +
        $missionMatch.Groups[3].Value

    $homeText =
        $homeText.Substring(0, $missionMatch.Index) +
        $missionReplacement +
        $homeText.Substring($missionMatch.Index + $missionMatch.Length)
}

# Remove REMINDERS from visible Home, but retain a false reference to
# HomeDailyBibleReminder so existing helper code remains compile-safe.
$remindersPattern =
    '(?s)<SectionTitle>\s*REMINDERS\s*</SectionTitle>\s*<Card>.*?</Card>\s*(?=<SectionTitle>\s*CHURCH LIFE\s*</SectionTitle>)'

$remindersRx = [regex]::new($remindersPattern)
$remindersMatch = $remindersRx.Match($homeText)

if ($remindersMatch.Success) {
    $remindersReplacement = @'
      {/* PATCH_154B_REMINDERS_REMOVED */}
      {false && <HomeDailyBibleReminder />}

'@

    $homeText =
        $homeText.Substring(0, $remindersMatch.Index) +
        $remindersReplacement +
        $homeText.Substring(
            $remindersMatch.Index +
            $remindersMatch.Length
        )
}
elseif ($homeText -notmatch 'PATCH_154B_REMINDERS_REMOVED') {
    Stop-Patch "REMINDERS block could not be removed"
}

if ($homeText -notmatch 'function HomeMissionBulletins\(') {
    $componentAnchor =
        '/* ============================================================' +
        "`r`n" +
        '   PATCH 153H-5A'

    $anchorIndex = $homeText.IndexOf($componentAnchor)

    if ($anchorIndex -lt 0) {
        # Tolerate LF-only source.
        $componentAnchor =
            '/* ============================================================' +
            "`n" +
            '   PATCH 153H-5A'

        $anchorIndex = $homeText.IndexOf($componentAnchor)
    }

    if ($anchorIndex -lt 0) {
        Stop-Patch "Home Daily Bible helper anchor not found"
    }

    $bulletinComponent = @'
/* ============================================================
   PATCH 154B
   MULTIPLE ACTIVE MISSION BULLETINS
============================================================ */

function HomeMissionBulletins() {
  const { profile } = useAuth();

  const [items, setItems] =
    useState<MissionBulletin[]>([]);
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      const now =
        new Date().toISOString();

      let query =
        supabase
          .from('mission_bulletins')
          .select(
            'id,church_id,title,body,priority,is_pinned,starts_at,expires_at,created_at,church:church_id(name)'
          )
          .eq('is_published', true)
          .lte('starts_at', now)
          .or(
            `expires_at.is.null,expires_at.gt.${now}`
          )
          .order('is_pinned', {
            ascending: false,
          })
          .order('priority', {
            ascending: false,
          })
          .order('created_at', {
            ascending: false,
          });

      if (profile?.church_id) {
        query = query.or(
          `church_id.is.null,church_id.eq.${profile.church_id}`
        );
      } else {
        query = query.is(
          'church_id',
          null
        );
      }

      const {
        data,
        error,
      } = await query;

      if (!active) {
        return;
      }

      if (error) {
        console.warn(
          'Could not load Mission Bulletins:',
          error.message
        );
        setItems([]);
        setLoading(false);
        return;
      }

      setItems(
        (data ?? []) as MissionBulletin[]
      );
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [profile?.church_id]);

  if (loading) {
    return (
      <Card>
        <ActivityIndicator
          color={colors.green}
        />
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card>
        <Text style={shared.muted}>
          No active Mission Bulletin.
        </Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => {
        const churchName =
          Array.isArray(item.church)
            ? item.church[0]?.name
            : item.church?.name;

        return (
          <Card key={item.id}>
            <View
              style={{
                borderLeftWidth: 5,
                borderLeftColor:
                  colors.green,
                paddingLeft: 12,
              }}
            >
              <Text
                style={{
                  color: colors.green,
                  fontWeight: '900',
                  fontSize: 11,
                  letterSpacing: 1,
                }}
              >
                {item.is_pinned
                  ? 'PINNED | '
                  : ''}
                {item.church_id
                  ? (
                      churchName ||
                      'LOCAL MISSION UPDATE'
                    ).toUpperCase()
                  : 'SYSTEM-WIDE MISSION UPDATE'}
              </Text>

              <Text
                style={[
                  shared.h1,
                  {
                    marginTop: 5,
                  },
                ]}
              >
                {item.title}
              </Text>

              <Text
                style={[
                  shared.body,
                  {
                    marginTop: 8,
                    lineHeight: 20,
                  },
                ]}
              >
                {item.body}
              </Text>

              <Text
                style={[
                  shared.muted,
                  {
                    marginTop: 9,
                    fontSize: 10,
                  },
                ]}
              >
                {new Date(
                  item.starts_at
                ).toLocaleString()}
              </Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}


'@

    $homeText =
        $homeText.Substring(0, $anchorIndex) +
        $bulletinComponent +
        $homeText.Substring($anchorIndex)
}

Write-Utf8 $homePath $homeText
Write-Host "Updated Home: Word shortcut, multiple bulletins, Reminders removed." -ForegroundColor Green

# ============================================================
# 4. MESSAGES
#    Reaction shortcut centered beside received message bubble.
#    Remove duplicate React action from bottom long-press drawer.
# ============================================================

$connectText = Read-Utf8 $connectPath

$reactCuePattern =
    '(?s)reactCue:\s*\{.*?\},\s*(?=reactionBadge:)'

$reactCueRx = [regex]::new($reactCuePattern)
$reactCueMatch = $reactCueRx.Match($connectText)

if (-not $reactCueMatch.Success) {
    Stop-Patch "reactCue style block not found"
}

$newReactCue = @'
reactCue: {
        position: 'absolute',
        right: -38,
        top: '50%',
        transform: [
          {
            translateY: -16,
          },
        ],
        width: 31,
        height: 31,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        zIndex: 5,
      },

'@

$connectText =
    $connectText.Substring(0, $reactCueMatch.Index) +
    $newReactCue +
    $connectText.Substring(
        $reactCueMatch.Index +
        $reactCueMatch.Length
    )

$drawerReactPattern =
    '(?s)\s*\{!selected\.is_mine\s*&&\s*\(\s*<Pressable\s+style=\{s\.action\}\s+onPress=\{\(\)\s*=>\s*openReaction\(\s*selected\s*\)\s*\}.*?<Text\s+style=\{\s*s\.actionText\s*\}>\s*React\s*</Text>\s*</Pressable>\s*\)\}'

$drawerReactRx = [regex]::new($drawerReactPattern)
$drawerReactMatch = $drawerReactRx.Match($connectText)

if ($drawerReactMatch.Success) {
    $connectText =
        $connectText.Substring(0, $drawerReactMatch.Index) +
        "`r`n                {/* PATCH_154B_REACTION_BESIDE_BUBBLE */}" +
        $connectText.Substring(
            $drawerReactMatch.Index +
            $drawerReactMatch.Length
        )
}
else {
    Write-Host "NOTE: Bottom-drawer React action did not match; side reaction cue was still repositioned." -ForegroundColor Yellow
}

Write-Utf8 $connectPath $connectText
Write-Host "Updated received-message reaction access beside the bubble." -ForegroundColor Green

# ============================================================
# 5. CLUSTER USER-FACING CLEANUP
#    Keep legacy group DB/RPC identifiers unchanged.
# ============================================================

if (Test-Path -LiteralPath $connectListPath) {
    $connectListText = Read-Utf8 $connectListPath

    $oldClusterMeta = @'
                          {member.group_name
                            ? ` | ${member.group_name}`
                            : ''}
'@

    $newClusterMeta = @'
                          {' | '}
                          {member.group_name
                            ? /^cluster\b/i.test(
                                member.group_name
                              )
                              ? member.group_name
                              : `Cluster ${member.group_name}`
                            : 'No Cluster'}
'@

    if ($connectListText.Contains($oldClusterMeta)) {
        $connectListText =
            $connectListText.Replace(
                $oldClusterMeta,
                $newClusterMeta
            )
    }

    Write-Utf8 $connectListPath $connectListText
}

$uiReplacements = @(
    @("Pastor group-management migration", "Pastor cluster-management migration"),
    @("secure Pastor group controls", "secure Pastor cluster controls"),
    @("Local Church and group name are required.", "Local Church and cluster name are required."),
    @("Could not create group", "Could not create cluster"),
    @("Group created successfully.", "Cluster created successfully."),
    @("CREATE GROUP", "CREATE CLUSTER"),
    @("Group and member-care leadership", "Cluster and member-care leadership"),
    @("BACK TO GROUPS", "BACK TO CLUSTERS"),
    @("Group Members", "Cluster Members"),
    @("Group Member", "Cluster Member"),
    @("Group Leader", "Cluster Leader"),
    @("No active Group", "No active Cluster"),
    @("No Group", "No Cluster"),
    @("BUKLOD Groups", "BUKLOD Clusters"),
    @("BUKLOD Group", "BUKLOD Cluster")
)

$uiPaths = @(
    $groupsPath,
    $groupDetailPath,
    $usersPath,
    $memberMasterPath,
    $localMembersPath,
    $mePath
)

foreach ($path in $uiPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        continue
    }

    $text = Read-Utf8 $path

    foreach ($pair in $uiReplacements) {
        $text = $text.Replace(
            $pair[0],
            $pair[1]
        )
    }

    Write-Utf8 $path $text
}

Write-Host "Updated remaining user-facing Cluster wording." -ForegroundColor Green

# ============================================================
# 6. VERIFY
# ============================================================

Write-Host ""
Write-Host "=== PATCH 154B SANITY CHECK ===" -ForegroundColor Cyan

Select-String `
    -LiteralPath $layoutPath `
    -Pattern `
      "PATCH_154B_MESSAGES_PRIMARY_TAB|name=`"messages`"|href: null" `
    -Context 0,3

Select-String `
    -LiteralPath $homePath `
    -Pattern `
      "PATCH_154B_MULTI_BULLETINS|PATCH_154B_REMINDERS_REMOVED|HomeMissionBulletins|book-open-page-variant-outline" `
    -Context 0,2

Select-String `
    -LiteralPath $loginPath `
    -Pattern `
      "PATCH_154B_REMEMBER_PASSWORD|expo-secure-store|Remember password" `
    -Context 0,2

Select-String `
    -LiteralPath $connectPath `
    -Pattern `
      "reactCue|PATCH_154B_REACTION_BESIDE_BUBBLE" `
    -Context 0,5

$visibleReminders =
    Select-String `
        -LiteralPath $homePath `
        -Pattern "<SectionTitle>\s*REMINDERS\s*</SectionTitle>"

if ($visibleReminders) {
    Stop-Patch "Visible REMINDERS section still exists"
}

# ============================================================
# 7. TYPESCRIPT
# ============================================================

Write-Host ""
Write-Host "=== TYPESCRIPT CHECK ===" -ForegroundColor Cyan

$tsc = ".\node_modules\.bin\tsc.cmd"

if (-not (Test-Path -LiteralPath $tsc)) {
    Stop-Patch "local TypeScript compiler not found: $tsc"
}

& $tsc --noEmit

if ($LASTEXITCODE -ne 0) {
    throw "PATCH 154B changes were written, but TypeScript reported errors. DO NOT build yet. Send the TypeScript error output."
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "PATCH 154B COMPLETE - TYPESCRIPT PASS" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "NO SUPABASE DB PUSH IS REQUIRED FOR PATCH 154B." -ForegroundColor Yellow
Write-Host "Because expo-secure-store is a native package, rebuild the dev client/APK before final device testing if your current client does not already include it." -ForegroundColor Yellow
