import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type FacultyLauncherAccess = {
  show_launcher: boolean;
  has_faculty_entitlement: boolean;
  has_faculty_assignment: boolean;
  has_student_enrollment: boolean;
  dual_role: boolean;
  default_view: 'FACULTY' | 'STUDENT' | null;
  faculty_pricing: {
    monthly_php: number;
    monthly_months: number;
    yearly_php: number;
    yearly_months: number;
    included_apps: string[];
  };
};

const EMPTY_ACCESS: FacultyLauncherAccess = {
  show_launcher: false,
  has_faculty_entitlement: false,
  has_faculty_assignment: false,
  has_student_enrollment: false,
  dual_role: false,
  default_view: null,
  faculty_pricing: {
    monthly_php: 299,
    monthly_months: 1,
    yearly_php: 1999,
    yearly_months: 12,
    included_apps: ['classroom', 'attendance', 'quiz'],
  },
};

export function useFacultyEntitlement() {
  const { user } = useAuth();
  const [access, setAccess] = useState<FacultyLauncherAccess>(EMPTY_ACCESS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setAccess(EMPTY_ACCESS);
      setError(null);
      setLoading(false);
      return EMPTY_ACCESS;
    }

    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await (supabase as any).rpc(
      'buklod_my_classroom_launcher_access_v1'
    );

    if (rpcError) {
      setAccess(EMPTY_ACCESS);
      setError(rpcError.message || 'Could not verify BUKLOD Faculty access.');
      setLoading(false);
      return EMPTY_ACCESS;
    }

    const next = {
      ...EMPTY_ACCESS,
      ...(data ?? {}),
      faculty_pricing: {
        ...EMPTY_ACCESS.faculty_pricing,
        ...((data ?? {}).faculty_pricing ?? {}),
      },
    } as FacultyLauncherAccess;

    setAccess(next);
    setLoading(false);
    return next;
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    ...access,
    loading,
    error,
    refresh,
  };
}
