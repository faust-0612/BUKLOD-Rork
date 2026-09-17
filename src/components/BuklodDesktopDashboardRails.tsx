/* BUKLOD_DESKTOP_DASHBOARD_RAILS_R4 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodProfileMembershipNav from '@/components/BuklodProfileMembershipNav';
import BuklodFoundationWorkspaceNav from '@/components/BuklodFoundationWorkspaceNav';
import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import {
  DEFAULT_PROFILE_LAYOUT,
  loadProfileLayout,
  type ProfileSectionLayout,
} from '@/lib/buklodProfileLayout';
import {
  loadBuklodPointsDashboard,
  type BuklodPointsDashboard,
} from '@/lib/buklodRewards';
import {
  DEFAULT_CHARACTER,
  loadBuklodCharacter,
  reconcileCharacterForPoints,
  type BuklodCharacterState,
} from '@/lib/buklodCharacter';
import {
  loadMyProfileLocked,
  setMyProfileLocked,
} from '@/lib/buklodMemberProfile';
import { formatPoints } from '@/lib/character-lab-core/tiers';
import { withAlpha } from '@/lib/buklodContrast';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type MyBuklodItem = {
  key: string;
  icon: IconName;
  title: string;
  route: string;
  systemAdminOnly?: boolean;
};

const MY_BUKLOD_ITEMS: MyBuklodItem[] = [
  { key: 'about', icon: 'information-outline', title: 'About BUKLOD', route: '/about-buklod' },
  { key: 'personal', icon: 'account-edit-outline', title: 'Edit My Personal Information', route: '/account/personal-information' },
  { key: 'paid', icon: 'crown-outline', title: 'Paid Features', route: '/premium' },
  { key: 'security', icon: 'lock-reset', title: 'Password & Recovery', route: '/account/security' },
  { key: 'pin', icon: 'shield-lock-outline', title: 'Recovery PIN', route: '/account/recovery-pin' },
  { key: 'deactivate', icon: 'account-off-outline', title: 'Deactivate Account', route: '/account/deactivate' },
  { key: 'delete', icon: 'delete-outline', title: 'Delete Account', route: '/account/delete' },
  { key: 'delete-help', icon: 'information-outline', title: 'How Account Deletion Works', route: '/delete-account' },
  { key: 'privacy', icon: 'shield-account-outline', title: 'Privacy Policy', route: '/privacy' },
  { key: 'privacy-notice', icon: 'file-document-outline', title: 'Privacy Notice', route: '/privacy/notice' },
  { key: 'policy', icon: 'lifebuoy', title: 'BUKLOD Policy', route: '/policy' },
  { key: 'contact', icon: 'email-outline', title: 'Contact Us', route: '/contact-us' },
  { key: 'feedback', icon: 'message-text-outline', title: 'Send Feedback', route: '/feedback' },
  { key: 'subscription-admin', icon: 'crown-outline', title: 'Subscription Admin', route: '/system/paid-features', systemAdminOnly: true },
  { key: 'pilot', icon: 'test-tube', title: 'Pilot Checklist', route: '/pilot/checklist', systemAdminOnly: true },
  { key: 'recovery-admin', icon: 'lock-reset', title: 'Account Recovery Requests', route: '/admin/account-recovery', systemAdminOnly: true },
  { key: 'admin', icon: 'shield-crown-outline', title: 'Open BUKLOD Admin', route: '/admin', systemAdminOnly: true },
];

export function BuklodDesktopProfileRail() {
  const { theme } = useBuklodTheme();
  const {
    profile,
    session,
    hasRole,
    signOut,
  } = useAuth();
  const [layout, setLayout] = useState<ProfileSectionLayout[]>(DEFAULT_PROFILE_LAYOUT);
  const [profileLocked, setProfileLocked] = useState(false);
  const [profileLockBusy, setProfileLockBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const userId = profile?.id;
    if (!userId) {
      setLayout(DEFAULT_PROFILE_LAYOUT);
      return () => { active = false; };
    }
    void loadProfileLayout(userId)
      .then((next) => { if (active) setLayout(next); })
      .catch(() => { if (active) setLayout(DEFAULT_PROFILE_LAYOUT); });
    return () => { active = false; };
  }, [profile?.id]);

  useEffect(() => {
    let active = true;
    if (!profile?.id) {
      setProfileLocked(false);
      return () => { active = false; };
    }
    void loadMyProfileLocked()
      .then((locked) => { if (active) setProfileLocked(locked); })
      .catch(() => { if (active) setProfileLocked(false); });
    return () => { active = false; };
  }, [profile?.id]);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const profileRow = (profile ?? {}) as Record<string, unknown>;
  const displayName = resolvePersonDisplayName(profileRow as any, session?.user?.id);
  const username = String(profileRow.username ?? '').trim();
  const avatarUri = String(profileRow.avatar_url ?? '').trim();
  const visible = useMemo(
    () => new Set(layout.filter((row) => row.visible).map((row) => row.id)),
    [layout],
  );
  const isSystemAdmin = hasRole('system_admin');

  const toggleProfileLock = async (next: boolean) => {
    setProfileLockBusy(true);
    try {
      await setMyProfileLocked(next);
      setProfileLocked(next);
    } catch (error: unknown) {
      Alert.alert(
        'Profile Privacy',
        error instanceof Error ? error.message : 'Could not update profile privacy.',
      );
    } finally {
      setProfileLockBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.railScroll}
      contentContainerStyle={styles.railContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Profile"
        onPress={() => router.push('/(tabs)/me' as any)}
        style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <MaterialCommunityIcons name="account" size={34} color={theme.accent} />
          </View>
        )}
        <View style={styles.profileCopy}>
          <Text numberOfLines={2} style={styles.profileName}>{displayName}</Text>
          <Text numberOfLines={1} style={styles.profileMeta}>
            {username ? `@${username.replace(/^@/, '')}` : 'My Profile'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
      </Pressable>

      {/* Desktop rail intentionally omits Personal Highlights and Quick Actions. */}
      {visible.has('communities') ? <BuklodProfileMembershipNav /> : null}
      {visible.has('focusApps') ? <BuklodFoundationWorkspaceNav /> : null}

      {visible.has('myBuklod') ? (
        <View style={styles.myBuklodSection}>
          <Text style={styles.railEyebrow}>MY BUKLOD</Text>
          <View style={styles.menuCard}>
            {MY_BUKLOD_ITEMS
              .filter((item) => !item.systemAdminOnly || isSystemAdmin)
              .map((item, index) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => [
                    styles.menuRow,
                    index > 0 && styles.menuRowBorder,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.menuIcon}>
                    <MaterialCommunityIcons name={item.icon} size={18} color={theme.accent} />
                  </View>
                  <Text numberOfLines={2} style={styles.menuTitle}>{item.title}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textMuted} />
                </Pressable>
              ))}

            <View style={[styles.menuRow, styles.menuRowBorder]}>
              <View style={styles.menuIcon}>
                <MaterialCommunityIcons name="lock-outline" size={18} color={theme.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.menuTitle}>Lock Profile</Text>
                <Text style={styles.menuSubtitle}>Hide your profile details from other members</Text>
              </View>
              <Switch
                value={profileLocked}
                disabled={profileLockBusy}
                onValueChange={(next) => void toggleProfileLock(next)}
                trackColor={{ false: theme.border, true: theme.accent }}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={signOut}
              style={({ pressed }) => [
                styles.signOutRow,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons name="logout" size={18} color={theme.danger} />
              <Text style={[styles.menuTitle, { color: theme.danger }]}>SIGN OUT</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

export function BuklodDesktopCharacterPointsRail() {
  const { theme } = useBuklodTheme();
  const { session, profile } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = session?.user?.id ?? profile?.id ?? null;
  const [points, setPoints] = useState<BuklodPointsDashboard | null>(null);
  const [character, setCharacter] = useState<BuklodCharacterState>({ ...DEFAULT_CHARACTER });

  useEffect(() => {
    let active = true;
    void loadBuklodPointsDashboard()
      .then((next) => { if (active) setPoints(next); })
      .catch(() => { if (active) setPoints(null); });
    return () => { active = false; };
  }, [userId]);

  const lifetimePoints = points?.lifetime_points ?? 0;

  useEffect(() => {
    let active = true;
    void loadBuklodCharacter(userId)
      .then((loaded) => {
        if (active) setCharacter(reconcileCharacterForPoints(loaded, lifetimePoints));
      })
      .catch(() => {
        if (active) {
          setCharacter(reconcileCharacterForPoints({ ...DEFAULT_CHARACTER }, lifetimePoints));
        }
      });
    return () => { active = false; };
  }, [lifetimePoints, userId]);

  const stats = [
    { key: 'lifetime', label: 'LIFETIME', value: formatPoints(points?.lifetime_points ?? 0) },
    { key: 'available', label: 'AVAILABLE', value: formatPoints(points?.available_points ?? 0) },
    { key: 'weekly', label: 'THIS WEEK', value: formatPoints(points?.weekly_points ?? 0) },
    { key: 'rank', label: 'ALL-TIME RANK', value: points?.all_time_rank ? `#${points.all_time_rank}` : '—' },
  ];

  return (
    <ScrollView
      style={styles.railScroll}
      contentContainerStyle={styles.railContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.characterCard}>
        <Text style={styles.railEyebrow}>MY BUKLOD CHARACTER</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD Points"
          onPress={() => router.push('/points' as any)}
          style={({ pressed }) => [styles.characterStage, pressed && styles.pressed]}
        >
          <BuklodActiveCharacterArt
            fallbackCharacter={character}
            height={190}
            viewportWidth={190}
            showStage={false}
            showEffects={false}
          />
        </Pressable>

        <View style={styles.pointsGrid}>
          {stats.map((stat) => (
            <View key={stat.key} style={styles.pointsStat}>
              <Text style={styles.pointsLabel}>{stat.label}</Text>
              <Text numberOfLines={1} style={styles.pointsValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {(points?.pending_claimable_points ?? 0) > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open points ready to claim"
            onPress={() => router.push('/points' as any)}
            style={({ pressed }) => [styles.claimCard, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="gift-outline" size={18} color={theme.accent} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.claimTitle}>Points ready to claim</Text>
              <Text style={styles.claimMeta}>{formatPoints(points?.pending_claimable_points ?? 0)} pending</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open ranking and BUKLOD Points"
          onPress={() => router.push('/points' as any)}
          style={({ pressed }) => [styles.pointsButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="trophy-outline" size={18} color={theme.accent} />
          <Text style={styles.pointsButtonText}>Rank & Points</Text>
          <MaterialCommunityIcons name="arrow-right" size={17} color={theme.accent} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(theme: ReturnType<typeof useBuklodTheme>['theme']) {
  return StyleSheet.create({
    railScroll: { flex: 1, minWidth: 0 },
    railContent: { paddingTop: 7, paddingBottom: 28 },
    pressed: { opacity: 0.78 },
    railEyebrow: {
      marginHorizontal: 4,
      marginBottom: 8,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.95,
      color: theme.textMuted,
    },
    profileCard: {
      minHeight: 84,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: withAlpha(theme.cardSurface, 0.94),
    },
    avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: theme.accentSoft },
    avatarFallback: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.2),
    },
    profileCopy: { flex: 1, minWidth: 0 },
    profileName: { fontSize: 15, lineHeight: 18, fontWeight: '900', color: theme.textPrimary },
    profileMeta: { marginTop: 3, fontSize: 11, color: theme.textMuted },
    myBuklodSection: { marginTop: 10, paddingHorizontal: 12 },
    menuCard: {
      overflow: 'hidden',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: withAlpha(theme.cardSurface, 0.9),
    },
    menuRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    menuRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    menuIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
    },
    menuTitle: { flex: 1, fontSize: 11.5, lineHeight: 15, fontWeight: '900', color: theme.textPrimary },
    menuSubtitle: { marginTop: 2, fontSize: 9, lineHeight: 12, color: theme.textMuted },
    signOutRow: {
      minHeight: 48,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 10,
    },
    characterCard: {
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: withAlpha(theme.cardSurface, 0.94),
    },
    characterStage: {
      minHeight: 205,
      alignItems: 'center',
      justifyContent: 'flex-end',
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: withAlpha(theme.accentSoft, 0.55),
    },
    pointsGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pointsStat: {
      width: '48%',
      minHeight: 58,
      paddingHorizontal: 9,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    pointsLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.65, color: theme.textMuted },
    pointsValue: { marginTop: 5, fontSize: 13, fontWeight: '900', color: theme.textPrimary },
    claimCard: {
      minHeight: 56,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.22),
      backgroundColor: withAlpha(theme.accent, 0.07),
    },
    claimTitle: { fontSize: 11, fontWeight: '900', color: theme.textPrimary },
    claimMeta: { marginTop: 2, fontSize: 9.5, color: theme.textMuted },
    pointsButton: {
      minHeight: 46,
      marginTop: 10,
      paddingHorizontal: 12,
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.24),
      backgroundColor: theme.accentSoft,
    },
    pointsButtonText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '900', color: theme.accent },
  });
}
