import { useLocalSearchParams } from 'expo-router';

import {
  pickAttendanceWorkspaceScopeId,
  readScopeIdFromParams,
} from '@/lib/buklodScopeManage';
import { useResolvedScope } from '@/hooks/useResolvedScope';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

export function useAttendanceWorkspaceScope() {
  const params = useLocalSearchParams();
  const routeScopeId = readScopeIdFromParams(
    params as Record<string, unknown>
  );
  const { activeScope, scopes } = useBuklodScope();
  const workspaceScopeId =
    routeScopeId ||
    pickAttendanceWorkspaceScopeId(scopes, {
      scopeId: routeScopeId,
      activeScope,
    });

  const resolution = useResolvedScope({
    routeScopeId: workspaceScopeId || null,
    syncActiveScope: true,
  });

  const workspaceScope =
    resolution.scope &&
    (resolution.scope.scope_type === 'ORGANIZATION' ||
      resolution.scope.scope_type === 'CLUSTER')
      ? resolution.scope
      : scopes.find(
          (scope) =>
            scope.scope_id === workspaceScopeId &&
            (scope.scope_type === 'ORGANIZATION' ||
              scope.scope_type === 'CLUSTER'),
        ) ??
        resolution.scope ??
        activeScope;

  return {
    workspaceScope,
    access: resolution.access,
    scopesLoading: resolution.scope === null && resolution.access === 'loading',
    message: resolution.message,
    refresh: resolution.refresh,
  };
}
