import React from 'react';
import BuklodScopedHeaderBanner from '@/components/BuklodScopedHeaderBanner';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';


import {
  BuklodDashboardCustomizer,
  type DashboardTheme,
} from '@/components/BuklodDashboardCustomizer';
// PATCH_170A_HEADER_CUSTOMIZER

import {
  colors,
} from '@/lib/theme';
import {
  formatScopeTypeLabel,
} from '@/lib/buklodScope';

type Section =
  | 'home'
  | 'community'
  | 'connect';

type Props = {
  scopeName: string;
  scopeType: string;
  geoLevel?: string | null;
  section: Section;
  onBack: () => void;
  theme: DashboardTheme;
  canCustomize: boolean;
  onThemeChange: (theme: DashboardTheme) => void | Promise<void>;
};

function encouragementFor(
  section: Section,
) {
  if (section === 'community') {
    return 'Bawat mabuting salita ay maaaring magpalakas ng buong komunidad.';
  }

  if (section === 'connect') {
    return 'Manatiling konektado - mas malakas tayo kapag sama-sama.';
  }

  return 'Sama-sama tayong kumilos, magbahagi, at magpalakas ng ating samahan.';
}

export default function
BuklodScopedDashboardHeader({
  scopeName,
  scopeType,
  geoLevel,
  section,
  onBack,
  theme,
  canCustomize,
  onThemeChange,
}: Props) {
  const insets = useSafeAreaInsets();

  const normalizedType =
    String(scopeType ?? '')
      .trim()
      .toUpperCase();

  const typeLabel =
    formatScopeTypeLabel(
      normalizedType,
      geoLevel
    );

  /*
   * Sub-organizations are child ORGANIZATION scopes,
   * so the same shared header automatically covers them.
   */
  const showCommercialHeader =
    normalizedType === 'ORGANIZATION' ||
    normalizedType === 'CLUSTER';

  /* BUKLOD_V28_BLUE_SCOPE_LAYOUT_R1: stay BELOW the phone status bar. */
  if (showCommercialHeader) {
    return (
      <View style={[styles.blueShell, { paddingTop: insets.top }]}>
        <View style={styles.blueTopRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back"
            onPress={onBack} hitSlop={BUKLOD_HIT_SLOP_TIGHT} style={styles.blueBack}>
            <MaterialCommunityIcons name="arrow-left" size={23} color="#FFFFFF" />
          </Pressable>
          <View style={styles.blueIdentity}>
            <View style={styles.blueTitleRow}>
              <Text numberOfLines={1} style={styles.blueTitle}>
                {normalizedType === 'CLUSTER' ? 'Cluster Home' : 'Organization Home'}
              </Text>
              <View style={styles.blueActive}><Text style={styles.blueActiveText}>Active</Text></View>
            </View>
            <Text numberOfLines={1} style={styles.blueSubtitle}>{scopeName}</Text>
          </View>
          <View style={styles.blueCustomizer}>
            <BuklodDashboardCustomizer theme={theme} canCustomize={canCustomize} onSave={onThemeChange} />
          </View>
        </View>
        {section !== 'connect' ? (
          <BuklodScopedHeaderBanner
            placement={section === 'community' ? 'community' : 'home'}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        {
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.titleBar}>
        <View style={styles.identityPane}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={BUKLOD_HIT_SLOP_TIGHT}
            style={styles.back}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={colors.white}
            />
          </Pressable>

          <View style={styles.titleCopy}>
            <Text
              style={styles.headerEyebrow}
              numberOfLines={1}
            >
              {typeLabel.toUpperCase()}
            </Text>

            <Text
              style={styles.headerTitle}
              numberOfLines={1}
            >
              {scopeName}
            </Text>
          </View>

          <BuklodDashboardCustomizer
            theme={theme}
            canCustomize={canCustomize}
            onSave={onThemeChange}
          />
        </View>
      </View>

      {showCommercialHeader &&
        section !== 'connect' && (
        <View style={styles.encouragementBar}>
          <MaterialCommunityIcons
            name="heart-outline"
            size={14}
            color={colors.greenDark}
          />

          <Text
            style={styles.encouragementText}
            numberOfLines={2}
          >
            {encouragementFor(section)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    shell: {
      width: '100%',
      backgroundColor:
        colors.greenDark,
    },

    titleBar: {
      width: '100%',
      minHeight: 64,
      paddingHorizontal: 12,
      paddingTop: 7,
      paddingBottom: 8,
      backgroundColor:
        colors.greenDark,
    },

    identityPane: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    back: {
      width: 40,
      height: 40,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor:
        'rgba(255,255,255,0.12)',
    },

    titleCopy: {
      flex: 1,
      minWidth: 0,
    },

    headerEyebrow: {
      color:
        'rgba(255,255,255,0.72)',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    headerTitle: {
      marginTop: 1,
      color: colors.white,
      fontSize: 18,
      fontWeight: '900',
    },

    encouragementBar: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.line,
      backgroundColor:
        '#EEF6F1',
    },

    blueShell: { width: '100%', backgroundColor: '#07539B' },
    blueTopRow: { minHeight: 62, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
    blueBack: { width: 37, height: 40, alignItems: 'center', justifyContent: 'center' },
    blueIdentity: { flex: 1, minWidth: 0 },
    blueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    blueTitle: { flexShrink: 1, color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
    blueActive: { backgroundColor: '#19B780', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    blueActiveText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
    blueSubtitle: { marginTop: 3, fontSize: 10, color: '#D9EAFF' },
    blueCustomizer: { minWidth: 42, alignItems: 'center', justifyContent: 'center' },
    encouragementText: {
      flexShrink: 1,
      textAlign: 'center',
      color: colors.greenDark,
      fontSize: 10.5,
      lineHeight: 14,
      fontWeight: '800',
    },
  });
