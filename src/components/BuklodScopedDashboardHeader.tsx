import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';


import {
  BuklodDashboardCustomizer,
  type DashboardTheme,
} from '@/components/BuklodDashboardCustomizer';
// PATCH_170A_HEADER_CUSTOMIZER
import BuklodScopedHeaderBanner
  from '@/components/BuklodScopedHeaderBanner';

import {
  colors,
} from '@/lib/theme';

type Section =
  | 'home'
  | 'community'
  | 'connect';

type Props = {
  scopeName: string;
  scopeType: string;
  section: Section;
  onBack: () => void;
  theme: DashboardTheme;
  canCustomize: boolean;
  onThemeChange: (theme: DashboardTheme) => void | Promise<void>;
};

type SponsorPlacement =
  | 'home'
  | 'messages'
  | 'community';

function sponsorPlacement(
  section: Section,
): SponsorPlacement {
  if (section === 'community') {
    return 'community';
  }

  if (section === 'connect') {
    return 'messages';
  }

  return 'home';
}

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
  section,
  onBack,
  theme,
  canCustomize,
  onThemeChange,
}: Props) {

  const normalizedType =
    String(scopeType ?? '')
      .trim()
      .toUpperCase();

  /*
   * Sub-organizations are child ORGANIZATION scopes,
   * so the same shared header automatically covers them.
   */
  const showCommercialHeader =
    normalizedType === 'ORGANIZATION' ||
    normalizedType === 'CLUSTER';

  /*
   * Two-column layout only when there is enough real width.
   * Narrow phones stack the ad below the title to prevent
   * clipped creatives and accidental taps near Back.
   */
  const splitHeader = false;

  const placement =
    sponsorPlacement(section);

  return (
    <View style={styles.shell}>
      <View
        style={[
          styles.titleBar,
          splitHeader
            ? styles.titleBarSplit
            : styles.titleBarStacked,
        ]}
      >
        <View
          style={[
            styles.identityPane,
            splitHeader &&
              styles.halfPane,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={6}
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
              {normalizedType}
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

        {showCommercialHeader && (
          <View
            style={[
              styles.adPane,
              splitHeader
                ? styles.halfPane
                : styles.adPaneStacked,
            ]}
          >
            <View style={styles.adSafetyShell}>
              <BuklodScopedHeaderBanner
                placement={placement}
              />
            </View>
          </View>
        )}
      </View>

      {showCommercialHeader && (
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
      paddingHorizontal: 12,
      paddingTop: 7,
      paddingBottom: 8,
      backgroundColor:
        colors.greenDark,
    },

    titleBarSplit: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    titleBarStacked: {
      minHeight: 64,
      gap: 6,
    },

    halfPane: {
      flex: 1,
      minWidth: 0,
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

    adPane: {
      minHeight: 48,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },

    adPaneStacked: {
      width: '100%',
      minHeight: 50,
      paddingTop: 4,
      paddingBottom: 4,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },

    adSafetyShell: {
      minWidth: 188,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: 9,
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

    encouragementText: {
      flexShrink: 1,
      textAlign: 'center',
      color: colors.greenDark,
      fontSize: 10.5,
      lineHeight: 14,
      fontWeight: '800',
    },
  });
