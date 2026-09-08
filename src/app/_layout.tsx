import BuklodNavSafeShell from '@/components/BuklodNavSafeShell';
import BuklodRootKeyboardAvoidingView from '@/components/BuklodRootKeyboardAvoidingView';
import { BuklodGuideAvatar } from '@/components/BuklodGuideAvatar';
import BuklodFormationEntryScopeTracker from '@/components/BuklodFormationEntryScopeTracker';
import ClassroomExtensionRouteGuard from '@/components/classroom/ClassroomExtensionRouteGuard';
import '@/lib/performanceBoot';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from '@/providers/AuthProvider';
import { BuklodBibleNarrationProvider } from '@/providers/BuklodBibleNarrationProvider';
import { BuklodScopeProvider } from '@/providers/BuklodScopeProvider';
import { BuklodFoundationProvider } from '@/providers/BuklodFoundationProvider';
import { NetworkProvider } from '@/providers/NetworkProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { ComplianceProvider } from '@/providers/ComplianceProvider';
import { RuntimeConfigProvider } from '@/providers/RuntimeConfigProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import BuklodPublishBanner from '@/components/BuklodPublishBanner';
import BuklodEntitlementRouteGuard from '@/components/BuklodEntitlementRouteGuard';
import BuklodFocusAppRouteGuard from '@/components/BuklodFocusAppRouteGuard';
import BuklodCanonicalNavigationGuard from '@/components/BuklodCanonicalNavigationGuard';
import BuklodClusterInviteDeepLinkHandler from '@/components/BuklodClusterInviteDeepLinkHandler';
import BuklodAttendanceDeepLinkHandler from '@/components/BuklodAttendanceDeepLinkHandler';
import { colors } from '@/lib/theme';
import { StreamVideoProvider } from '@/providers/StreamVideoProvider';
import { BuklodThemeProvider } from '@/providers/BuklodThemeProvider';
import { BuklodCharacterEventProvider } from '@/components/character/BuklodCharacterEventProvider';
import RorkAvatarOnboardingGate from '@/components/character/RorkAvatarOnboardingGate';
import { isBuklodClassroomApp } from '@/lib/buklodAppTarget';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorText}>{error.message}</Text>
      <Pressable onPress={retry} style={styles.retry}>
        <Text style={styles.retryText}>TRY AGAIN</Text>
      </Pressable>
    </View>
  );
}

export function SuspenseFallback() {
  const classroomApp = isBuklodClassroomApp();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.green} />
      <Text
        style={{
          marginTop: 8,
          color: colors.muted,
        }}
      >
        {classroomApp ? 'Loading BUKLOD Classroom...' : 'Loading BUKLOD...'}
      </Text>
    </View>
  );
}

import { AdsProvider } from '@/providers/AdsProvider';
import { BuklodOfflineSyncProvider } from '@/providers/BuklodOfflineSyncProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const classroomApp = isBuklodClassroomApp();

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView
      style={{ flex: 1 }}
    >
      <AuthProvider>
        <BuklodBibleNarrationProvider>
        <BuklodThemeProvider>
        <BuklodCharacterEventProvider>
        {!classroomApp ? <RorkAvatarOnboardingGate /> : null}
        <BuklodScopeProvider>
        {!classroomApp ? <BuklodFormationEntryScopeTracker /> : null}
        <BuklodFoundationProvider>
      <NetworkProvider>
        <BuklodOfflineSyncProvider>
        <ComplianceProvider>
          <RuntimeConfigProvider>
          <AdsProvider>
      <NotificationProvider>
            <StreamVideoProvider>
            <BuklodRootKeyboardAvoidingView style={{ flex: 1 }}>
              <OfflineBanner/>
              {!classroomApp ? <BuklodPublishBanner /> : null}
              {!classroomApp ? <BuklodEntitlementRouteGuard /> : null}
              {!classroomApp ? <BuklodFocusAppRouteGuard /> : null}
              {!classroomApp ? <BuklodCanonicalNavigationGuard /> : null}
              {!classroomApp ? <BuklodClusterInviteDeepLinkHandler /> : null}
              {!classroomApp ? <BuklodAttendanceDeepLinkHandler /> : null}
              <ClassroomExtensionRouteGuard />
              <BuklodNavSafeShell>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'none',
                  contentStyle: { flex: 1 },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="classroom/index" />
                <Stack.Screen name="child-safety" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="privacy/index" />
                <Stack.Screen name="delete-account/index" />
                <Stack.Screen name="privacy/notice" />
                <Stack.Screen name="privacy/consent" />
                <Stack.Screen name="account/data-rights" />
                <Stack.Screen name="account/delete" />
                <Stack.Screen name="account/security" />
                <Stack.Screen name="account/reset-password" />
                <Stack.Screen name="moderation/report" />
                <Stack.Screen name="onboarding/index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="scope/index" />
                <Stack.Screen name="scope/buklod-lesson/index" />
                <Stack.Screen name="scope/formation-approvals" />
                <Stack.Screen name="devotional/[id]" />
                <Stack.Screen name="reflection/[id]" />
                <Stack.Screen name="post/[id]" />
                <Stack.Screen name="connect/index" />
                <Stack.Screen name="connect/[id]" />
                <Stack.Screen name="connect/personal/[threadId]" />
                <Stack.Screen name="connect/community/[scopeId]" />
                <Stack.Screen name="mzb" />
                <Stack.Screen name="organizations" />
                <Stack.Screen name="clusters" />
                <Stack.Screen name="prayer/new" />
                <Stack.Screen name="prayer/[id]" />
                <Stack.Screen name="notifications/index" />
                <Stack.Screen name="leader/index" />
                <Stack.Screen name="leader/follow-up/[id]" />
                <Stack.Screen name="learn/[id]" />
                <Stack.Screen name="learn/lesson" options={{ orientation: 'default' }} />
                <Stack.Screen name="formation/documents" />
                <Stack.Screen name="formation/repeat-review" />
                <Stack.Screen name="formation/bayanihan-action" />
                <Stack.Screen name="formation/mission-journal" />
                <Stack.Screen name="formation/mission-project" />
                <Stack.Screen name="word/index" />
                <Stack.Screen name="bible/index" />
{/* PATCH_155BC_NEW_ROUTES */}
                <Stack.Screen name="mentoring/index" />
                <Stack.Screen name="reels/index" />
                <Stack.Screen name="leader/bible" />
                <Stack.Screen name="mentor/index" />
                <Stack.Screen name="mentor/disciple" />
                <Stack.Screen name="church/index" />
                <Stack.Screen name="church/event/[id]" />
                <Stack.Screen name="church/attendance/[id]" />
                <Stack.Screen name="church/ministries" />
                <Stack.Screen name="church/announcement/[id]" />
                <Stack.Screen name="church/directory/index" />
                <Stack.Screen name="church/directory/settings" />
                <Stack.Screen name="church/member/[id]" />
                <Stack.Screen name="church/household/index" />
                <Stack.Screen name="pilot/welcome" />
                <Stack.Screen name="pilot/checklist" />
                <Stack.Screen name="support/index" />
                <Stack.Screen name="support/[slug]" />
                <Stack.Screen name="admin/pilot/content" />
                <Stack.Screen name="admin/pilot/checklist" />
                <Stack.Screen name="feedback/index" />
                <Stack.Screen name="feedback/mine" />
                <Stack.Screen name="about-buklod" />
                <Stack.Screen name="system/maintenance" />
                <Stack.Screen name="system/update-required" />
                <Stack.Screen name="system/pilot-access" />
                <Stack.Screen name="system/release-notes" />
                <Stack.Screen name="admin/command-center/index" />
                <Stack.Screen name="admin/command-center/incidents" />
                <Stack.Screen name="admin/command-center/readiness" />
                <Stack.Screen name="admin/command-center/releases" />
                <Stack.Screen name="admin/command-center/decision" />
                <Stack.Screen name="admin/pilot/index" />
                <Stack.Screen name="admin/pilot/runtime" />
                <Stack.Screen name="admin/pilot/features" />
                <Stack.Screen name="admin/pilot/cohorts" />
                <Stack.Screen name="admin/pilot/feedback" />
                <Stack.Screen name="admin/configuration-center" />
                <Stack.Screen name="admin/foundation-access" />
                <Stack.Screen name="admin/faith-payments" />
                <Stack.Screen name="admin/account-recovery" />
                <Stack.Screen name="account/recovery-pin" />
                <Stack.Screen name="(auth)/forgot-password" />
                {/* PATCH_162D_SPONSOR_ROUTE */}
                <Stack.Screen name="admin/sponsors" />
                <Stack.Screen name="admin/member-master" />
                <Stack.Screen name="admin/org-cluster-control" />
                <Stack.Screen name="admin/bible/index" />
                <Stack.Screen name="admin/bible/monitor" />
                <Stack.Screen name="admin/approvals" />
                <Stack.Screen name="admin/series" />
                <Stack.Screen name="admin/devotionals" />
                <Stack.Screen name="admin/devotional-editor" />
                <Stack.Screen name="admin/churches" />
                <Stack.Screen name="admin/church-readiness" />
                <Stack.Screen name="admin/groups" />
                <Stack.Screen name="admin/group/[id]" />
                <Stack.Screen name="admin/users" />
                <Stack.Screen name="admin/learning/index" />
                <Stack.Screen name="admin/learning/track-editor" />
                <Stack.Screen name="admin/learning/mentors" />
                <Stack.Screen name="admin/learning-approvals" />
                <Stack.Screen name="admin/formation/config" />
                <Stack.Screen name="admin/formation/track-assignment" />
                <Stack.Screen name="admin/formation/curriculum-preview" />
                <Stack.Screen name="admin/formation/lesson-builder" />
                <Stack.Screen name="admin/bayanihan" />
                <Stack.Screen name="admin/attendance/index" />
                <Stack.Screen name="admin/attendance/usage" />
                <Stack.Screen name="admin/attendance/scopes" />
                <Stack.Screen name="admin/attendance/focus-apps/index" />
                <Stack.Screen name="admin/attendance/focus-apps/payments" />
                <Stack.Screen name="admin/church-life/index" />
                <Stack.Screen name="admin/church-life/event-editor" />
                <Stack.Screen name="admin/church-life/events" />
                <Stack.Screen name="admin/church-life/ministries" />
                <Stack.Screen name="admin/church-life/announcement-editor" />
                <Stack.Screen name="admin/member-care/index" />
                <Stack.Screen name="admin/member-care/[id]" />
                <Stack.Screen name="admin/visitors/index" />
                <Stack.Screen name="admin/visitors/[id]" />
                <Stack.Screen name="admin/privacy/index" />
                <Stack.Screen name="admin/content-reports" />
                <Stack.Screen name="admin/system-announcement-boards" />
                <Stack.Screen name="scope/attendance/index" />
                <Stack.Screen name="scope/attendance/report" />
                <Stack.Screen name="organizations/events-attendance" />
              </Stack>
              </BuklodNavSafeShell>
            </BuklodRootKeyboardAvoidingView>
            </StreamVideoProvider>
            {!classroomApp ? <BuklodGuideAvatar /> : null}
          </NotificationProvider>
    </AdsProvider>
          </RuntimeConfigProvider>
        </ComplianceProvider>
        </BuklodOfflineSyncProvider>
      </NetworkProvider>
            </BuklodFoundationProvider>
            </BuklodScopeProvider>
        </BuklodCharacterEventProvider>
        </BuklodThemeProvider>
        </BuklodBibleNarrationProvider>
</AuthProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles=StyleSheet.create({
  loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.white},
  error:{flex:1,alignItems:'center',justifyContent:'center',padding:24,backgroundColor:colors.white},
  errorTitle:{fontSize:24,fontWeight:'900',color:colors.text},
  errorText:{marginTop:8,textAlign:'center',color:colors.muted},
  retry:{marginTop:18,backgroundColor:colors.green,paddingVertical:12,paddingHorizontal:18,borderRadius:12},
  retryText:{color:colors.white,fontWeight:'900'}
});
