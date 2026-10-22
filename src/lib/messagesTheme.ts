/**
 * BUKLOD Messages theme — extends global palette with conversation-specific roles.
 */

import {
  BUKLOD_PALETTE_PRESETS,
  getBuklodGlobalTheme,
  getPaletteSource,
  type BuklodPaletteId,
  type BuklodThemePreferenceId,
  type BuklodThemeRoles,
} from '@/lib/buklodTheme';
import type { ColorSchemeName } from 'react-native';

/** Messages-only palette override (never "system"). */
export type MessagesPaletteId = BuklodPaletteId;

/** Messages appearance preference — followGlobal or a concrete override. */
export type MessagesThemePreferenceId =
  | 'followGlobal'
  | MessagesPaletteId;

export type MessagesSpecificRoles = {
  bubbleSent: string;
  bubbleReceived: string;
  textOnAccent: string;
  textOnSentBubble: string;
  accentMuted: string;
  composerSurface: string;
  borderSubtle: string;
  unreadBadgeText: string;
  reactionSurface: string;
  reactionStamp: string;
  callControlSurface: string;
  fabBg: string;
  fabText: string;
  fabIconBackdrop: string;
  filterPillActive: string;
  filterPillActiveText: string;
  tabActive: string;
  sentIndicator: string;
  deliveryFailed: string;
  fileChipOwn: string;
  fileChipOther: string;
  noteSurface: string;
  attachPopover: string;
  pickerSheet: string;
  pickerTabTrack: string;
  pickerTabActive: string;
};

/** Full resolved Messages theme (global + messages-specific). */
export type MessagesThemeRoles =
  BuklodThemeRoles & MessagesSpecificRoles;

export type MessagesThemePreset = {
  id: MessagesPaletteId;
  label: string;
  description: string;
  swatch: string;
  roles: MessagesThemeRoles;
};

export type MessagesPreferenceOption = {
  id: MessagesThemePreferenceId;
  label: string;
  description: string;
  swatch: string;
};

export const DEFAULT_MESSAGES_THEME_PREFERENCE: MessagesThemePreferenceId =
  'followGlobal';

export const BUKLOD_MESSAGES_THEME_STORAGE_KEY =
  'buklod_messages_theme_v1';

function buildMessagesSpecificRoles(
  paletteId: BuklodPaletteId
): MessagesSpecificRoles {
  const p = getPaletteSource(paletteId);
  const isDark =
    paletteId === 'nightPine' ||
    paletteId === 'graphite' ||
    paletteId === 'midnight';

  if (isDark) {
    switch (paletteId) {
      case 'nightPine':
        return {
          bubbleSent: '#176B2C',
          bubbleReceived: '#1C2621',
          textOnAccent: '#0A0F0D',
          textOnSentBubble: '#FFFFFF',
          accentMuted: '#1A3D28',
          composerSurface: '#121A16',
          borderSubtle: '#1F2925',
          unreadBadgeText: '#0A0F0D',
          reactionSurface: '#121A16',
          reactionStamp: '#243028',
          callControlSurface: '#1A3D28',
          fabBg: '#45D17A',
          fabText: '#0A0F0D',
          fabIconBackdrop: 'rgba(10, 15, 13, 0.22)',
          filterPillActive: '#1A3D28',
          filterPillActiveText: '#45D17A',
          tabActive: '#1A3D28',
          sentIndicator: '#45D17A',
          deliveryFailed: '#E85D5D',
          fileChipOwn: 'rgba(255,255,255,0.13)',
          fileChipOther: '#1A3D28',
          noteSurface: '#1A3D28',
          attachPopover: '#121A16',
          pickerSheet: '#121A16',
          pickerTabTrack: '#1C2621',
          pickerTabActive: '#1A3D28',
        };
      case 'graphite':
        return {
          bubbleSent: '#2A3D32',
          bubbleReceived: '#252525',
          textOnAccent: '#121212',
          textOnSentBubble: '#F5F5F5',
          accentMuted: '#2A3530',
          composerSurface: '#181818',
          borderSubtle: '#282828',
          unreadBadgeText: '#121212',
          reactionSurface: '#1E1E1E',
          reactionStamp: '#2C2C2C',
          callControlSurface: '#2A3530',
          fabBg: '#6B9E78',
          fabText: '#121212',
          fabIconBackdrop: 'rgba(0, 0, 0, 0.24)',
          filterPillActive: '#2A3530',
          filterPillActiveText: '#6B9E78',
          tabActive: '#2A3530',
          sentIndicator: '#6B9E78',
          deliveryFailed: '#D96A6A',
          fileChipOwn: 'rgba(255,255,255,0.1)',
          fileChipOther: '#2A3530',
          noteSurface: '#252525',
          attachPopover: '#1E1E1E',
          pickerSheet: '#181818',
          pickerTabTrack: '#222222',
          pickerTabActive: '#2A3530',
        };
      case 'midnight':
        return {
          bubbleSent: '#1F4A78',
          bubbleReceived: '#161B22',
          textOnAccent: '#0D1117',
          textOnSentBubble: '#E6EDF3',
          accentMuted: '#1C2836',
          composerSurface: '#12171E',
          borderSubtle: '#21262D',
          unreadBadgeText: '#0D1117',
          reactionSurface: '#12171E',
          reactionStamp: '#21262D',
          callControlSurface: '#1C2836',
          fabBg: '#58A6FF',
          fabText: '#0D1117',
          fabIconBackdrop: 'rgba(0, 0, 0, 0.24)',
          filterPillActive: '#1C2836',
          filterPillActiveText: '#58A6FF',
          tabActive: '#1C2836',
          sentIndicator: '#58A6FF',
          deliveryFailed: '#E85D5D',
          fileChipOwn: 'rgba(255,255,255,0.12)',
          fileChipOther: '#1C2836',
          noteSurface: '#1C2836',
          attachPopover: '#12171E',
          pickerSheet: '#12171E',
          pickerTabTrack: '#161B22',
          pickerTabActive: '#1C2836',
        };
      default: {
        const _exhaustive: never = paletteId;
        return _exhaustive;
      }
    }
  }

  // Light / soft palettes — coordinated bubble + composer per palette
  const sentBubble = p.accent;
  const receivedBubble = p.surface;
  const onSent = p.white;

  return {
    bubbleSent: sentBubble,
    bubbleReceived: receivedBubble,
    textOnAccent: p.white,
    textOnSentBubble: onSent,
    accentMuted: p.accentSoft,
    composerSurface: p.surface,
    borderSubtle: p.border,
    unreadBadgeText: p.white,
    reactionSurface: p.surface,
    reactionStamp: p.accentSoft,
    callControlSurface: p.accentSoft,
    fabBg: p.accent,
    fabText: p.white,
    fabIconBackdrop: 'rgba(255, 255, 255, 0.22)',
    filterPillActive: p.accentSoft,
    filterPillActiveText: p.accent,
    tabActive: p.accentSoft,
    sentIndicator: p.accent,
    deliveryFailed: p.danger,
    fileChipOwn: 'rgba(255,255,255,0.2)',
    fileChipOther: p.accentSoft,
    noteSurface: p.accentSoft,
    attachPopover: p.surface,
    pickerSheet: p.surfaceElevated,
    pickerTabTrack: p.inputSurface,
    pickerTabActive: p.accentSoft,
  };
}

export function buildMessagesThemeRoles(
  paletteId: BuklodPaletteId
): MessagesThemeRoles {
  const globalRoles =
    BUKLOD_PALETTE_PRESETS[paletteId].roles;
  const messagesSpecific =
    buildMessagesSpecificRoles(paletteId);

  return {
    ...globalRoles,
    ...messagesSpecific,
  };
}

const MESSAGES_PALETTE_ORDER: MessagesPaletteId[] = [
  'cloudWhite',
  'softMint',
  'sage',
  'sky',
  'lavenderMist',
  'sandCream',
  'softRose',
  'nightPine',
  'graphite',
  'midnight',
];

export const MESSAGES_PALETTE_PRESETS: Record<
  MessagesPaletteId,
  MessagesThemePreset
> = Object.fromEntries(
  MESSAGES_PALETTE_ORDER.map(id => [
    id,
    {
      id,
      label:
        id === 'cloudWhite'
          ? 'Cloud'
          : id === 'softMint'
            ? 'Mint'
            : id === 'lavenderMist'
              ? 'Lavender'
              : id === 'sandCream'
                ? 'Cream'
                : BUKLOD_PALETTE_PRESETS[id].label,
      description:
        BUKLOD_PALETTE_PRESETS[id].description,
      swatch: BUKLOD_PALETTE_PRESETS[id].swatch,
      roles: buildMessagesThemeRoles(id),
    },
  ])
) as Record<MessagesPaletteId, MessagesThemePreset>;

export const MESSAGES_PREFERENCE_OPTIONS: MessagesPreferenceOption[] =
  [
    {
      id: 'followGlobal',
      label: 'Follow BUKLOD Theme',
      description:
        'Use your global BUKLOD appearance setting',
      swatch: '#697784',
    },
    ...MESSAGES_PALETTE_ORDER.map(id => {
      const preset = MESSAGES_PALETTE_PRESETS[id];

      return {
        id: preset.id as MessagesThemePreferenceId,
        label: preset.label,
        description: preset.description,
        swatch: preset.swatch,
      };
    }),
  ];

export function isMessagesThemePreferenceId(
  value: string | null | undefined
): value is MessagesThemePreferenceId {
  if (!value) {
    return false;
  }

  if (value === 'followGlobal') {
    return true;
  }

  return value in MESSAGES_PALETTE_PRESETS;
}

export function resolveMessagesPaletteId(
  messagesPreference: MessagesThemePreferenceId,
  globalPreference: BuklodThemePreferenceId,
  colorScheme?: ColorSchemeName | null
): BuklodPaletteId {
  if (messagesPreference !== 'followGlobal') {
    return messagesPreference;
  }

  return getBuklodGlobalTheme(
    globalPreference,
    colorScheme
  ).paletteId;
}

export function resolveMessagesTheme(
  messagesPreference: MessagesThemePreferenceId,
  globalPreference: BuklodThemePreferenceId,
  colorScheme?: ColorSchemeName | null
): {
  messagesPreference: MessagesThemePreferenceId;
  effectivePaletteId: BuklodPaletteId;
  followingGlobal: boolean;
  roles: MessagesThemeRoles;
} {
  const followingGlobal =
    messagesPreference === 'followGlobal';
  const effectivePaletteId =
    resolveMessagesPaletteId(
      messagesPreference,
      globalPreference,
      colorScheme
    );

  return {
    messagesPreference,
    effectivePaletteId,
    followingGlobal,
    roles: buildMessagesThemeRoles(
      effectivePaletteId
    ),
  };
}
