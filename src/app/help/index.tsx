import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, usePathname } from 'expo-router';

import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import {
  BUKLOD_SUPPORT_CATEGORIES,
  loadBuklodSupportCases,
  runBuklodSupportFlow,
  type BuklodSupportCaseSummary,
  type BuklodSupportCategory,
  type BuklodSupportResult,
} from '@/lib/buklodSupport';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import {
  getSmartDrawerDiagnostics,
} from '@/lib/smartDrawer/diagnostics';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';

const ACCOUNT_CATEGORIES = new Set<BuklodSupportCategory>([
  'SIGN_IN',
  'FORGOT_PASSWORD',
  'ACCOUNT_LOCKED',
  'RECOVERY_CODE',
  'OTHER_ACCOUNT',
]);

function categoryKey(category: BuklodSupportCategory) {
  const keys: Record<BuklodSupportCategory, string> = {
    SIGN_IN: 'support.category.signIn',
    FORGOT_PASSWORD: 'support.category.forgotPassword',
    ACCOUNT_LOCKED: 'support.category.accountLocked',
    RECOVERY_CODE: 'support.category.recoveryCode',
    APP_NOT_RESPONDING: 'support.category.appNotResponding',
    OTHER_ACCOUNT: 'support.category.otherAccount',
    QUIZ: 'support.category.quiz',
    CLASSROOM: 'support.category.classroom',
    ORGANIZATION: 'support.category.organization',
    REPORTED_CONTENT: 'support.category.reportedContent',
    TECHNICAL: 'support.category.technical',
    FINANCIAL: 'support.category.financial',
    OTHER: 'support.category.other',
  };
  return keys[category];
}

function statusLabel(
  status: string,
  t: (key: string) => string,
) {
  if (status === 'WAITING_FOR_USER') return t('support.statusWaiting');
  if (status === 'BEING_REVIEWED') return t('support.statusReview');
  if (status === 'RESOLVED') return t('support.statusResolved');
  return t('support.statusOpen');
}

export default function BuklodHelpScreen() {
  const { t, locale } = useBuklodI18n();
  const pathname = usePathname();
  const params = useLocalSearchParams<{
    category?: string;
    errorCode?: string;
    message?: string;
    sourceRoute?: string;
  }>();
  const [signedIn, setSignedIn] = useState(false);
  const [category, setCategory] =
    useState<BuklodSupportCategory>('SIGN_IN');
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [casesBusy, setCasesBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] =
    useState<BuklodSupportResult | null>(null);
  const [cases, setCases] =
    useState<BuklodSupportCaseSummary[]>([]);

  useEffect(() => {
    const requestedCategory = String(params.category ?? '')
      .trim()
      .toUpperCase() as BuklodSupportCategory;
    if (
      BUKLOD_SUPPORT_CATEGORIES.some(
        item => item.key === requestedCategory,
      )
    ) {
      setCategory(requestedCategory);
    }

    const requestedMessage = String(params.message ?? '').trim();
    if (requestedMessage) {
      setMessage(current => current || requestedMessage);
    }

    const errorCode = String(params.errorCode ?? '').trim();
    if (errorCode) {
      void trackBuklodFeedbackEvent({
        event: 'support_opened_after_error',
        supportCode: errorCode,
        route:
          String(params.sourceRoute ?? '').trim() ||
          pathname,
        feature: 'Help',
        outcome: requestedCategory || 'TECHNICAL',
      });
    }
  }, [
    params.category,
    params.errorCode,
    params.message,
    params.sourceRoute,
    pathname,
  ]);

  useEffect(() => {
    let alive = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setSignedIn(!!session);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const visibleCategories = useMemo(
    () =>
      BUKLOD_SUPPORT_CATEGORIES.filter(
        item => signedIn || item.preLogin,
      ),
    [signedIn],
  );

  const refreshCases = useCallback(async () => {
    setCasesBusy(true);
    try {
      setCases(await loadBuklodSupportCases());
    } finally {
      setCasesBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshCases();
  }, [refreshCases]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setResult(null);

    try {
      const sourceRoute =
        String(params.sourceRoute ?? '').trim() ||
        pathname;
      let drawerDiagnostics:
        Record<string, string | number | boolean | null> =
          {};

      if (
        signedIn &&
        sourceRoute.startsWith('/drawer')
      ) {
        const { data } =
          await supabase.auth.getSession();
        const userId =
          data.session?.user?.id ?? '';

        if (userId) {
          const diag =
            await getSmartDrawerDiagnostics(
              userId,
            ).catch(() => null);

          if (diag) {
            drawerDiagnostics = {
              drawer_store_mode: diag.storeMode,
              drawer_active_count:
                diag.activeCount,
              drawer_due_soon_count:
                diag.dueSoonCount,
              drawer_overdue_count:
                diag.overdueCount,
              drawer_active_list_count:
                diag.activeListCount,
              drawer_local_only_count:
                diag.localOnlyCount,
              drawer_notification_permission:
                diag.notificationPermission,
              drawer_cloud_sync:
                diag.cloudSync,
            };
          }
        }
      }

      const next = await runBuklodSupportFlow({
        category,
        identifier:
          ACCOUNT_CATEGORIES.has(category) || !signedIn
            ? identifier
            : '',
        message,
        app: 'BUKLOD Main',
        feature:
          sourceRoute.startsWith('/drawer')
            ? 'Smart Drawer'
            : category === 'QUIZ'
              ? 'Quiz'
              : category === 'CLASSROOM'
                ? 'Classroom'
                : category === 'ORGANIZATION'
                  ? 'Organization / Cluster / Sub-Org'
                  : '',
        route: sourceRoute,
        errorCode:
          String(params.errorCode ?? '').trim() ||
          null,
        languageCode: locale,
        diagnostics: drawerDiagnostics,
      });
      setResult(next);
      if (next.outcome === 'CASE_CREATED') {
        await refreshCases();
      }
    } catch (supportError) {
      const feedback = buildBuklodUserFeedback(
        supportError,
        {
          context: 'general',
          fallbackTitle: 'BUKLOD Help could not finish',
          fallbackMessage: t('support.creationFailed'),
        },
      );
      setError(
        [
          feedback.message,
          feedback.nextStep,
          feedback.supportCode
            ? `Support code: ${feedback.supportCode}`
            : null,
        ]
          .filter(Boolean)
          .join(' '),
      );
      void trackBuklodFeedbackEvent({
        event: 'action_failed',
        category: feedback.category,
        supportCode: feedback.supportCode,
        route: pathname,
        feature: 'Help',
        outcome: 'support_flow_failed',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/' as any)
          }
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>BUKLOD HELP</Text>
          <Text style={styles.title}>{t('support.title')}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <MaterialCommunityIcons
          name="lifebuoy"
          size={24}
          color={colors.green}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>
            {signedIn ? t('support.subtitle') : t('support.prelogin')}
          </Text>
          <Text style={styles.infoBody}>
            {t('support.subtitle')}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {t('support.chooseIssue')}
      </Text>

      <View style={styles.categoryGrid}>
        {visibleCategories.map(item => {
          const selected = category === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setCategory(item.key);
                setResult(null);
                setError('');
              }}
              style={[
                styles.category,
                selected && styles.categorySelected,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selected && styles.categoryTextSelected,
                ]}
              >
                {t(categoryKey(item.key))}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {(ACCOUNT_CATEGORIES.has(category) || !signedIn) && (
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>
            {t('support.identifier')}
          </Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('support.identifier')}
            style={styles.input}
          />
          <Text style={styles.safetyText}>
            {t('support.identifierHint')}
          </Text>
        </View>
      )}

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>{t('support.details')}</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={4000}
          placeholder={t('support.details')}
          style={[styles.input, styles.messageInput]}
        />
      </View>

      <Pressable
        disabled={busy}
        onPress={() => void submit()}
        style={[
          styles.primary,
          busy && { opacity: 0.6 },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <MaterialCommunityIcons
            name="stethoscope"
            size={19}
            color="#FFFFFF"
          />
        )}
        <Text style={styles.primaryText}>
          {busy ? t('support.checking') : t('support.checkFix')}
        </Text>
      </Pressable>

      {!!error && (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color="#A53A34"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {result?.outcome === 'FIXED' && (
        <View style={styles.successCard}>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={22}
            color="#1F6B45"
          />
          <Text style={styles.successText}>
            {t('support.fixed')}
          </Text>
        </View>
      )}

      {result?.outcome === 'SELF_SERVICE' && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{result.message}</Text>
          <Pressable
            onPress={() => router.push(result.next_route as any)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {t('support.openRecovery')}
            </Text>
          </Pressable>
        </View>
      )}

      {result?.outcome === 'KNOWN_INCIDENT' && (
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>
            {t('support.knownIncident')}
          </Text>
          <Text style={styles.resultTitle}>
            {result.incident.title}
          </Text>
          <Text style={styles.resultBody}>
            {result.incident.message}
          </Text>
          <Text style={styles.resultMeta}>
            {result.incident.incident_code} • {result.incident.status}
          </Text>
          <Text style={styles.resultBody}>
            {t('support.noDuplicate')}
          </Text>
        </View>
      )}

      {result?.outcome === 'CASE_CREATED' && (
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>
            {t('support.caseCreated')}
          </Text>
          <Text style={styles.caseCode}>
            Support Case: {result.case.case_code}
          </Text>
          <Text style={styles.resultMeta}>
            Status: {statusLabel(result.case.status, t)}
          </Text>
          {!!result.incident?.incident_code && (
            <Text style={styles.resultBody}>
              Linked incident: {result.incident.incident_code}
            </Text>
          )}
        </View>
      )}

      <View style={styles.caseHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {t('support.myCases')}
          </Text>
          <Text style={styles.caseHint}>
            Internal staff notes and sensitive diagnostics are never shown here.
          </Text>
        </View>
        <Pressable
          disabled={casesBusy}
          onPress={() => void refreshCases()}
          style={styles.refresh}
        >
          {casesBusy ? (
            <ActivityIndicator size="small" color={colors.green} />
          ) : (
            <MaterialCommunityIcons
              name="refresh"
              size={18}
              color={colors.green}
            />
          )}
          <Text style={styles.refreshText}>
            {t('support.refreshCases')}
          </Text>
        </Pressable>
      </View>

      {!casesBusy && cases.length === 0 && (
        <Text style={styles.emptyText}>
          {t('support.noCases')}
        </Text>
      )}

      {cases.map(item => (
        <View key={item.case_code} style={styles.caseRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.caseRowCode}>{item.case_code}</Text>
            <Text style={styles.caseRowTitle}>
              {item.title || item.category || 'BUKLOD Support'}
            </Text>
            {!!item.incident?.incident_code && (
              <Text style={styles.caseIncident}>
                {item.incident.incident_code}
              </Text>
            )}
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {statusLabel(item.status, t)}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 56,
    gap: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDE7E1',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#527062',
  },
  title: { fontSize: 27, fontWeight: '900', color: '#173C2C' },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#EAF5EF',
    borderWidth: 1,
    borderColor: '#CFE3D7',
  },
  infoTitle: { fontSize: 14, fontWeight: '900', color: '#204E38' },
  infoBody: { marginTop: 4, fontSize: 13, lineHeight: 19, color: '#496357' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#173C2C' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5E2DB',
    backgroundColor: '#FFFFFF',
  },
  categorySelected: { backgroundColor: '#1F6B45', borderColor: '#1F6B45' },
  categoryText: { fontSize: 12, fontWeight: '800', color: '#365648' },
  categoryTextSelected: { color: '#FFFFFF' },
  fieldBlock: { gap: 6 },
  label: { fontSize: 12, fontWeight: '900', color: '#365648' },
  input: {
    borderWidth: 1,
    borderColor: '#CFDDD5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: '#213D31',
  },
  messageInput: { minHeight: 96, textAlignVertical: 'top' },
  safetyText: { fontSize: 11, lineHeight: 16, color: '#7B6257' },
  primary: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#1F6B45',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  errorCard: {
    flexDirection: 'row',
    gap: 8,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#FFF0EE',
    borderWidth: 1,
    borderColor: '#F0C8C3',
  },
  errorText: { flex: 1, color: '#87352F', fontSize: 12, lineHeight: 18 },
  successCard: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#E9F6EE',
    borderWidth: 1,
    borderColor: '#BFDCCB',
  },
  successText: { flex: 1, color: '#1F6B45', fontWeight: '900' },
  resultCard: {
    gap: 7,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E2DB',
  },
  resultEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#527062',
  },
  resultTitle: { fontSize: 15, fontWeight: '900', color: '#173C2C' },
  resultBody: { fontSize: 12.5, lineHeight: 18, color: '#52645A' },
  resultMeta: { fontSize: 12, fontWeight: '800', color: '#496357' },
  caseCode: { fontSize: 20, fontWeight: '900', color: '#173C2C' },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E9F4EE',
  },
  secondaryButtonText: { color: '#1F6B45', fontWeight: '900', fontSize: 11 },
  caseHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  caseHint: { marginTop: 3, fontSize: 10.5, color: '#78877F' },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8 },
  refreshText: { fontSize: 10.5, fontWeight: '900', color: '#1F6B45' },
  emptyText: { fontSize: 12, color: '#718077' },
  caseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE7E1',
  },
  caseRowCode: { fontSize: 12, fontWeight: '900', color: '#1F6B45' },
  caseRowTitle: { marginTop: 2, fontSize: 13.5, fontWeight: '800', color: '#243D32' },
  caseIncident: { marginTop: 2, fontSize: 10, color: '#7C6B2C' },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF4F0',
  },
  statusBadgeText: { fontSize: 9.5, fontWeight: '900', color: '#355C49' },
});
