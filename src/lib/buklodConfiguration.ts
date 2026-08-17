import { supabase } from '@/lib/supabase';

export type BuklodConfigItemType =
  | 'MODULE'
  | 'FIELD'
  | 'OPTION'
  | 'WORKFLOW'
  | 'LABEL'
  | 'LINK'
  | 'STRING'
  | 'DESIGN_TOKEN'
  | 'FORMAT';

export async function getBuklodConfig(
  itemType: BuklodConfigItemType,
  itemKey: string,
  options?: {
    scopeType?: string | null;
    scopeId?: string | null;
    locale?: string | null;
  }
): Promise<Record<string, unknown> | null> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_config_get_v1',
    {
      p_item_type: itemType,
      p_item_key: itemKey,
      p_scope_type: options?.scopeType ?? null,
      p_scope_id: options?.scopeId ?? null,
      p_locale: options?.locale ?? 'default',
    }
  );

  if (error) {
    console.warn(
      'BUKLOD config lookup failed:',
      error.message
    );
    return null;
  }

  return data && typeof data === 'object'
    ? data
    : null;
}

export async function getBuklodString(
  key: string,
  fallback: string,
  options?: {
    scopeType?: string | null;
    scopeId?: string | null;
    locale?: string | null;
  }
): Promise<string> {
  const value = await getBuklodConfig(
    'STRING',
    key,
    options
  );

  return typeof value?.string === 'string'
    ? value.string
    : fallback;
}

export async function getBuklodLink(
  key: string,
  fallback: string,
  options?: {
    scopeType?: string | null;
    scopeId?: string | null;
  }
): Promise<string> {
  const value = await getBuklodConfig(
    'LINK',
    key,
    options
  );

  return typeof value?.string === 'string'
    ? value.string
    : fallback;
}

export async function isBuklodFeatureEnabled(
  flagKey: string,
  options?: {
    scopeType?: string | null;
    scopeId?: string | null;
  }
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_feature_enabled_v1',
    {
      p_flag_key: flagKey,
      p_scope_type: options?.scopeType ?? null,
      p_scope_id: options?.scopeId ?? null,
    }
  );

  if (error) {
    console.warn(
      'BUKLOD feature flag lookup failed:',
      error.message
    );
    return false;
  }

  return data === true;
}