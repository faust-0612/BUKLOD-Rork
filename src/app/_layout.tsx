import BuklodPttGlobalHost from '@/components/BuklodPttGlobalHost';
import BuklodNavSafeShell from '@/components/BuklodNavSafeShell';
import BuklodRootKeyboardAvoidingView from '@/components/BuklodRootKeyboardAvoidingView';
import BuklodFormationEntryScopeTracker from '@/components/BuklodFormationEntryScopeTracker';
import BuklodTrustedDeviceGate from '@/components/BuklodTrustedDeviceGate';
import '@/lib/performanceBoot';
import { Stack, router, usePathname, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useEffect, useState } from 'react';
import { AuthProvider } from '@/providers/AuthProvider';
import { BuklodI18nProvider } from '@/providers/BuklodI18nProvider';
import { BuklodBibleNarrationProvider } from '@/providers/BuklodBibleNarrationProvider';
import { BuklodScopeProvider } from '@/providers/BuklodScopeProvider';
import { BuklodFoundationProvider } from '@/providers/BuklodFoundationProvider';
import { NetworkProvider } from '@/providers/NetworkProvider';
import { BuklodFeedbackProvider } from '@/providers/BuklodFeedbackProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { ComplianceProvider } from '@/providers/ComplianceProvider';
import { RuntimeConfigProvider } from '@/providers/RuntimeConfigProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import BuklodPublishBanner from '@/components/BuklodPublishBanner';
import BuklodOtaFreshnessHost from '@/components/BuklodOtaFreshnessHost';
import BuklodMandatoryUpdateBoundary from '@/components/BuklodMandatoryUpdateBoundary';
import BuklodClientVersionReporter from '@/components/BuklodClientVersionReporter';
import BuklodEntitlementRouteGuard from '@/components/BuklodEntitlementRouteGuard';
import BuklodFocusAppRouteGuard from '@/components/BuklodFocusAppRouteGuard';
import BuklodCanonicalNavigationGuard from '@/components/BuklodCanonicalNavigationGuard';
import BuklodClusterInviteDeepLinkHandler from '@/components/BuklodClusterInviteDeepLinkHandler';
import BuklodAttendanceDeepLinkHandler from '@/components/BuklodAttendanceDeepLinkHandler';
import BuklodAdSafetyRouteBridge from '@/components/BuklodAdSafetyRouteBridge';
import BuklodWebAdSenseProvider from '@/components/BuklodWebAdSenseProvider';
import BuklodProfitFirstIdentityBootstrap from '@/components/BuklodProfitFirstIdentityBootstrap';
import { colors } from '@/lib/theme';
import { BuklodCharacterEventProvider } from '@/components/character/BuklodCharacterEventProvider';
import RorkAvatarOnboardingGate from '@/components/character/RorkAvatarOnboardingGate';
import { StreamVideoProvider } from '@/providers/StreamVideoProvider';
import { BuklodThemeProvider } from '@/providers/BuklodThemeProvider';
import BuklodMainHealthAgent from '@/components/BuklodMainHealthAgent';
import BuklodSyncCoordinator from '@/components/BuklodSyncCoordinator';
import BuklodMainBrandIntro from '@/components/BuklodMainBrandIntro';
import BuklodCenteredBrandMark, {
  BUKLOD_BRAND_LOGO_NATIVE,
  BUKLOD_BRAND_LOGO_WEB,
} from '@/components/BuklodCenteredBrandMark';
import { reportBuklodMainHealthIssue } from '@/lib/buklodMainHealth';
import { resolveBuklodCrashRoute } from '@/lib/buklodRouteDiagnostics';

function renderErrorSignature(error: Error): string {
  // Keep diagnostic payloads free of private error messages and stack traces.
  const detail = `${error?.name ?? 'Error'}:${error?.message ?? ''}`;
  let hash = 2166136261;
  for (let index = 0; index < detail.length; index += 1) {
    hash = Math.imul(hash ^ detail.charCodeAt(index), 16777619);
  }
  return `RENDER_${(hash >>> 0).toString(16).toUpperCase()}`;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const pathname = usePathname();
  const segments = useSegments();
  const routeModule = resolveBuklodCrashRoute(pathname, segments);
  const errorSignature = renderErrorSignature(error);

  useEffect(() => {
    void reportBuklodMainHealthIssue({
      category: 'ROUTE',
      severity: 'ERROR',
      safeErrorCode: 'SYS-500',
      errorSignature,
      correlationKey: 'BUKLOD_SCREEN_RENDER_EXCEPTION',
      routeModule,
      networkState: 'UNKNOWN',
      authState: 'UNKNOWN',
      syncState: 'UNKNOWN',
      localStorageState: 'UNKNOWN',
      pendingWorkCount: 0,
      lastSuccessfulAction: 'ROUTE_OPEN',
      localSelfHealAttempted: false,
      localSelfHealResult: 'NOT_ATTEMPTED',
      privacyClassification: 'OPERATIONAL',
    }).catch(() => undefined);
  }, [error, errorSignature, routeModule]);

  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>BUKLOD could not open this screen</Text>
      <Text style={styles.errorText}>
        We couldn't complete this action. Please try again.
      </Text>
      <Text style={styles.errorCode}>Support code: SYS-500 · {errorSignature}</Text>
      <View style={styles.errorActions}>
        <Pressable onPress={retry} style={styles.retry}>
          <Text style={styles.retryText}>TRY AGAIN</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace(
            (pathname.startsWith('/clusters') || pathname.startsWith('/scope')
              ? '/clusters'
              : '/buklod') as any,
          )}
          style={styles.helpButton}
        >
          <Text style={styles.helpButtonText}>GO BACK</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/help' as any,
              params: {
                category: 'TECHNICAL',
                errorCode: 'SYS-500',
                errorSignature,
                sourceRoute: routeModule,
                message: "BUKLOD couldn't open the requested screen.",
              },
            })
          }
          style={styles.helpButton}
        >
          <Text style={styles.helpButtonText}>NEED HELP?</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SuspenseFallback() {
  const pathname = usePathname();
  const { height } = useWindowDimensions();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
      void reportBuklodMainHealthIssue({
        category: 'LOADING',
        severity: 'ERROR',
        safeErrorCode: 'ROUTE-408',
        errorSignature: 'ROUTE_LOAD_TIMEOUT',
        correlationKey: 'BUKLOD_MAIN_ROUTE_LOAD_TIMEOUT',
        routeModule: String(pathname ?? '')
          .replace(/^\/+/, '')
          .replace(/[^A-Za-z0-9_./:-]/g, '')
          .slice(0, 160) || 'unknown',
        networkState: 'UNKNOWN',
        authState: 'UNKNOWN',
        syncState: 'UNKNOWN',
        localStorageState: 'UNKNOWN',
        pendingWorkCount: 0,
        lastSuccessfulAction: 'ROUTE_OPEN',
        localSelfHealAttempted: true,
        localSelfHealResult: 'FAILED',
        privacyClassification: 'OPERATIONAL',
      });
    }, 12_000);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (timedOut) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>
          BUKLOD is taking longer than expected
        </Text>
        <Text style={styles.errorText}>
          The screen did not finish loading. You can return to Community
          Wall or open Need Help.
        </Text>
        <Text style={styles.errorCode}>
          Support code: ROUTE-408
        </Text>
        <View style={styles.errorActions}>
          <Pressable
            onPress={() => router.replace('/buklod' as any)}
            style={styles.retry}
          >
            <Text style={styles.retryText}>COMMUNITY WALL</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/help' as any,
                params: {
                  category: 'TECHNICAL',
                  errorCode: 'ROUTE-408',
                  sourceRoute: pathname,
                },
              })
            }
            style={styles.helpButton}
          >
            <Text style={styles.helpButtonText}>NEED HELP?</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.loading, { minHeight: height }]}>
      <BuklodCenteredBrandMark
        logoSize={
          Platform.OS === 'web'
            ? BUKLOD_BRAND_LOGO_WEB
            : BUKLOD_BRAND_LOGO_NATIVE
        }
        showTagline={false}
      />
    </View>
  );
}

import { AdsProvider } from '@/providers/AdsProvider';
import { BuklodOfflineSyncProvider } from '@/providers/BuklodOfflineSyncProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function RootLayout() {
  return (
    <BuklodMainBrandIntro>
    <SafeAreaProvider>
    <BuklodI18nProvider>
    <GestureHandlerRootView
      style={{ flex: 1 }}
    >
      <NetworkProvider>
      <AuthProvider>
        <BuklodProfitFirstIdentityBootstrap />
        <BuklodTrustedDeviceGate>
        <BuklodBibleNarrationProvider>
        <BuklodThemeProvider>
        <BuklodCharacterEventProvider>
        <RorkAvatarOnboardingGate />
        <BuklodScopeProvider>
        <BuklodFormationEntryScopeTracker />
        <BuklodFoundationProvider>
        <BuklodFeedbackProvider>
        <BuklodOfflineSyncProvider>
          <BuklodSyncCoordinator />
          <BuklodMainHealthAgent />
        <ComplianceProvider>
          <RuntimeConfigProvider>
          <AdsProvider>
            <BuklodAdSafetyRouteBridge />
      <NotificationProvider>
            <StreamVideoProvider>
            <BuklodRootKeyboardAvoidingView style={{ flex: 1 }}>
              <OfflineBanner/>
              <BuklodPublishBanner />
              <BuklodOtaFreshnessHost />
              <BuklodClientVersionReporter />
              <BuklodEntitlementRouteGuard />
              <BuklodFocusAppRouteGuard />
              <BuklodCanonicalNavigationGuard />
              <BuklodClusterInviteDeepLinkHandler />
              <BuklodAttendanceDeepLinkHandler />
              <BuklodWebAdSenseProvider>
              <BuklodNavSafeShell>
              <BuklodMandatoryUpdateBoundary>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'none',
                  contentStyle: { flex: 1 },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="child-safety" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="privacy/index" />
                <Stack.Screen name="help/index" />
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
                <Stack.Screen name="life/index" />
                <Stack.Screen name="life/share" />
                <Stack.Screen name="life/impact" />
                <Stack.Screen name="life/invite" />
                <Stack.Screen name="life/topic" />
                <Stack.Screen name="bayanihan/index" />
                <Stack.Screen name="bayanihan/guide" />
                <Stack.Screen name="preferences/language" />
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
                <Stack.Screen name="admin/daily-engagement" />
                <Stack.Screen name="scope/attendance/index" />
                <Stack.Screen name="scope/attendance/report" />
                <Stack.Screen name="organizations/events-attendance" />
                <Stack.Screen name="drawer/index" />
                <Stack.Screen name="drawer/quick-note" />
                <Stack.Screen name="drawer/capture" />
                <Stack.Screen name="drawer/import" />
                <Stack.Screen name="drawer/review" />
                <Stack.Screen name="drawer/item/[id]" />
                <Stack.Screen name="drawer/settings" />
              </Stack>
              </BuklodMandatoryUpdateBoundary>
              </BuklodNavSafeShell>
              </BuklodWebAdSenseProvider>
            </BuklodRootKeyboardAvoidingView>
            </StreamVideoProvider>
                      {/* PATCH_163A_R_ROOT_GUIDE */}
          </NotificationProvider>
    </AdsProvider>
          </RuntimeConfigProvider>
        </ComplianceProvider>
        </BuklodOfflineSyncProvider>
        </BuklodFeedbackProvider>
            </BuklodFoundationProvider>
            </BuklodScopeProvider>
        </BuklodCharacterEventProvider>
        </BuklodThemeProvider>
        </BuklodBibleNarrationProvider>
        </BuklodTrustedDeviceGate>
</AuthProvider>
      </NetworkProvider>
    </GestureHandlerRootView>
    </BuklodI18nProvider>
    </SafeAreaProvider>
    </BuklodMainBrandIntro>
  );
}

const styles=StyleSheet.create({
  loading:{flex:1,backgroundColor:'#FFFFFF'},
  error:{flex:1,alignItems:'center',justifyContent:'center',padding:24,backgroundColor:colors.white},
  errorTitle:{fontSize:24,fontWeight:'900',color:colors.text},
  errorText:{marginTop:8,textAlign:'center',color:colors.muted},
  errorCode:{marginTop:8,fontSize:11,fontWeight:'900',color:colors.muted},
  errorActions:{marginTop:18,flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:10},
  retry:{backgroundColor:colors.green,paddingVertical:12,paddingHorizontal:18,borderRadius:12},
  retryText:{color:colors.white,fontWeight:'900'},
  helpButton:{borderWidth:1,borderColor:colors.green,paddingVertical:12,paddingHorizontal:18,borderRadius:12},
  helpButtonText:{color:colors.green,fontWeight:'900'}
});

/* BUKLOD_PTT_GLOBAL_HOST_R2 */
export default function BuklodRootLayoutWithPttR2() {
  return (
    <>
      <BuklodPttGlobalHost />
      <RootLayout />
    </>
  );
}
