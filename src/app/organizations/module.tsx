import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { colors } from '@/lib/theme';
import {
  organizationScopeParams,
} from '@/lib/buklodOrganization';
import {
  BUKLOD_ORGANIZATION_MODULE_REGISTRY,
  type BuklodOrganizationModuleId,
} from '@/lib/buklodOrganizationWorkspace';
import {
  verifyBuklodOrganizationModuleAccess,
} from '@/lib/buklodOrganizationWorkspaceRuntime';
import {
  buklodReportLandingPath,
} from '@/lib/buklodReportRoutes';
import {
  enterScopedWorkspace,
} from '@/lib/buklodScopeRoute';
import { openBuklodQuizFromMain } from '@/lib/buklodQuizEntry';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
} from '@/lib/buklodUserFeedback';
import { useBuklodFeedback } from '@/providers/BuklodFeedbackProvider';

function first(value: string | string[] | undefined) {
  return Array.isArray(value)
    ? String(value[0] ?? '').trim()
    : String(value ?? '').trim();
}

function readModule(
  value: string | string[] | undefined,
): BuklodOrganizationModuleId | null {
  const id = first(value) as BuklodOrganizationModuleId;
  return BUKLOD_ORGANIZATION_MODULE_REGISTRY.some(
    module => module.id === id,
  )
    ? id
    : null;
}

export default function OrganizationModuleGatewayScreen() {
  const params = useLocalSearchParams<{
    scopeId?: string | string[];
    scope_id?: string | string[];
    organization?: string | string[];
    module?: string | string[];
  }>();
  const { selectScope } = useBuklodScope();
  const { showFeedback } = useBuklodFeedback();
  const scopeId =
    first(params.scopeId) ||
    first(params.scope_id) ||
    first(params.organization);
  const moduleId = readModule(params.module);

  const [status, setStatus] = useState<
    'checking' | 'blocked' | 'opening' | 'error'
  >('checking');
  const [message, setMessage] = useState(
    'Checking Organization access…',
  );
  const startedRef = useRef(false);

  const backToOrganization = useCallback(() => {
    if (!scopeId) {
      router.replace('/(tabs)/buklod' as any);
      return;
    }

    void enterScopedWorkspace(
      selectScope,
      scopeId,
      {
        section: 'home',
        fromPortal: true,
      },
    ).catch(() => {
      router.replace('/(tabs)/buklod' as any);
    });
  }, [scopeId, selectScope]);

  const open = useCallback(async () => {
    if (!scopeId || !moduleId) {
      setStatus('blocked');
      setMessage(
        'This Organization module link is incomplete. Return to the Organization and open it again.',
      );
      return;
    }

    setStatus('checking');
    setMessage('Checking Organization access…');

    try {
      const access =
        await verifyBuklodOrganizationModuleAccess({
          scopeId,
          moduleId,
        });

      if (!access.allowed) {
        setStatus('blocked');
        setMessage(access.reason);
        void trackBuklodFeedbackEvent({
          event: 'error_shown',
          category: 'PERMISSION_ERROR',
          supportCode: 'ORG-403',
          route: '/organizations/module',
          feature: `Organization:${moduleId}`,
          outcome: 'module_access_blocked',
          metadata: {
            organization_id: scopeId,
            module_id: moduleId,
          },
        });
        return;
      }

      setStatus('opening');
      setMessage(
        `Opening ${
          BUKLOD_ORGANIZATION_MODULE_REGISTRY.find(
            item => item.id === moduleId,
          )?.displayName ?? 'Organization module'
        }…`,
      );

      if (moduleId === 'overview') {
        await enterScopedWorkspace(
          selectScope,
          scopeId,
          { section: 'home', fromPortal: true },
        );
        return;
      }

      if (moduleId === 'community') {
        await enterScopedWorkspace(
          selectScope,
          scopeId,
          { section: 'community', fromPortal: true },
        );
        return;
      }

      if (moduleId === 'connect') {
        await enterScopedWorkspace(
          selectScope,
          scopeId,
          { section: 'connect', fromPortal: true },
        );
        return;
      }

      if (moduleId === 'announcements') {
        router.replace({
          pathname: '/organizations/announcements' as any,
          params: organizationScopeParams(scopeId),
        });
        return;
      }

      if (moduleId === 'members') {
        router.replace({
          pathname: '/scope/manage/members' as any,
          params: organizationScopeParams(scopeId),
        });
        return;
      }

      if (moduleId === 'units') {
        router.replace({
          pathname: '/organizations/suborganizations' as any,
          params: organizationScopeParams(scopeId, {
            parentScopeId: scopeId,
            mode: 'units',
          }),
        });
        return;
      }

      if (moduleId === 'events') {
        router.replace({
          pathname: '/organizations/events-attendance' as any,
          params: organizationScopeParams(scopeId),
        });
        return;
      }

      if (moduleId === 'reports') {
        router.replace(buklodReportLandingPath(scopeId) as any);
        return;
      }

      if (moduleId === 'classroom') {
        router.replace({
          pathname: '/profile/buklod-classrooms' as any,
          params: {
            organization_id: scopeId,
            return_scope_id: scopeId,
            source: 'organization_workspace',
          },
        });
        return;
      }

      if (moduleId === 'quiz') {
        await openBuklodQuizFromMain({
          source: 'buklod-main-profile',
        });
        return;
      }

      if (moduleId === 'files') {
        router.replace(`/office/${encodeURIComponent(scopeId)}` as any);
        return;
      }

      if (moduleId === 'calendar') {
        router.replace({
          pathname: '/organizations/calendar' as any,
          params: organizationScopeParams(scopeId),
        });
        return;
      }

      if (moduleId === 'help') {
        router.replace({
          pathname: '/help' as any,
          params: {
            category: 'ORGANIZATION',
            organizationId: scopeId,
            moduleId: 'help',
            sourceRoute: '/scope',
            message:
              `I need help inside ${access.runtime.scope.name}.`,
          },
        });
        return;
      }

      if (moduleId === 'manage') {
        router.replace({
          pathname: '/organizations/scope-manage' as any,
          params: organizationScopeParams(scopeId, {
            organizationName: access.runtime.scope.name,
          }),
        });
        return;
      }

      setStatus('blocked');
      setMessage(
        'This Organization feature is not available yet.',
      );
    } catch (error) {
      const feedback = buildBuklodUserFeedback(
        error,
        {
          fallbackTitle: 'Organization module unavailable',
          fallbackMessage:
            "BUKLOD couldn't open this Organization module right now.",
        },
      );

      setStatus('error');
      setMessage(
        `${feedback.message} ${
          feedback.nextStep ?? ''
        }`.trim(),
      );
      showFeedback(
        {
          ...feedback,
          title: 'Organization module unavailable',
          message:
            "BUKLOD couldn't open this Organization module right now.",
          nextStep:
            'Return to the Organization and try again. If it repeats, open Need Help.',
          supportCode:
            feedback.supportCode ?? 'ORG-500',
          needsSupport: true,
        },
        {
          autoHideMs: null,
          helpParams: {
            category: 'ORGANIZATION',
            errorCode:
              feedback.supportCode ?? 'ORG-500',
            message:
              "BUKLOD couldn't open this Organization module right now.",
            sourceRoute: '/organizations/module',
            organizationId: scopeId,
            moduleId: moduleId ?? '',
          },
        },
      );
      void trackBuklodFeedbackEvent({
        event: 'action_failed',
        category: feedback.category,
        supportCode:
          feedback.supportCode ?? 'ORG-500',
        route: '/organizations/module',
        feature: `Organization:${moduleId ?? 'unknown'}`,
        outcome: 'module_open_failed',
        metadata: {
          organization_id: scopeId,
          module_id: moduleId ?? 'unknown',
        },
      });
    }
  }, [
    moduleId,
    scopeId,
    selectScope,
    showFeedback,
  ]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void open();
  }, [open]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {status === 'checking' || status === 'opening' ? (
          <ActivityIndicator
            size="large"
            color={colors.green}
          />
        ) : (
          <MaterialCommunityIcons
            name={
              status === 'blocked'
                ? 'lock-outline'
                : 'alert-circle-outline'
            }
            size={38}
            color={colors.greenDark}
          />
        )}

        <Text style={styles.title}>
          {status === 'blocked'
            ? 'Feature unavailable'
            : status === 'error'
              ? 'Could not open feature'
              : 'Organization Workspace'}
        </Text>
        <Text style={styles.message}>
          {message}
        </Text>

        {(status === 'blocked' || status === 'error') && (
          <View style={styles.actions}>
            <Pressable
              onPress={backToOrganization}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>
                BACK TO ORGANIZATION
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/help' as any,
                  params: {
                    category: 'ORGANIZATION',
                    organizationId: scopeId,
                    moduleId: moduleId ?? '',
                    sourceRoute:
                      '/organizations/module',
                    message,
                    errorCode:
                      status === 'blocked'
                        ? 'ORG-403'
                        : 'ORG-500',
                  },
                })
              }
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>
                NEED HELP?
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 22,
    alignItems: 'center',
  },
  title: {
    marginTop: 12,
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    marginTop: 18,
    gap: 9,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  secondary: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
});
