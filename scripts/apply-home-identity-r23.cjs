const fs = require('fs');
const path = require('path');

const root = process.cwd();
const homePath = path.join(root, 'src', 'app', '(tabs)', 'home.tsx');
const shortcutPath = path.join(root, 'src', 'components', 'BuklodPublicWordShortcut.tsx');

function fail(message) {
  console.error(`BUKLOD HOME R23 STOPPED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(homePath)) fail(`Missing ${homePath}`);
if (!fs.existsSync(shortcutPath)) fail(`Missing ${shortcutPath}`);

let home = fs.readFileSync(homePath, 'utf8');

const oldBlock = /(\s*<EnvironmentBadge\s*\/>\s*)<HomeMotionSection delay=\{0\}>[\s\S]*?<\/HomeMotionSection>\s*(?=<HomeMotionSection delay=\{20\}>)/;
const matches = home.match(oldBlock);
if (!matches) fail('Could not locate the existing Home identity block.');

const identityBlock = `${matches[1]}{/* BUKLOD_HOME_IDENTITY_R23_CLEAN_TWO_ROW */}
      <HomeMotionSection delay={0}>
        <View
          style={{
            marginHorizontal: 12,
            marginTop: 8,
            marginBottom: 4,
            paddingHorizontal: 16,
            paddingTop: 15,
            paddingBottom: 13,
            borderRadius: 22,
            backgroundColor: theme.cardSurface,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
          }}
        >
          <View style={{ width: '100%', minWidth: 0 }}>
            <Text
              allowFontScaling={false}
              style={[
                shared.muted,
                {
                  fontSize: 13,
                  lineHeight: 17,
                },
              ]}
            >
              Good day,
            </Text>

            <Text
              allowFontScaling={false}
              numberOfLines={2}
              ellipsizeMode="tail"
              style={[
                shared.h1,
                {
                  marginTop: 2,
                  width: '100%',
                  fontSize: 27,
                  lineHeight: 31,
                  fontWeight: '900',
                  flexShrink: 1,
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
                maxWidth: '100%',
                marginTop: 8,
                paddingHorizontal: 12,
                paddingVertical: 5,
                minHeight: 28,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.accent,
                backgroundColor: theme.accentSoft,
                justifyContent: 'center',
              }}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  maxWidth: '100%',
                  fontSize: 11,
                  lineHeight: 14,
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
              gap: 7,
              marginTop: 13,
              width: '100%',
            }}
          >
            <HomePressable
              accessibilityLabel="BUKLOD Rewards"
              onPress={() => router.push('/points')}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                minHeight: 70,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
                paddingVertical: 8,
                backgroundColor: theme.accentSoft,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="trophy-outline"
                size={22}
                color={theme.accent}
              />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  marginTop: 4,
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 8.6,
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
                minHeight: 70,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.accentSoft,
                paddingHorizontal: 4,
                paddingVertical: 8,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="home-outline"
                size={22}
                color={theme.accent}
              />
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={{
                  marginTop: 4,
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 8.2,
                  lineHeight: 10,
                  fontWeight: '900',
                  color: theme.accent,
                }}
              >
                MY CLUSTER
              </Text>
            </Pressable>
          </View>
        </View>
      </HomeMotionSection>

      `;

home = home.replace(oldBlock, identityBlock);

if (!home.includes('BUKLOD_HOME_IDENTITY_R23_CLEAN_TWO_ROW')) {
  fail('R23 Home marker missing after replacement.');
}
if (home.includes('PATCH_191I_A_MY_CLUSTER_COMPACT_HOME_TILE')) {
  fail('Old oversized My Cluster tile still remains.');
}

const shortcut = `import React from 'react';

import {
  Pressable,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

/* BUKLOD_HOME_IDENTITY_R23_EQUAL_SHORTCUTS */
export default function BuklodPublicWordShortcut() {
  const { colors } = useBuklodPresentation();
  const { activeScope } = useBuklodScope();

  const isPublic = activeScope?.scope_type === 'PUBLIC';
  const showFaithContent = Boolean(activeScope?.show_faith_content);
  const showWord = Boolean(activeScope) && (isPublic || showFaithContent);
  const inspire = isPublic && !showFaithContent;
  const label = inspire ? 'INSPIRE' : 'WORD';

  const tileStyle = ({ pressed }: { pressed: boolean }) => ({
    flex: 1,
    minWidth: 0,
    minHeight: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden' as const,
    opacity: pressed ? 0.65 : 1,
  });

  return (
    <View
      style={{
        flex: showWord ? 2 : 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 7,
      }}
    >
      {showWord ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inspire ? 'Daily Inspire' : 'Word devotional and Bible'}
          onPress={() => router.push((inspire ? '/inspire' : '/word') as any)}
          style={tileStyle}
        >
          <MaterialCommunityIcons
            name={inspire ? 'book-open-outline' : 'book-open-page-variant-outline'}
            size={22}
            color={colors.greenDark}
          />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              marginTop: 4,
              width: '100%',
              textAlign: 'center',
              fontSize: 8.6,
              lineHeight: 10,
              fontWeight: '900',
              color: colors.greenDark,
            }}
          >
            {label}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open My Classroom"
        onPress={() => router.push('/profile/buklod-classrooms' as any)}
        style={tileStyle}
      >
        <MaterialCommunityIcons
          name="school-outline"
          size={22}
          color={colors.greenDark}
        />
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={{
            marginTop: 4,
            width: '100%',
            textAlign: 'center',
            fontSize: 8.2,
            lineHeight: 10,
            fontWeight: '900',
            color: colors.greenDark,
          }}
        >
          MY CLASSROOM
        </Text>
      </Pressable>
    </View>
  );
}
`;

fs.writeFileSync(homePath, home, 'utf8');
fs.writeFileSync(shortcutPath, shortcut, 'utf8');

const finalHome = fs.readFileSync(homePath, 'utf8');
const finalShortcut = fs.readFileSync(shortcutPath, 'utf8');

const checks = [
  ['Home R23 marker', finalHome.includes('BUKLOD_HOME_IDENTITY_R23_CLEAN_TWO_ROW')],
  ['Shortcut R23 marker', finalShortcut.includes('BUKLOD_HOME_IDENTITY_R23_EQUAL_SHORTCUTS')],
  ['Rewards route', finalHome.includes("router.push('/points')")],
  ['Cluster route', finalHome.includes("router.push('/clusters' as any)")],
  ['Classroom route', finalShortcut.includes("/profile/buklod-classrooms")],
  ['No old oversized cluster marker', !finalHome.includes('PATCH_191I_A_MY_CLUSTER_COMPACT_HOME_TILE')],
];

for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) process.exit(1);
}

console.log('BUKLOD HOME R23 SOURCE PATCH COMPLETE');
