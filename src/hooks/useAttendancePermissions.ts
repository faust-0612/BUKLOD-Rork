import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { scopeHasRole } from '@/lib/buklodAccess';
import type { BuklodScope } from '@/lib/buklodScope';
import { supabase } from '@/lib/supabase';

type AttendanceEventRef = {
  created_by?: string | null;
};

export function useAttendancePermissions(
  workspaceScope: BuklodScope | null
) {
  const { user } = useAuth();
  const { isAdmin } = useBuklodAccess();
  const [isOperator, setIsOperator] = useState(false);

  const userId = user?.id ?? '';

  useEffect(() => {
    const scopeId = workspaceScope?.scope_id;

    if (!scopeId || !userId) {
      setIsOperator(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from('attendance_scope_operators')
        .select('scope_id')
        .eq('scope_id', scopeId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (!cancelled) {
        setIsOperator(!error && Boolean(data));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceScope?.scope_id, userId]);

  const canOperateScope = useMemo(
    () =>
      isAdmin ||
      isOperator ||
      Boolean(workspaceScope?.is_admin) ||
      ['attendance_admin', 'admin', 'org_admin', 'cluster_admin', 'sub_org_admin']
        .some(role => scopeHasRole(workspaceScope, role)),
    [isAdmin, isOperator, workspaceScope]
  );

  const canManageEvent = useCallback(
    (event: AttendanceEventRef | null | undefined) => {
      if (!userId) {
        return false;
      }

      if (canOperateScope) {
        return true;
      }

      return (
        String(event?.created_by ?? '').trim() === userId
      );
    },
    [canOperateScope, userId]
  );

  return {
    canOperateScope,
    canManageEvent,
    isOperator,
  };
}
