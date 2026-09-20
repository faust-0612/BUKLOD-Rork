import React, { ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  BSOC_LOGO_DATA_URI,
  BSOC_MOTTO,
  BSOC_NAME,
} from '@/lib/admin/bsocBrand';

type IconName =
  React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type NavItem = {
  key: string;
  label: string;
  icon: IconName;
  path: string;
};

const NAV: readonly NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: 'view-dashboard-outline',
    path: '/admin/bsoc',
  },
  {
    key: 'work',
    label: 'Work',
    icon: 'briefcase-check-outline',
    path: '/admin/content-reports',
  },
  {
    key: 'people',
    label: 'People',
    icon: 'account-group-outline',
    path: '/admin/member-master',
  },
  {
    key: 'communities',
    label: 'Communities',
    icon: 'office-building-outline',
    path: '/admin/org-cluster-control',
  },
  {
    key: 'apps',
    label: 'Apps & System',
    icon: 'apps-box',
    path: '/admin/bsoc/ads',
  },
  {
    key: 'security',
    label: 'Security',
    icon: 'shield-lock-outline',
    path: '/admin/privacy',
  },
  {
    key: 'administration',
    label: 'Administration',
    icon: 'cog-outline',
    path: '/admin/configuration-center',
  },
] as const;

export type BsocTone =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'offline'
  | 'neutral';

export function BsocStatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BsocTone;
}) {
  return (
    <View
      style={[
        styles.statusBadge,
        tone === 'healthy' && styles.statusHealthy,
        tone === 'warning' && styles.statusWarning,
        tone === 'critical' && styles.statusCritical,
        tone === 'offline' && styles.statusOffline,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          tone === 'healthy' && styles.dotHealthy,
          tone === 'warning' && styles.dotWarning,
          tone === 'critical' && styles.dotCritical,
          tone === 'offline' && styles.dotOffline,
        ]}
      />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

export function BsocPanel({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function BsocMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {note ? <Text style={styles.metricNote}>{note}</Text> : null}
    </View>
  );
}

function Navigation({ current }: { current: string }) {
  return (
    <View style={styles.navigation}>
      <View style={styles.brandBlock}>
        <Image
          source={{ uri: BSOC_LOGO_DATA_URI }}
          resizeMode="contain"
          style={styles.logo}
          accessibilityLabel={`${BSOC_NAME} logo`}
        />
        <Text style={styles.brandTitle}>BUKLOD SOC</Text>
        <Text style={styles.brandMotto}>{BSOC_MOTTO}</Text>
      </View>

      <View style={styles.navList}>
        {NAV.map((item) => {
          const active = item.key === current;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => router.push(item.path as any)}
              style={({ pressed }) => [
                styles.navItem,
                active && styles.navItemActive,
                pressed && { opacity: 0.76 },
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={18}
                color={active ? '#1F5C43' : '#66726B'}
              />
              <Text
                style={[
                  styles.navLabel,
                  active && styles.navLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {current === 'apps' ? (
        <View style={styles.subnav}>
          <Pressable
            onPress={() => router.push('/admin/bsoc/ads' as any)}
            style={({ pressed }) => [
              styles.subnavItem,
              pressed && { opacity: 0.76 },
            ]}
          >
            <MaterialCommunityIcons
              name="advertisements"
              size={15}
              color="#1F5C43"
            />
            <Text style={styles.subnavText}>
              Ads & Monetization Health
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push('/admin' as any)}
        style={({ pressed }) => [
          styles.adminBack,
          pressed && { opacity: 0.76 },
        ]}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={16}
          color="#66726B"
        />
        <Text style={styles.adminBackText}>Admin console</Text>
      </Pressable>
    </View>
  );
}

export default function BsocShell({
  current,
  eyebrow,
  title,
  subtitle,
  children,
  rightPanel,
}: {
  current: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  rightPanel?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const desktop = width >= 1100;
  const tablet = width >= 760;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>BUKLOD SYSTEM OPERATION CENTER</Text>
          <Text style={styles.topSubtitle}>Professional operations workspace</Text>
        </View>
        <BsocStatusBadge label="PRODUCTION" tone="healthy" />
        <View style={styles.roleBadge}>
          <MaterialCommunityIcons
            name="shield-account-outline"
            size={16}
            color="#1F5C43"
          />
          <Text style={styles.roleText}>SYSTEM ADMIN</Text>
        </View>
      </View>

      <View style={[styles.workspace, !desktop && styles.workspaceStacked]}>
        {desktop ? (
          <View style={styles.leftRail}>
            <Navigation current={current} />
          </View>
        ) : null}

        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
          {!desktop ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mobileNav}
            >
              {NAV.map((item) => {
                const active = item.key === current;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => router.push(item.path as any)}
                    style={({ pressed }) => [
                      styles.mobileNavItem,
                      active && styles.mobileNavItemActive,
                      pressed && { opacity: 0.76 },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={16}
                      color={active ? '#1F5C43' : '#6D7771'}
                    />
                    <Text
                      style={[
                        styles.mobileNavLabel,
                        active && styles.navLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={styles.pageHeader}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.pageTitle}>{title}</Text>
            <Text style={styles.pageSubtitle}>{subtitle}</Text>
          </View>

          {children}

          {!desktop && rightPanel ? (
            <View style={styles.mobileRightPanel}>{rightPanel}</View>
          ) : null}

          {!tablet ? <View style={{ height: 26 }} /> : null}
        </ScrollView>

        {desktop && rightPanel ? (
          <View style={styles.rightRail}>{rightPanel}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F6F4',
  },
  topBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE3DF',
    backgroundColor: '#FFFFFF',
  },
  topTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#1D2A23',
  },
  topSubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: '#78827C',
  },
  roleBadge: {
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D7E3DB',
    backgroundColor: '#F6FAF7',
  },
  roleText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
    color: '#1F5C43',
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
  },
  workspaceStacked: {
    flexDirection: 'column',
  },
  leftRail: {
    width: 244,
    borderRightWidth: 1,
    borderRightColor: '#DDE3DF',
    backgroundColor: '#FFFFFF',
  },
  navigation: {
    flex: 1,
    padding: 14,
  },
  brandBlock: {
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAE7',
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 22,
  },
  brandTitle: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: '#1D2A23',
  },
  brandMotto: {
    marginTop: 3,
    fontSize: 8.5,
    color: '#7A847E',
  },
  navList: {
    marginTop: 14,
    gap: 4,
  },
  navItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: '#EDF6F0',
  },
  navLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#66726B',
  },
  navLabelActive: {
    color: '#1F5C43',
    fontWeight: '900',
  },
  subnav: {
    marginTop: 7,
    marginLeft: 23,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#D4DED8',
  },
  subnavItem: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  subnavText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    color: '#1F5C43',
  },
  adminBack: {
    marginTop: 'auto',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
  },
  adminBackText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#66726B',
  },
  mainScroll: {
    flex: 1,
  },
  mainContent: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    padding: 20,
    gap: 14,
  },
  rightRail: {
    width: 300,
    borderLeftWidth: 1,
    borderLeftColor: '#DDE3DF',
    backgroundColor: '#FBFCFB',
    padding: 14,
  },
  mobileRightPanel: {
    marginTop: 4,
  },
  mobileNav: {
    gap: 6,
    paddingBottom: 4,
  },
  mobileNavItem: {
    minHeight: 37,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DDE3DF',
    backgroundColor: '#FFFFFF',
  },
  mobileNavItemActive: {
    borderColor: '#BFD7C8',
    backgroundColor: '#EDF6F0',
  },
  mobileNavLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6D7771',
  },
  pageHeader: {
    paddingBottom: 2,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.35,
    color: '#718078',
  },
  pageTitle: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: '#1B2821',
  },
  pageSubtitle: {
    marginTop: 5,
    maxWidth: 720,
    fontSize: 12,
    lineHeight: 18,
    color: '#6E7973',
  },
  statusBadge: {
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9DFDB',
    backgroundColor: '#FFFFFF',
  },
  statusHealthy: {
    borderColor: '#B7D8C3',
    backgroundColor: '#EFF8F2',
  },
  statusWarning: {
    borderColor: '#E6D09F',
    backgroundColor: '#FFF8E9',
  },
  statusCritical: {
    borderColor: '#E8BDB8',
    backgroundColor: '#FFF0EE',
  },
  statusOffline: {
    borderColor: '#CDD2CF',
    backgroundColor: '#F1F3F2',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#8A938E',
  },
  dotHealthy: {
    backgroundColor: '#2D8B57',
  },
  dotWarning: {
    backgroundColor: '#B47716',
  },
  dotCritical: {
    backgroundColor: '#B9473D',
  },
  dotOffline: {
    backgroundColor: '#777F7B',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.45,
    color: '#334139',
  },
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE5E1',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  metric: {
    minWidth: 135,
    flexGrow: 1,
    flexBasis: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E6E3',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.35,
    color: '#78827C',
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 5,
    fontSize: 21,
    fontWeight: '900',
    color: '#1E5B42',
  },
  metricNote: {
    marginTop: 3,
    fontSize: 9.5,
    lineHeight: 13,
    color: '#7A847E',
  },
});
