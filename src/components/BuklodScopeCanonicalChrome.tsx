/* BUKLOD_SCOPE_CANONICAL_VISUAL_R2_20261003
 * Visual reference: approved three-screen Organization/Cluster mockup.
 * Presentation-only. No DB, feed, PTT, or messaging engine changes.
 */
import React from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  BuklodDashboardCustomizer,
  type DashboardTheme,
} from '@/components/BuklodDashboardCustomizer';
import { formatScopeTypeLabel } from '@/lib/buklodScope';
import { BUKLOD_HIT_SLOP_TIGHT } from '@/lib/buklodTouch';

type Section = 'home' | 'community' | 'connect';

type SectionItem = {
  key: Section;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

type Props = {
  scopeName: string;
  scopeType: string;
  geoLevel?: string | null;
  section: Section;
  sections: SectionItem[];
  onSectionChange: (section: Section) => void;
  onBack: () => void;
  theme: DashboardTheme;
  canCustomize: boolean;
  onThemeChange: (theme: DashboardTheme) => void | Promise<void>;
};

const CANONICAL_NAVY = '#0B3158';

function HeroContent({
  scopeName,
  typeLabel,
  scopeType,
  theme,
  section,
  onBack,
  canCustomize,
  onThemeChange,
}: {
  scopeName: string;
  typeLabel: string;
  scopeType: string;
  theme: DashboardTheme;
  section: Section;
  onBack: () => void;
  canCustomize: boolean;
  onThemeChange: (theme: DashboardTheme) => void | Promise<void>;
}) {
  const isCluster = scopeType === 'CLUSTER';
  const showIdentity = section === 'home';

  return (
    <>
      <View style={styles.scrim} />

      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={BUKLOD_HIT_SLOP_TIGHT}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={25}
            color="#FFFFFF"
          />
        </Pressable>

        <Text style={styles.topLabel} numberOfLines={1}>
          {typeLabel.toUpperCase()}
        </Text>

        <View style={styles.customizer}>
          <BuklodDashboardCustomizer
            theme={theme}
            canCustomize={canCustomize}
            onSave={onThemeChange}
          />
        </View>
      </View>

      {showIdentity ? (
        <View style={styles.identity}>
          <Text style={styles.scopeName} numberOfLines={2}>
            {scopeName}
          </Text>

          <Text style={styles.scopeSub}>
            {isCluster ? 'Cluster' : 'Organization'}
          </Text>

          <View style={styles.pills}>
            <View style={styles.darkPill}>
              <MaterialCommunityIcons
                name={isCluster ? 'account-multiple-outline' : 'office-building-outline'}
                size={13}
                color="#FFFFFF"
              />
              <Text style={styles.darkPillText}>{typeLabel}</Text>
            </View>

            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activePillText}>Active</Text>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

export default function BuklodScopeCanonicalChrome({
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
  const normalizedType = String(scopeType ?? '').trim().toUpperCase();
  const typeLabel = formatScopeTypeLabel(normalizedType, geoLevel);

  const commonProps = {
    scopeName,
    typeLabel,
    scopeType: normalizedType,
    theme,
    section,
    onBack,
    canCustomize,
    onThemeChange,
  };

  if (theme.backgroundImage) {
    return (
      <ImageBackground
        source={{ uri: theme.backgroundImage }}
        resizeMode="cover"
        style={[
          styles.hero,
          { paddingTop: insets.top },
        ]}
      >
        <HeroContent {...commonProps} />
      </ImageBackground>
    );
  }

  return (
    <View
      style={[
        styles.hero,
        styles.fallbackHero,
        { paddingTop: insets.top },
      ]}
    >
      <View style={styles.decorOne} />
      <View style={styles.decorTwo} />
      <HeroContent {...commonProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    paddingBottom: 10,
    backgroundColor: CANONICAL_NAVY,
  },
  fallbackHero: {
    backgroundColor: '#0B416F',
  },
  decorOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -55,
    top: -35,
    backgroundColor: 'rgba(40,139,255,0.20)',
  },
  decorTwo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    left: -70,
    bottom: -35,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,24,48,0.54)',
  },
  topRow: {
    minHeight: 51,
    paddingHorizontal: 12,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  topLabel: {
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.80)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  customizer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
  },
  identity: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 8,
  },
  scopeName: {
    marginTop: 2,
    maxWidth: 330,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  scopeSub: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '800',
  },
  pills: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  darkPill: {
    minHeight: 27,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,27,55,0.60)',
  },
  darkPillText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
  activePill: {
    minHeight: 27,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,163,108,0.88)',
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C6F6D5',
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
  tabShell: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: -25,
    minHeight: 58,
    padding: 6,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2EAF5',
    shadowColor: '#0B2A4A',
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
    zIndex: 50,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#24415F',
    fontSize: 10,
    fontWeight: '900',
  },
  tabTextOn: {
    color: '#FFFFFF',
  },
});
