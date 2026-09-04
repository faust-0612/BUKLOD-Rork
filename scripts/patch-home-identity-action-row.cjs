const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', '(tabs)', 'home.tsx');
let source = fs.readFileSync(file, 'utf8');

const marker = 'HOME_IDENTITY_ACTION_ROW_R2';
if (source.includes(marker)) {
  console.log(`${marker}: already applied`);
  process.exit(0);
}

/*
 * BUKLOD_HOME_IDENTITY_R23_COMPAT_R1
 *
 * R23 is a newer Home identity layout than the historical R2 patch below.
 * Do not replace/downgrade it. If the newer card still contains the three
 * required actions (Rewards, Word shortcut, My Cluster), add only the legacy
 * compatibility marker so older CI safety checks can recognize the feature.
 */
const newerMarker = 'BUKLOD_HOME_IDENTITY_R23_CLEAN_TWO_ROW';
if (source.includes(newerMarker)) {
  const hasRewards =
    source.includes('REWARDS') &&
    source.includes("router.push('/points')");
  const hasWord = source.includes('<BuklodPublicWordShortcut />');
  const hasMyCluster =
    source.includes('MY CLUSTER') &&
    source.includes("router.push('/clusters' as any)");

  if (!hasRewards || !hasWord || !hasMyCluster) {
    throw new Error(
      'Newer Home identity layout exists but required Rewards/Word/My Cluster actions are incomplete.'
    );
  }

  source = source.replace(
    `/* ${newerMarker} */`,
    `/* ${newerMarker} */\n      {/* ${marker} — compatibility marker; R23 remains authoritative */}`
  );
  fs.writeFileSync(file, source, 'utf8');

  const final = fs.readFileSync(file, 'utf8');
  if (!final.includes(marker)) {
    throw new Error('Home identity compatibility marker was not written.');
  }

  console.log(`${marker}: satisfied by newer R23 layout`);
  process.exit(0);
}

const startNeedle = '      <HomeMotionSection delay={0}>';
const endNeedle = '      </HomeMotionSection>';
const start = source.indexOf(startNeedle);

if (start < 0) {
  throw new Error('Home identity card start anchor not found.');
}

const endStart = source.indexOf(endNeedle, start);
if (endStart < 0) {
  throw new Error('Home identity card end anchor not found.');
}

const end = endStart + endNeedle.length;
const current = source.slice(start, end);

if (
  !current.includes('accessibilityLabel="BUKLOD Rewards"') ||
  !current.includes('PATCH_191F_PUBLIC_HOME_MY_CLUSTER') ||
  !current.includes('<BuklodPublicWordShortcut />')
) {
  throw new Error('Home identity card safety anchors changed; refusing blind replacement.');
}

const replacement = `      <HomeMotionSection delay={0}>
        {/* HOME_IDENTITY_ACTION_ROW_R2 */}
        <View
          style={{
            marginHorizontal: 12,
            marginTop: 8,
            marginBottom: 4,
            paddingHorizontal: 14,
            paddingVertical: 13,
            borderRadius: 18,
            backgroundColor: theme.cardSurface,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
          }}
        >
          <View style={{ minWidth: 0 }}>
            <Text style={[shared.muted, { fontSize: 12 }]}>
              Good day,
            </Text>

            <Text
              numberOfLines={2}
              style={[
                shared.h1,
                {
                  marginTop: 1,
                  fontSize: 20,
                  lineHeight: 24,
                },
              ]}
            >
              {resolvePersonDisplayName(
                profile,
                profile?.id,
              )}
            </Text>

            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 7,
                paddingHorizontal: 10,
                paddingVertical: 4,
                minHeight: 27,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.accent,
                backgroundColor: theme.accentSoft,
                justifyContent: 'center',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11.5,
                  fontWeight: '900',
                  color: theme.accent,
                }}
              >
                {circleRank}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'stretch',
              gap: 6,
              marginTop: 11,
            }}
          >
            <HomePressable
              accessibilityLabel="BUKLOD Rewards"
              onPress={() => router.push('/points')}
              wrapStyle={{ flex: 1, minWidth: 0 }}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                minHeight: 58,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.accentSoft,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="trophy-outline"
                size={20}
                color={theme.accent}
              />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  marginTop: 3,
                  fontSize: 8.2,
                  lineHeight: 10,
                  fontWeight: '900',
                  color: theme.accent,
                }}
              >
                REWARDS
              </Text>
            </HomePressable>

            <BuklodPublicWordShortcut />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open My Cluster"
              onPress={() => router.push('/clusters' as any)}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                minHeight: 58,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(39,93,69,0.14)',
                backgroundColor: '#EEF8F1',
                paddingHorizontal: 5,
                paddingVertical: 7,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: pressed ? 0.76 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="home-group"
                size={20}
                color="#168347"
              />
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={{
                  marginTop: 3,
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 8.2,
                  lineHeight: 10,
                  fontWeight: '900',
                  color: '#168347',
                }}
              >
                MY CLUSTER
              </Text>
            </Pressable>
          </View>
        </View>
      </HomeMotionSection>`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source, 'utf8');

const final = fs.readFileSync(file, 'utf8');
if (!final.includes(marker)) {
  throw new Error('Home identity action row marker missing after patch.');
}
if (
  !final.includes('accessibilityLabel="BUKLOD Rewards"') ||
  !final.includes('<BuklodPublicWordShortcut />') ||
  !final.includes('MY CLUSTER')
) {
  throw new Error('Home identity action row anchors missing after patch.');
}

console.log(`${marker}: applied`);
