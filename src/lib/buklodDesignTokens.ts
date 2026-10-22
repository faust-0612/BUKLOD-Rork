import { supabase } from '@/lib/supabase';

export type BuklodDesignTokens = Record<
  string,
  string | number
>;

export const BUKLOD_DESIGN_DEFAULTS: BuklodDesignTokens = {
  'SCREEN.PADDING_HORIZONTAL': 12,
  'SCREEN.PADDING_TOP': 10,
  'SCREEN.PADDING_BOTTOM': 18,
  'SCREEN.SECTION_GAP': 10,
  'CARD.PADDING_HORIZONTAL': 12,
  'CARD.PADDING_VERTICAL': 10,
  'CARD.RADIUS': 14,
  'CARD.GAP': 8,
  'LIST.ROW_MIN_HEIGHT': 56,
  'TEXT.BODY_SIZE': 16,
  'TEXT.SECONDARY_SIZE': 14,
  'TEXT.LABEL_SIZE': 14,
  'TEXT.BUTTON_SIZE': 16,
  'TEXT.HEADING_SIZE': 23,
  'TEXT.LINE_HEIGHT': 22,
  'TEXT.FONT_FAMILY': 'System',
  'TEXT.FONT_WEIGHT': '400',
  'BUTTON.MIN_HEIGHT': 46,
  'INPUT.MIN_HEIGHT': 46,
  'COLOR.BACKGROUND': '#F5F7F6',
  'COLOR.CARD': '#FFFFFF',
  'COLOR.TEXT': '#17231D',
  'COLOR.MUTED': '#66736C',
  'COLOR.PRIMARY': '#275D45',
  'COLOR.BORDER': '#DDE5E0',
  'FORMAT.CARD_DENSITY': 'COMPACT',
};

export async function loadBuklodDesignTokens(
  scopeType?: string | null,
  scopeId?: string | null
): Promise<BuklodDesignTokens> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_design_tokens_v1',
    {
      p_scope_type: scopeType ?? null,
      p_scope_id: scopeId ?? null,
    }
  );

  if (error) {
    console.warn(
      'BUKLOD design token load failed:',
      error.message
    );
    return { ...BUKLOD_DESIGN_DEFAULTS };
  }

  const next: BuklodDesignTokens = {
    ...BUKLOD_DESIGN_DEFAULTS,
  };

  for (const row of Array.isArray(data) ? data : []) {
    const key = String(row?.token_key ?? '');
    const value = row?.value;

    if (!key || !value || typeof value !== 'object') {
      continue;
    }

    if (typeof value.number === 'number') {
      next[key] = value.number;
    } else if (typeof value.string === 'string') {
      next[key] = value.string;
    }
  }

  return next;
}