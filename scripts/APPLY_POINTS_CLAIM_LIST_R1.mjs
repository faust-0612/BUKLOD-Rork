import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_BRANCH = 'fix/points-claim-list-r1-20260912';
const TARGET = path.join('src', 'app', 'points', 'index.tsx');

function fail(message) {
  throw new Error(message);
}

function capture(command, args = [], shell = false) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell,
  });
  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed.`);
  }
  return String(result.stdout ?? '').trim();
}

function run(command, args = [], shell = false) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell,
  });
  if (result.error) {
    fail(`${command} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${command} exited with code ${result.status}.`);
  }
}

function replaceOnce(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) fail(`${label}: expected source block not found.`);
  if (text.indexOf(before, first + before.length) >= 0) {
    fail(`${label}: expected source block is not unique.`);
  }
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function insertBeforeOnce(text, marker, addition, label, startAt = 0) {
  const first = text.indexOf(marker, startAt);
  if (first < 0) fail(`${label}: insertion marker not found.`);
  if (text.indexOf(marker, first + marker.length) >= 0) {
    fail(`${label}: insertion marker is not unique after the expected start.`);
  }
  return text.slice(0, first) + addition + text.slice(first);
}

function patch(source) {
  let text = source;

  text = replaceOnce(
    text,
    `import BuklodClaimRewardCard, {\n  type ClaimRewardItem,\n} from '@/components/points/BuklodClaimRewardCard';\n`,
    '',
    'remove legacy single reward-card import',
  );

  text = replaceOnce(
    text,
    `import {\n  claimBuklodRewardEvent,\n  loadBuklodPointsDashboard,\n  loadPendingBuklodRewardEvent,\n  type BuklodPointsDashboard,\n  type BuklodRewardEvent,\n} from '@/lib/buklodRewards';`,
    `import {\n  claimBuklodRewardGroup,\n  loadBuklodClaimGroups,\n  loadBuklodPointsDashboard,\n  type BuklodClaimGroup,\n  type BuklodPointsDashboard,\n} from '@/lib/buklodRewards';`,
    'switch points screen to grouped claim API',
  );

  text = replaceOnce(
    text,
    `type PointRow = {\n  id: string;\n  direction: 'credit' | 'debit';\n  points: number;`,
    `type PointRow = {\n  id: string;\n  direction: 'credit' | 'debit';\n  claim_state: 'pending' | 'claimed' | 'legacy' | string;\n  points: number;`,
    'add ledger claim state to PointRow',
  );

  const activityStart = text.indexOf('function activityLabel(type: string) {');
  if (activityStart < 0) fail('activityLabel helper not found.');
  const statMarker = '\nfunction StatCard({';
  const statPos = text.indexOf(statMarker, activityStart);
  if (statPos < 0) fail('StatCard boundary after activityLabel not found.');

  const groupHelper = `\nfunction claimGroupKeyForActivity(type: string) {\n  if ([\n    'community_post',\n    'r36_publish_wall',\n  ].includes(type)) {\n    return 'posting';\n  }\n\n  if ([\n    'community_comment',\n    'community_reaction',\n    'prayer_response',\n    'r36_engager_comment',\n    'r36_engager_reaction',\n    'r36_engager_reply',\n  ].includes(type)) {\n    return 'engagement';\n  }\n\n  if ([\n    'daily_bible',\n    'daily_bible_verification',\n  ].includes(type)) {\n    return 'daily_bible';\n  }\n\n  if (type === 'devotional') {\n    return 'devotional';\n  }\n\n  if ([\n    'abc_growth_lesson',\n    'formation_lesson',\n    'learning_progress_verification',\n    'stage_completion',\n  ].includes(type)) {\n    return 'formation';\n  }\n\n  if ([\n    'mentor_session',\n    'mentoring_release',\n  ].includes(type)) {\n    return 'mentoring';\n  }\n\n  if ([\n    'event_attendance',\n    'scope_attendance',\n    'ministry_activity',\n  ].includes(type)) {\n    return 'attendance';\n  }\n\n  if ([\n    'reflection_quality_bonus',\n    'weekly_consistency',\n    'verified_giving_participation',\n    'admin_bonus',\n  ].includes(type)) {\n    return 'bonus';\n  }\n\n  return 'other';\n}\n`;

  text = text.slice(0, statPos) + groupHelper + text.slice(statPos);

  text = replaceOnce(
    text,
    `  const [rewardEvent, setRewardEvent] =\n    useState<BuklodRewardEvent | null>(null);\n\n  const [claimBusy, setClaimBusy] =\n    useState(false);\n\n  const [claimCardStatus, setClaimCardStatus] =\n    useState<\n      'claimable' | 'claiming' | 'claimed' | 'failed'\n    >('claimable');`,
    `  const [claimGroups, setClaimGroups] =\n    useState<BuklodClaimGroup[]>([]);\n\n  const [claimingGroup, setClaimingGroup] =\n    useState<string | null>(null);\n\n  const [claimError, setClaimError] =\n    useState<string | null>(null);\n\n  const [expandedClaimGroups, setExpandedClaimGroups] =\n    useState<Record<string, boolean>>({});`,
    'replace legacy single-claim state',
  );

  text = replaceOnce(
    text,
    `'id,direction,points,activity_type,source_key,source_id,description,created_at'`,
    `'id,direction,claim_state,points,activity_type,source_key,source_id,description,created_at'`,
    'load ledger claim_state',
  );

  const dashboardCatch = `    } catch (dashboardError: unknown) {\n      Alert.alert(\n        'BUKLOD Points',\n        dashboardError instanceof Error\n          ? dashboardError.message\n          : 'Could not load BUKLOD Points.',\n      );\n    }\n`;

  const groupLoad = `${dashboardCatch}\n    try {\n      const groups = await loadBuklodClaimGroups();\n      setClaimGroups(groups);\n      setClaimError(null);\n    } catch (claimGroupsError: unknown) {\n      const message =\n        claimGroupsError instanceof Error\n          ? claimGroupsError.message\n          : 'Could not load claimable activities.';\n      console.warn('BUKLOD claim groups:', message);\n      setClaimGroups([]);\n      setClaimError(message);\n    }\n`;

  text = replaceOnce(
    text,
    dashboardCatch,
    groupLoad,
    'load grouped claim summaries with points dashboard',
  );

  const legacyStart = text.indexOf(`  useEffect(() => {\n    if (rewardEvent) {`);
  if (legacyStart < 0) fail('legacy pending reward effect start not found.');
  const celebrationMarker = `  const onCelebrationComplete = () => {`;
  const celebrationPos = text.indexOf(celebrationMarker, legacyStart);
  if (celebrationPos < 0) fail('celebration callback boundary not found.');

  const groupedClaimHandler = `  const claimGroup = async (group: BuklodClaimGroup) => {\n    if (claimingGroup) {\n      return;\n    }\n\n    setClaimingGroup(group.group_key);\n    setClaimError(null);\n\n    try {\n      const result = await claimBuklodRewardGroup(group.group_key);\n\n      if (result.claimed_count <= 0 || result.claimed_points <= 0) {\n        setClaimError(\n          'Wala nang pending points sa activity group na ito. Ni-refresh ang listahan.',\n        );\n        await load();\n        return;\n      }\n\n      setConfirmedBalance(result.lifetime_points);\n      setConfirmedAvailableBalance(result.available_points);\n      setDashboard((current) =>\n        current\n          ? {\n              ...current,\n              total_points: result.lifetime_points,\n              lifetime_points: result.lifetime_points,\n              available_points: result.available_points,\n              pending_claimable_points: Math.max(\n                0,\n                current.pending_claimable_points - result.claimed_points,\n              ),\n            }\n          : current,\n      );\n\n      setClaimGroups((current) =>\n        current.filter((item) => item.group_key !== group.group_key),\n      );\n      setExpandedClaimGroups((current) => ({\n        ...current,\n        [group.group_key]: false,\n      }));\n\n      if (result.rank_up) {\n        characterEvents?.emit({\n          type: CharacterEventType.MILESTONE_REACHED,\n          success: true,\n          spokenText: result.rank_name\n            ? \`Rank up! You are now \${result.rank_name}.\`\n            : undefined,\n        });\n      }\n\n      characterEvents?.emit({\n        type: CharacterEventType.POINTS_CLAIMED,\n        success: true,\n        points: result.claimed_points,\n        spokenText:\n          \`\${group.group_label}: \${result.claimed_points.toLocaleString('en-PH')} points claimed.\`,\n        dialogue:\n          \`\${group.group_label} — +\${result.claimed_points.toLocaleString('en-PH')} pts\`,\n      });\n\n      setCelebrationPoints(result.claimed_points);\n      setCelebrationActive(true);\n      setHudPop(true);\n\n      await load();\n    } catch (error: unknown) {\n      const message =\n        error instanceof Error\n          ? error.message\n          : 'Claim failed. No points were awarded.';\n      console.warn('BUKLOD grouped claim:', message);\n      setClaimError(message);\n    } finally {\n      setClaimingGroup(null);\n    }\n  };\n\n`;

  text = text.slice(0, legacyStart) + groupedClaimHandler + text.slice(celebrationPos);

  text = replaceOnce(
    text,
    `  const onCelebrationComplete = () => {\n    setCelebrationActive(false);\n    setCelebrationPoints(null);\n    setHudPop(false);\n    setRewardEvent(null);\n    setClaimCardStatus('claimable');\n  };`,
    `  const onCelebrationComplete = () => {\n    setCelebrationActive(false);\n    setCelebrationPoints(null);\n    setHudPop(false);\n  };`,
    'remove legacy reward reset from celebration',
  );

  const oldPendingModel = `  const claimableCount = rewardEvent ? 1 : 0;\n\n  const pendingClaim: ClaimRewardItem | null =\n    rewardEvent\n      ? {\n          id: rewardEvent.id,\n          title: rewardEvent.title,\n          message: rewardEvent.message,\n          points: rewardEvent.points,\n          eventType: rewardEvent.event_type,\n          status: claimCardStatus,\n        }\n      : null;`;

  const newPendingModel = `  const pendingClaimRows = useMemo(\n    () =>\n      history.filter(\n        (item) =>\n          item.direction === 'credit' &&\n          item.claim_state === 'pending',\n      ),\n    [history],\n  );\n\n  const claimableCount = claimGroups.reduce(\n    (sum, group) => sum + group.event_count,\n    0,\n  );`;

  text = replaceOnce(
    text,
    oldPendingModel,
    newPendingModel,
    'replace synthetic pending reward model',
  );

  const claimUiStart = text.indexOf(`          {pendingClaim && (`);
  if (claimUiStart < 0) fail('legacy claim UI start not found.');
  const redeemMarker = `\n\n          <View style={styles.sectionPad}>\n            <BuklodRedeemCatalogSection`;
  const redeemPos = text.indexOf(redeemMarker, claimUiStart);
  if (redeemPos < 0) fail('redeem section boundary after claim UI not found.');

  const groupedClaimUi = `          {(claimGroups.length > 0 || claimError) && (\n            <View style={styles.sectionPad}>\n              <Text style={styles.sectionEyebrow}>\n                CLAIMABLE REWARDS\n              </Text>\n              <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>\n                Ready to Claim\n              </Text>\n              <Text\n                style={{\n                  marginBottom: 10,\n                  fontSize: 11,\n                  lineHeight: 16,\n                  color: theme.textMuted,\n                }}\n              >\n                Each list shows the completed activities that created your pending points. Claim All applies only to that activity group.\n              </Text>\n\n              {claimGroups.map((group, index) => {\n                const groupItems = pendingClaimRows.filter(\n                  (item) =>\n                    claimGroupKeyForActivity(item.activity_type) ===\n                    group.group_key,\n                );\n                const expanded = Boolean(\n                  expandedClaimGroups[group.group_key],\n                );\n                const visibleItems = expanded\n                  ? groupItems\n                  : groupItems.slice(0, 5);\n                const notLoadedCount = Math.max(\n                  0,\n                  group.event_count - groupItems.length,\n                );\n                const busy = claimingGroup === group.group_key;\n                const anyBusy = claimingGroup !== null;\n\n                return (\n                  <PointsFocusCard\n                    key={group.group_key}\n                    index={index}\n                  >\n                    <View\n                      style={[\n                        styles.historyCard,\n                        { padding: 14, marginBottom: 10 },\n                      ]}\n                    >\n                      <View style={styles.rowBetween}>\n                        <View style={{ flex: 1, paddingRight: 8 }}>\n                          <Text style={styles.historyTitle}>\n                            {group.group_label}\n                          </Text>\n                          <Text style={styles.meta}>\n                            {group.event_count.toLocaleString('en-PH')}{' '}\n                            {group.event_count === 1\n                              ? 'completed activity'\n                              : 'completed activities'}\n                          </Text>\n                        </View>\n                        <Text style={[styles.pointsAmount, styles.pointsCredit]}>\n                          +{group.total_points.toLocaleString('en-PH')} pts\n                        </Text>\n                      </View>\n\n                      <View\n                        style={{\n                          marginTop: 10,\n                          borderTopWidth: StyleSheet.hairlineWidth,\n                          borderTopColor: theme.border,\n                        }}\n                      >\n                        {visibleItems.length === 0 ? (\n                          <Text\n                            style={{\n                              paddingVertical: 10,\n                              fontSize: 10.5,\n                              lineHeight: 16,\n                              color: theme.textMuted,\n                            }}\n                          >\n                            Pending activity details are being reconciled. The group total above remains authoritative.\n                          </Text>\n                        ) : (\n                          visibleItems.map((item) => (\n                            <View\n                              key={item.id}\n                              style={{\n                                flexDirection: 'row',\n                                alignItems: 'flex-start',\n                                gap: 8,\n                                paddingVertical: 9,\n                                borderBottomWidth: StyleSheet.hairlineWidth,\n                                borderBottomColor: theme.border,\n                              }}\n                            >\n                              <View style={{ flex: 1 }}>\n                                <Text\n                                  style={{\n                                    fontSize: 11,\n                                    fontWeight: '900',\n                                    color: theme.textPrimary,\n                                  }}\n                                >\n                                  {activityLabel(item.activity_type)}\n                                </Text>\n                                {!!item.description && (\n                                  <Text\n                                    numberOfLines={2}\n                                    style={{\n                                      marginTop: 2,\n                                      fontSize: 10,\n                                      lineHeight: 14,\n                                      color: theme.textMuted,\n                                    }}\n                                  >\n                                    {item.description}\n                                  </Text>\n                                )}\n                                <Text style={[styles.meta, { marginTop: 2 }]}>\n                                  {dateLabel(item.created_at)}\n                                </Text>\n                              </View>\n                              <Text\n                                style={{\n                                  fontSize: 11,\n                                  fontWeight: '900',\n                                  color: theme.accent,\n                                }}\n                              >\n                                +{Number(item.points).toLocaleString('en-PH')} pts\n                              </Text>\n                            </View>\n                          ))\n                        )}\n                      </View>\n\n                      {groupItems.length > 5 ? (\n                        <Pressable\n                          accessibilityRole=\"button\"\n                          onPress={() =>\n                            setExpandedClaimGroups((current) => ({\n                              ...current,\n                              [group.group_key]: !expanded,\n                            }))\n                          }\n                          style={{\n                            alignSelf: 'flex-start',\n                            paddingVertical: 8,\n                          }}\n                        >\n                          <Text\n                            style={{\n                              fontSize: 9.5,\n                              fontWeight: '900',\n                              color: theme.accent,\n                            }}\n                          >\n                            {expanded\n                              ? 'SHOW LESS'\n                              : \`SHOW ALL \${groupItems.length.toLocaleString('en-PH')} ACTIVITIES\`}\n                          </Text>\n                        </Pressable>\n                      ) : null}\n\n                      {notLoadedCount > 0 ? (\n                        <Text\n                          style={{\n                            marginBottom: 8,\n                            fontSize: 9.5,\n                            lineHeight: 14,\n                            color: theme.textMuted,\n                          }}\n                        >\n                          +{notLoadedCount.toLocaleString('en-PH')} more pending activities are included in this Claim All.\n                        </Text>\n                      ) : null}\n\n                      <Pressable\n                        accessibilityRole=\"button\"\n                        accessibilityLabel={\`Claim all \${group.group_label} points\`}\n                        disabled={anyBusy}\n                        onPress={() => void claimGroup(group)}\n                        style={({ pressed }) => ({\n                          minHeight: 44,\n                          marginTop: 4,\n                          borderRadius: 13,\n                          alignItems: 'center',\n                          justifyContent: 'center',\n                          backgroundColor: theme.buttonPrimary,\n                          opacity: anyBusy && !busy ? 0.55 : pressed ? 0.86 : 1,\n                        })}\n                      >\n                        <Text\n                          style={{\n                            fontSize: 10,\n                            fontWeight: '900',\n                            letterSpacing: 0.45,\n                            color: theme.white,\n                          }}\n                        >\n                          {busy\n                            ? 'CLAIMING...'\n                            : \`CLAIM ALL · +\${group.total_points.toLocaleString('en-PH')} PTS\`}\n                        </Text>\n                      </Pressable>\n                    </View>\n                  </PointsFocusCard>\n                );\n              })}\n\n              {claimError ? (\n                <Text\n                  style={{\n                    marginTop: 2,\n                    fontSize: 10,\n                    lineHeight: 15,\n                    color: theme.danger,\n                  }}\n                >\n                  {claimError}\n                </Text>\n              ) : null}\n            </View>\n          )}`;

  text = text.slice(0, claimUiStart) + groupedClaimUi + text.slice(redeemPos);

  for (const forbidden of [
    'BuklodClaimRewardCard',
    'ClaimRewardItem',
    'claimBuklodRewardEvent',
    'loadPendingBuklodRewardEvent',
    'BuklodRewardEvent',
    'claimCardStatus',
    'rewardEvent',
    'claimBusy',
    'pendingClaim &&',
  ]) {
    if (text.includes(forbidden)) {
      fail(`Legacy claim token remains: ${forbidden}`);
    }
  }

  for (const required of [
    'claimBuklodRewardGroup',
    'loadBuklodClaimGroups',
    'claim_state',
    'claimGroupKeyForActivity',
    'SHOW ALL ${groupItems.length.toLocaleString',
    'CLAIM ALL · +${group.total_points.toLocaleString',
    'Each list shows the completed activities',
  ]) {
    if (!text.includes(required)) {
      fail(`Required grouped-claim behavior missing: ${required}`);
    }
  }

  return text;
}

let original = null;
let wrote = false;
let committed = false;

try {
  const root = process.cwd();
  if (!fs.existsSync(path.join(root, 'package.json'))) {
    fail('Run this script from the BUKLOD-MAIN repository root.');
  }

  const branch = capture('git', ['branch', '--show-current']);
  if (branch !== EXPECTED_BRANCH) {
    fail(`Expected branch ${EXPECTED_BRANCH}, found ${branch || '(detached)'}.`);
  }

  const status = capture('git', ['status', '--porcelain']);
  if (status) {
    fail('Working tree is not clean. No Points edit was attempted.');
  }

  const targetPath = path.join(root, TARGET);
  if (!fs.existsSync(targetPath)) {
    fail(`Points screen missing: ${TARGET}`);
  }

  original = fs.readFileSync(targetPath, 'utf8');
  const patched = patch(original);
  if (patched === original) {
    fail('Points claim-list patch produced no change.');
  }

  fs.writeFileSync(targetPath, patched, 'utf8');
  wrote = true;

  const changed = capture('git', ['diff', '--name-only'])
    .split(/\r?\n/)
    .map((value) => value.trim().replaceAll('\\', '/'))
    .filter(Boolean);

  if (changed.length !== 1 || changed[0] !== 'src/app/points/index.tsx') {
    fail(`Unexpected runtime files changed: ${changed.join(', ') || '(none)'}`);
  }

  run('git', ['diff', '--check']);
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit'], process.platform === 'win32');
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'character:contract'], process.platform === 'win32');
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'game:contract'], process.platform === 'win32');

  run('git', ['add', '--', TARGET]);
  run('git', ['commit', '-m', 'fix(points): show claimable activity lists by group']);
  committed = true;
  run('git', ['push', '-u', 'origin', EXPECTED_BRANCH]);

  console.log('\nPASS: Points claim list R1 committed and pushed.');
  console.log('- Only src/app/points/index.tsx changed.');
  console.log('- No backend migration.');
  console.log('- No native files/config/dependencies.');
  console.log('- No OTA performed.');
} catch (error) {
  console.error(`\nFAIL: ${error?.message ?? error}`);

  if (wrote && !committed && original != null) {
    try {
      fs.writeFileSync(TARGET, original, 'utf8');
      spawnSync('git', ['restore', '--staged', '--', TARGET], {
        stdio: 'ignore',
        shell: false,
      });
      console.error('ROLLBACK: restored Points screen and staging index.');
    } catch (restoreError) {
      console.error(`ROLLBACK WARNING: ${restoreError?.message ?? restoreError}`);
    }
  }

  process.exit(1);
}
