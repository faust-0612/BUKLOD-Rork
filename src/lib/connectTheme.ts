/**
 * BUKLOD Messages theme — compatibility re-exports.
 * New code should import from @/lib/messagesTheme and @/lib/buklodTheme.
 */

export {
  buklodMotion as connectAnimation,
} from '@/lib/buklodTheme';

export {
  buildMessagesThemeRoles,
  MESSAGES_PALETTE_PRESETS,
  MESSAGES_PREFERENCE_OPTIONS,
  resolveMessagesTheme,
  type MessagesPaletteId,
  type MessagesSpecificRoles,
  type MessagesThemePreferenceId,
  type MessagesThemePreset,
  type MessagesThemeRoles,
} from '@/lib/messagesTheme';

import {
  MESSAGES_PALETTE_PRESETS,
  type MessagesPaletteId,
  type MessagesThemePreset,
  type MessagesThemeRoles,
} from '@/lib/messagesTheme';

/** @deprecated Use MessagesPaletteId */
export type ConnectThemeId = MessagesPaletteId;

/** @deprecated Use MessagesThemeRoles */
export type ConnectThemeRoles = MessagesThemeRoles;

/** @deprecated Use MessagesThemePreset */
export type ConnectThemePreset = MessagesThemePreset;

export const DEFAULT_CONNECT_THEME_ID: ConnectThemeId =
  'nightPine';

/** @deprecated Use BUKLOD_MESSAGES_THEME_STORAGE_KEY */
export const CONNECT_THEME_STORAGE_KEY =
  'buklod_messages_theme_v1';

export const CONNECT_THEME_PRESETS =
  MESSAGES_PALETTE_PRESETS;

export const CONNECT_THEME_LIST: ConnectThemePreset[] =
  Object.values(CONNECT_THEME_PRESETS);

export function getConnectTheme(
  id?: string | null
): ConnectThemePreset {
  const key = String(id ?? '') as ConnectThemeId;

  if (key in CONNECT_THEME_PRESETS) {
    return CONNECT_THEME_PRESETS[key];
  }

  return CONNECT_THEME_PRESETS.nightPine;
}

export function isConnectThemeId(
  value: string | null | undefined
): value is ConnectThemeId {
  return (
    !!value &&
    value in CONNECT_THEME_PRESETS
  );
}

export const connectTypography = {
  rowTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 20,
  },
  rowPreview: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 19,
  },
  rowTime: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  quickContactName: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 14,
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: '800' as const,
    lineHeight: 18,
  },
  searchPlaceholder: {
    fontSize: 15,
    fontWeight: '400' as const,
  },
  filterPill: {
    fontSize: 13,
    fontWeight: '700' as const,
    lineHeight: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    lineHeight: 21,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 15,
  },
  bubbleBody: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 23,
  },
  bubbleMeta: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
  },
  composerInput: {
    fontSize: 15.5,
    fontWeight: '400' as const,
  },
};

export type CommunityFilterKey =
  | 'all'
  | 'organization'
  | 'sub_org'
  | 'cluster'
  | 'location';

export const COMMUNITY_FILTER_LABELS: Record<
  CommunityFilterKey,
  string
> = {
  all: 'All',
  organization: 'Organization',
  sub_org: 'Sub-organization',
  cluster: 'Cluster',
  location: 'Location',
};

export const connectSpacing = {
  screenHorizontal: 16,
  rowVertical: 10,
  rowGap: 12,
  sectionGap: 8,
  bottomNavHeight: 48,
  fabAboveSwitcher: 12,
  fabClearance: 68,
};

export const connectRadii = {
  search: 14,
  row: 0,
  pill: 999,
  fab: 28,
  filterPill: 20,
  badge: 10,
  bubble: 20,
  bubbleTail: 6,
  composer: 22,
  headerButton: 21,
  attach: 14,
};
