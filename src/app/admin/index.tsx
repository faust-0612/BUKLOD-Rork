import React, { ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AdminGate } from '@/components/AdminGate';
import { BuklodSyncStatusBadge } from '@/components/BuklodSyncStatusBadge';
import { shared } from '@/components/UI';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import { adminDashboardStatsCacheKey } from '@/lib/buklodOfflineSync';
import { supabase } from '@/lib/supabase';

type Stats = {
  total_users: number;
  active_today: number;
  completion_rate: number;
  groups: number;
  churches: number;
  pending_requests: number;
  published_devotionals: number;
  series: number;
};

type DrawerKey =
  | 'content'
  | 'organization'
  | 'care'
  | 'operations'
  | 'attendance'
  | null;

type IconName =
  React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function StatCard({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color="#275D45"
        />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DrawerSection({
  icon,
  title,
  subtitle,
  open,
  onPress,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  open: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.drawer}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.drawerHeader,
          pressed && { opacity: 0.75 },
        ]}
      >
        <View style={styles.drawerIcon}>
          <MaterialCommunityIcons
            name={icon}
            size={22}
            color="#275D45"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.drawerTitle}>
            {title}
          </Text>

          <Text style={styles.drawerSubtitle}>
            {subtitle}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="#758179"
        />
      </Pressable>

      {open && (
        <View style={styles.drawerBody}>
          {children}
        </View>
      )}
    </View>
  );
}

function AdminRow({
  icon,
  title,
  subtitle,
  path,
  badge,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  path: string;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={() => router.push(path as any)}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color="#275D45"
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.menuTitleRow}>
          <Text style={styles.menuTitle}>
            {title}
          </Text>

          {!!badge && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badge}
              </Text>
            </View>
          )}
        </View>

        {!!subtitle && (
          <Text style={styles.menuSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color="#909A94"
      />
    </Pressable>
  );
}

export default function AdminDashboard() {
  const {
    data: stats,
    loading,
    refreshing,
    syncing,
    fromCache,
    online,
    refresh,
    error: loadError,
  } = useBuklodOfflineCache<Stats | null>({
    cacheKey: adminDashboardStatsCacheKey(),
    fetcher: async () => {
      const { data, error } = await supabase.rpc('admin_dashboard_stats');

      if (error) {
        throw error;
      }

      return data as Stats;
    },
  });

  // Organization is open by default because it contains
  // the most frequently used people/access controls.
  const [openDrawer, setOpenDrawer] =
    useState<DrawerKey>('organization');

  const toggle = (key: DrawerKey) => {
    setOpenDrawer((current) =>
      current === key ? null : key
    );
  };

  const showBlockingLoader = loading && !stats;

  const syncStatus = useMemo(() => {
    if (syncing) return 'syncing' as const;
    if (!online && stats) return 'saved_offline' as const;
    if (fromCache && online) return 'waiting_to_sync' as const;
    if (stats && !fromCache) return 'synced' as const;
    return null;
  }, [syncing, online, stats, fromCache]);

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh();
            }}
          />
        }
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              EXECUTIVE ADMINISTRATION
            </Text>

            <Text style={styles.title}>
              BUKLOD Admin
            </Text>

            <Text style={styles.subtitle}>
              Organization, formation, people, ministry operations,
              governance and system oversight.
            </Text>

            {syncStatus ? (
              <View style={{ marginTop: 10 }}>
                <BuklodSyncStatusBadge status={syncStatus} compact />
              </View>
            ) : null}
          </View>

          <View style={styles.heroIcon}>
            <MaterialCommunityIcons
              name="shield-crown-outline"
              size={30}
              color="#275D45"
            />
          </View>
        </View>

        {showBlockingLoader ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color="#275D45"
            />

            <Text style={styles.loadingText}>
              Loading executive dashboard...
            </Text>
          </View>
        ) : loadError && !stats ? (
          <View style={styles.loading}>
            <MaterialCommunityIcons
              name="cloud-alert-outline"
              size={34}
              color="#B26A00"
            />
            <Text style={styles.errorTitle}>
              Overview unavailable
            </Text>
            <Text style={styles.errorText}>
              {loadError}
            </Text>
            <Pressable
              onPress={() => {
                void refresh();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>
                TRY AGAIN
              </Text>
            </Pressable>
          </View>
        ) : stats ? (
          <>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  EXECUTIVE SNAPSHOT
                </Text>

                <Text style={styles.sectionTitle}>
                  Overview
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chart-box-outline"
                size={24}
                color="#275D45"
              />
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                icon="account-group-outline"
                label="Total Users"
                value={stats.total_users}
              />

              <StatCard
                icon="account-check-outline"
                label="Active Today"
                value={stats.active_today}
              />

              <StatCard
                icon="progress-check"
                label="Completion"
                value={`${stats.completion_rate}%`}
              />

              <StatCard
                icon="account-multiple-outline"
                label="Groups"
                value={stats.groups}
              />

              <StatCard
                icon="church"
                label="Churches"
                value={stats.churches}
              />

              <StatCard
                icon="account-clock-outline"
                label="Pending"
                value={stats.pending_requests}
              />
            </View>

            <View style={styles.devotionalCard}>
              <View style={styles.devotionalIcon}>
                <MaterialCommunityIcons
                  name="book-open-page-variant-outline"
                  size={25}
                  color="#275D45"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.devotionalTitle}>
                  Devotional Content
                </Text>

                <Text style={styles.devotionalMeta}>
                  {stats.published_devotionals} available devotionals
                  {'  |  '}
                  {stats.series} series
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  MANAGEMENT CONSOLE
                </Text>

                <Text style={styles.sectionTitle}>
                  Administration
                </Text>
              </View>
            </View>

            <DrawerSection
              icon="book-education-outline"
              title="Content & Formation"
              subtitle="Devotionals, learning, discipleship and mentoring"
              open={openDrawer === 'content'}
              onPress={() => toggle('content')}
            >
              <AdminRow
                icon="book-open-page-variant-outline"
                title="Devotional Content"
                subtitle="Manage published and upcoming devotionals"
                path="/admin/devotionals"
              />
              <AdminRow
                icon="book-open-variant"
                title="Daily Bible Reading"
                subtitle="Set daily passages, reflection questions and monitor submissions"
                path="/admin/bible"
              />

              <AdminRow
                icon="bookshelf"
                title="Devotional Series"
                subtitle="Organize devotional content into series"
                path="/admin/series"
              />

              <AdminRow
                icon="school-outline"
                title="Learning Tracks"
                subtitle="Manage BUKLOD formation and learning tracks"
                path="/admin/learning"
              />

              

              <AdminRow
                icon="bullhorn-outline"
                title="Announcement Boards"
                subtitle="Bold Home board and separate profile message"
                path="/admin/system-announcement-boards"
              />

              <AdminRow
                icon="clipboard-check-outline"
                title="Learning Progress Approval"
                subtitle="Final System Admin review after Pastor validation"
                path="/admin/learning-approvals"
              />
            </DrawerSection>

            <DrawerSection
              icon="office-building-cog-outline"
              title="People & Rewards"
              subtitle="Bayanihan participation and faith payment verification"
              open={openDrawer === 'organization'}
              onPress={() => toggle('organization')}
            >
              <AdminRow
                icon="hand-heart-outline"
                title="BUKLOD Bayanihan"
                subtitle="Participation, recognition and BUKLOD progress"
                path="/admin/bayanihan"
              />

              <AdminRow
                icon="cash-check"
                title="Faith & Cluster Payments"
                subtitle="Verify GCash for Cluster Premium, lesson packages, and Organization Focus Apps"
                path="/admin/faith-payments"
              />
            </DrawerSection>

            

            <DrawerSection
              icon="clipboard-check-outline"
              title="BUKLOD Attendance & Focus Apps"
              subtitle="Platform usage, analytics, subscriptions and all focus apps"
              open={openDrawer === 'attendance'}
              onPress={() => toggle('attendance')}
            >
              <AdminRow
                icon="view-dashboard-outline"
                title="Attendance & Focus Apps Console"
                subtitle="Platform snapshot, reports, scope adoption and focus app analytics"
                path="/admin/attendance"
              />

              <AdminRow
                icon="chart-timeline-variant"
                title="Attendance Usage Analytics"
                subtitle="Events, check-ins, cluster activity and adoption trends"
                path="/admin/attendance/usage"
              />

              <AdminRow
                icon="apps"
                title="All Focus Apps"
                subtitle="Subscriptions, admins and per-app usage across the platform"
                path="/admin/attendance/focus-apps"
              />

              <AdminRow
                icon="cash-check"
                title="Focus App Payments"
                subtitle="Review annual GCash subscription requests for every focus app"
                path="/admin/attendance/focus-apps/payments"
              />
            </DrawerSection>

            <DrawerSection
              icon="shield-outline"
              title="Operations & Governance"
              subtitle="Reports, privacy, pilot operations and system readiness"
              open={openDrawer === 'operations'}
              onPress={() => toggle('operations')}
            >
              

              
              <AdminRow
                icon="office-building-cog-outline"
                title="Org / Cluster Control Center"
                subtitle="Organizations, Clusters, leadership, grants, suspend and audit"
                path="/admin/org-cluster-control"
              />
              <AdminRow
                icon="shield-account-outline"
                title="Access & Roles"
                subtitle="Foundation roles, scoped admins and audited access changes"
                path="/admin/foundation-access"
              />
              <AdminRow
                icon="church-outline"
                title="Church Readiness"
                subtitle="Pastor/Mentor, map location and Nearby discovery setup"
                path="/admin/church-readiness"
              />
              <AdminRow
                icon="tune-variant"
                title="Configuration Center"
                subtitle="Buttons, links, strings, features — System Admin and scope admins"
                path="/admin/configuration-center"
              />

              <AdminRow
                icon="account-key-outline"
                title="Account Recovery"
                subtitle="Verify assistance requests and issue one-time recovery codes"
                path="/admin/account-recovery"
              />

              <AdminRow
                icon="flag-outline"
                title="Reported Posts & Comments"
                subtitle="Reason, post or comment, and System Admin review"
                path="/admin/content-reports"
              />
              <AdminRow
                icon="shield-lock-outline"
                title="Privacy & Moderation"
                subtitle="Privacy requests and reported posts or comments"
                path="/admin/privacy"
              />
              {/* PATCH_162D_SPONSOR_ADMIN */}
              <AdminRow
                icon="advertisements"
                title="Sponsors & Advertising"
                subtitle="Review, approve and manage BUKLOD local advertisements"
                path="/admin/sponsors"
              />

              <AdminRow
                icon="flask-outline"
                title="Pilot Operations"
                subtitle="Pilot access, features and feedback"
                path="/admin/pilot"
              />
            </DrawerSection>

            <View style={styles.footerCard}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={23}
                color="#275D45"
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.footerTitle}>
                  BUKLOD Executive Console
                </Text>

                <Text style={styles.footerText}>
                  Administrative access is role-controlled and subject
                  to system authorization.
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <Text style={styles.footerBrand}>
          MZB MINISTRY INC. | BUKLOD
        </Text>
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
    paddingTop: 18,

    // Extra clearance so the final controls never sit
    // behind the bottom navigation pane.
    paddingBottom: 155,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 19,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: 'rgba(39,93,69,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  heroIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.12)',
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.7,
    color: '#78847D',
  },

  title: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '900',
    color: '#1C2822',
  },

  subtitle: {
    display: 'none',
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#69766F',
  },

  loading: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 6,
    fontSize: 12,
    color: '#748078',
  },

  errorTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '900',
    color: '#1C2822',
  },

  errorText: {
    marginTop: 6,
    paddingHorizontal: 24,
    fontSize: 12,
    lineHeight: 18,
    color: '#69766F',
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#275D45',
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  sectionHeading: {
    marginTop: 5,
    marginBottom: 6,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#859089',
  },

  sectionTitle: {
    marginTop: 2,
    fontSize: 21,
    fontWeight: '900',
    color: '#202C26',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
  },

  statCard: {
    width: '47%',
    minWidth: 150,
    flexGrow: 1,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
  },

  statIcon: {
    width: 34,
    height: 34,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(39,93,69,0.07)',
  },

  statValue: {
    fontSize: 23,
    fontWeight: '900',
    color: '#275D45',
  },

  statLabel: {
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7B8780',
  },

  devotionalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    padding: 15,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  devotionalIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(39,93,69,0.075)',
  },

  devotionalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#223029',
  },

  devotionalMeta: {
    marginTop: 4,
    fontSize: 11.5,
    color: '#78847D',
  },

  drawer: {
    marginBottom: 6,
    overflow: 'hidden',
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
  },

  drawerHeader: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },

  drawerIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(39,93,69,0.07)',
  },

  drawerTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#223029',
  },

  drawerSubtitle: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#7A867F',
  },

  drawerBody: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(25,45,35,0.07)',
  },

  menuRow: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(25,45,35,0.09)',
  },

  menuIcon: {
    width: 37,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(39,93,69,0.06)',
  },

  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  menuTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#25322B',
  },

  menuSubtitle: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: '#7E8983',
  },

  badge: {
    minWidth: 21,
    height: 21,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#275D45',
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  footerCard: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 15,
    borderRadius: 0,
    backgroundColor: 'rgba(39,93,69,0.055)',
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  footerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#275D45',
  },

  footerText: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#748078',
  },

  footerBrand: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#909A94',
  },
});


