import {
  DEFAULT_DASHBOARD_THEME,
  type DashboardTheme,
} from '@/components/BuklodDashboardCustomizer';
import { supabase } from '@/lib/supabase';

type ThemeRow = {
  background_color?: string | null;
  background_image?: string | null;
  card_color?: string | null;
  accent_color?: string | null;
  text_color?: string | null;
};

function fromRow(
  row?: ThemeRow | null
): DashboardTheme {
  return {
    backgroundColor:
      row?.background_color ||
      DEFAULT_DASHBOARD_THEME.backgroundColor,
    backgroundImage:
      row?.background_image || '',
    cardColor:
      row?.card_color ||
      DEFAULT_DASHBOARD_THEME.cardColor,
    accentColor:
      row?.accent_color ||
      DEFAULT_DASHBOARD_THEME.accentColor,
    textColor:
      row?.text_color ||
      DEFAULT_DASHBOARD_THEME.textColor,
  };
}

function toRow(
  theme: DashboardTheme
) {
  return {
    background_color:
      theme.backgroundColor,
    background_image:
      theme.backgroundImage || null,
    card_color:
      theme.cardColor,
    accent_color:
      theme.accentColor,
    text_color:
      theme.textColor,
  };
}

export async function loadScopeDashboardTheme(
  scopeId: string
): Promise<DashboardTheme> {
  const { data, error } =
    await (supabase as any)
      .from('buklod_dashboard_themes')
      .select(
        'background_color,background_image,card_color,accent_color,text_color'
      )
      .eq('target_kind', 'SCOPE')
      .eq('scope_id', scopeId)
      .maybeSingle();

  if (error) throw error;

  return fromRow(data);
}

export async function saveScopeDashboardTheme(
  scopeId: string,
  theme: DashboardTheme
): Promise<void> {
  const { error } =
    await (supabase as any)
      .from('buklod_dashboard_themes')
      .upsert(
        {
          target_kind: 'SCOPE',
          scope_id: scopeId,
          owner_user_id: null,
          ...toRow(theme),
        },
        {
          onConflict: 'scope_id',
        }
      );

  if (error) throw error;
}

export async function loadProfileDashboardTheme(
  userId: string
): Promise<DashboardTheme> {
  const { data, error } =
    await (supabase as any)
      .from('buklod_dashboard_themes')
      .select(
        'background_color,background_image,card_color,accent_color,text_color'
      )
      .eq('target_kind', 'PROFILE')
      .eq('owner_user_id', userId)
      .maybeSingle();

  if (error) throw error;

  return fromRow(data);
}

export async function saveProfileDashboardTheme(
  userId: string,
  theme: DashboardTheme
): Promise<void> {
  const { error } =
    await (supabase as any)
      .from('buklod_dashboard_themes')
      .upsert(
        {
          target_kind: 'PROFILE',
          scope_id: null,
          owner_user_id: userId,
          ...toRow(theme),
        },
        {
          onConflict: 'owner_user_id',
        }
      );

  if (error) throw error;
}