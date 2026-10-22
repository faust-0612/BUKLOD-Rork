import { supabase } from '@/lib/supabase';

export type FocusAppPlatformAppStats = {
  focus_app_code: string;
  display_name: string;
  annual_amount_php: number;
  is_active: boolean;
  active_subscriptions: number;
  pending_payments: number;
  total_admins: number;
  approved_payments_30d: number;
};

export type FocusAppPlatformStats = {
  apps: FocusAppPlatformAppStats[];
  total_active_subscriptions: number;
  total_pending_payments: number;
  total_focus_app_admins: number;
  generated_at: string;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAppStats(raw: unknown): FocusAppPlatformAppStats | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const code = String(row.focus_app_code ?? '').trim();

  if (!code) {
    return null;
  }

  return {
    focus_app_code: code,
    display_name: String(row.display_name ?? code),
    annual_amount_php: toNumber(row.annual_amount_php, 499),
    is_active: row.is_active !== false,
    active_subscriptions: toNumber(row.active_subscriptions),
    pending_payments: toNumber(row.pending_payments),
    total_admins: toNumber(row.total_admins),
    approved_payments_30d: toNumber(row.approved_payments_30d),
  };
}

function parsePlatformStats(raw: unknown): FocusAppPlatformStats | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const apps = Array.isArray(row.apps) ? row.apps : [];

  return {
    apps: apps
      .map(parseAppStats)
      .filter(Boolean) as FocusAppPlatformAppStats[],
    total_active_subscriptions: toNumber(row.total_active_subscriptions),
    total_pending_payments: toNumber(row.total_pending_payments),
    total_focus_app_admins: toNumber(row.total_focus_app_admins),
    generated_at: String(row.generated_at ?? new Date().toISOString()),
  };
}

export async function fetchFocusAppPlatformStats(): Promise<FocusAppPlatformStats | null> {
  const { data, error } = await supabase.rpc(
    'admin_buklod_focus_app_platform_stats_v1'
  );

  if (error) {
    throw error;
  }

  return parsePlatformStats(data);
}

export const FOCUS_APP_ADMIN_ICONS: Record<string, string> = {
  report: 'file-chart-outline',
  faculty: 'school-outline',
  local: 'bank-outline',
  family: 'home-heart',
  palengke: 'store-search-outline',
  health: 'heart-pulse',
  commercial: 'briefcase-outline',
  attendance: 'clipboard-check-outline',
  giving: 'hand-heart-outline',
};
