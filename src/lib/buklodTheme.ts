/**
 * Global BUKLOD design system — semantic roles, palettes, and resolution.
 * App-wide appearance layer; Messages extends via messagesTheme.ts.
 */

import type { ColorSchemeName } from 'react-native';

/** User-facing global appearance preference (includes system/auto). */
export type BuklodThemePreferenceId =
  | 'system'
  | 'cloudWhite'
  | 'softMint'
  | 'sage'
  | 'sky'
  | 'lavenderMist'
  | 'sandCream'
  | 'lightMint'
  | 'warmSoft'
  | 'graphite'
  | 'nightPine';

/** Resolved palette id (concrete theme, never "system"). */
export type BuklodPaletteId =
  | 'cloudWhite'
  | 'softMint'
  | 'sage'
  | 'sky'
  | 'lavenderMist'
  | 'sandCream'
  | 'lightMint'
  | 'warmSoft'
  | 'graphite'
  | 'nightPine'
  | 'softRose'
  | 'midnight';

export type BuklodThemeRoles = {
  canvas: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  headerSurface: string;
  cardSurface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  border: string;
  inputSurface: string;
  buttonPrimary: string;
  buttonSecondary: string;
  unreadBadge: string;
  success: string;
  warning: string;
  danger: string;
  navBackground: string;
  navActive: string;
  navInactive: string;
  navActiveIndicator: string;
  navIconActive: string;
  navIconInactive: string;
  navLabelActive: string;
  navLabelInactive: string;
  navBorder: string;
  navShadow: string;
  white: string;
  overlay: string;
  shadow: string;
};

export type BuklodThemePreset = {
  id: BuklodPaletteId;
  label: string;
  description: string;
  swatch: string;
  roles: BuklodThemeRoles;
};

export type BuklodGlobalPreferenceOption = {
  id: BuklodThemePreferenceId;
  label: string;
  description: string;
  swatch: string;
};

export const DEFAULT_BUKLOD_THEME_PREFERENCE: BuklodThemePreferenceId =
  'system';

export const DEFAULT_BUKLOD_DARK_PALETTE: BuklodPaletteId =
  'nightPine';

export const DEFAULT_BUKLOD_LIGHT_PALETTE: BuklodPaletteId =
  'lightMint';

export const BUKLOD_GLOBAL_THEME_STORAGE_KEY =
  'buklod_global_theme_v1';

/** Legacy keys migrated on first load. */
export const LEGACY_CONNECT_THEME_STORAGE_KEY =
  'buklod_connect_messages_theme_v1';

export const LEGACY_BUKLOD_THEME_PREFERENCE_KEY =
  'buklod_theme_preference_v1';

type PaletteSource = {
  canvas: string;
  surface: string;
  surfaceElevated: string;
  headerSurface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  border: string;
  inputSurface: string;
  unreadBadge: string;
  danger: string;
  success: string;
  warning: string;
  white: string;
  overlay: string;
  shadow: string;
};

const PALETTE_SOURCES: Record<
  BuklodPaletteId,
  PaletteSource
> = {
  cloudWhite: {
    canvas: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    headerSurface: '#FFFFFF',
    textPrimary: '#1A2332',
    textSecondary: '#4A5568',
    textMuted: '#718096',
    accent: '#2563EB',
    accentSoft: '#EBF2FF',
    border: '#E2E8F0',
    inputSurface: '#F1F5F9',
    unreadBadge: '#2563EB',
    danger: '#DC2626',
    success: '#059669',
    warning: '#D97706',
    white: '#FFFFFF',
    overlay: 'rgba(26, 35, 50, 0.32)',
    shadow: '#1A2332',
  },
  softMint: {
    canvas: '#F0F7F4',
    surface: '#FFFFFF',
    surfaceElevated: '#FAFCFB',
    headerSurface: '#FAFCFB',
    textPrimary: '#1A2E24',
    textSecondary: '#4A6358',
    textMuted: '#6B8578',
    accent: '#2D8B57',
    accentSoft: '#E3F2EA',
    border: '#D4E5DC',
    inputSurface: '#F5FAF7',
    unreadBadge: '#2D8B57',
    danger: '#C9332D',
    success: '#2D8B57',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(26, 46, 36, 0.34)',
    shadow: '#1A2E24',
  },
  sage: {
    canvas: '#EFF2EE',
    surface: '#FAFBF9',
    surfaceElevated: '#FAFBF9',
    headerSurface: '#FAFBF9',
    textPrimary: '#2A3328',
    textSecondary: '#5A6556',
    textMuted: '#7A8576',
    accent: '#6B8F71',
    accentSoft: '#E4EBE5',
    border: '#D5DED6',
    inputSurface: '#F3F6F2',
    unreadBadge: '#5A7A60',
    danger: '#B85C4A',
    success: '#6B8F71',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(42, 51, 40, 0.34)',
    shadow: '#2A3328',
  },
  sky: {
    canvas: '#F0F6FC',
    surface: '#FFFFFF',
    surfaceElevated: '#FAFCFE',
    headerSurface: '#FAFCFE',
    textPrimary: '#1A2A3A',
    textSecondary: '#4A6278',
    textMuted: '#6B8298',
    accent: '#3B82C4',
    accentSoft: '#E3EEF8',
    border: '#D0DEEE',
    inputSurface: '#F5F9FD',
    unreadBadge: '#3B82C4',
    danger: '#C9332D',
    success: '#2D8B57',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(26, 42, 58, 0.34)',
    shadow: '#1A2A3A',
  },
  lavenderMist: {
    canvas: '#F5F3FA',
    surface: '#FDFCFE',
    surfaceElevated: '#FDFCFE',
    headerSurface: '#FDFCFE',
    textPrimary: '#2A2438',
    textSecondary: '#5A5268',
    textMuted: '#7A7288',
    accent: '#7C6BA8',
    accentSoft: '#EDE8F5',
    border: '#DCD4E8',
    inputSurface: '#F8F6FC',
    unreadBadge: '#7C6BA8',
    danger: '#B85C4A',
    success: '#6B8F71',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(42, 36, 56, 0.34)',
    shadow: '#2A2438',
  },
  sandCream: {
    canvas: '#FAF6F0',
    surface: '#FFFCF7',
    surfaceElevated: '#FFFCF7',
    headerSurface: '#FFFCF7',
    textPrimary: '#3A342C',
    textSecondary: '#6B6458',
    textMuted: '#8A8278',
    accent: '#A8926A',
    accentSoft: '#F0EBE2',
    border: '#E5DDD0',
    inputSurface: '#F5F0E8',
    unreadBadge: '#8A7A58',
    danger: '#B85C4A',
    success: '#6B8F71',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(58, 52, 44, 0.36)',
    shadow: '#3A342C',
  },
  nightPine: {
    canvas: '#0A0F0D',
    surface: '#1C2621',
    surfaceElevated: '#121A16',
    headerSurface: '#121A16',
    textPrimary: '#F2F6F4',
    textSecondary: '#B8C5BD',
    textMuted: '#7A8A82',
    accent: '#45D17A',
    accentSoft: '#1A3D28',
    border: '#2A3530',
    inputSurface: '#1C2621',
    unreadBadge: '#45D17A',
    danger: '#E85D5D',
    success: '#45D17A',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.55)',
    shadow: '#000000',
  },
  graphite: {
    canvas: '#121212',
    surface: '#1E1E1E',
    surfaceElevated: '#181818',
    headerSurface: '#181818',
    textPrimary: '#ECECEC',
    textSecondary: '#B0B0B0',
    textMuted: '#7A7A7A',
    accent: '#6B9E78',
    accentSoft: '#2A3530',
    border: '#333333',
    inputSurface: '#222222',
    unreadBadge: '#6B9E78',
    danger: '#D96A6A',
    success: '#6B9E78',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.62)',
    shadow: '#000000',
  },
  lightMint: {
    canvas: '#F4F9F6',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    headerSurface: '#FFFFFF',
    textPrimary: '#16202A',
    textSecondary: '#4A5A52',
    textMuted: '#697784',
    accent: '#176B2C',
    accentSoft: '#EAF5ED',
    border: '#DDE5E0',
    inputSurface: '#F8FAF9',
    unreadBadge: '#176B2C',
    danger: '#C9332D',
    success: '#176B2C',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(22, 32, 42, 0.35)',
    shadow: '#16202A',
  },
  warmSoft: {
    canvas: '#F7F3EE',
    surface: '#FFFDF9',
    surfaceElevated: '#FFFCF7',
    headerSurface: '#FFFCF7',
    textPrimary: '#2C2824',
    textSecondary: '#6B645C',
    textMuted: '#8A8278',
    accent: '#7A6B4E',
    accentSoft: '#EDE8DF',
    border: '#DDD5C8',
    inputSurface: '#F5F0E8',
    unreadBadge: '#5C6B52',
    danger: '#B85C4A',
    success: '#5C6B52',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(44, 40, 36, 0.38)',
    shadow: '#2C2824',
  },
  softRose: {
    canvas: '#FBF4F5',
    surface: '#FFFAFB',
    surfaceElevated: '#FFFAFB',
    headerSurface: '#FFFAFB',
    textPrimary: '#3A2830',
    textSecondary: '#6B5258',
    textMuted: '#8A7278',
    accent: '#C46B7A',
    accentSoft: '#F5E8EB',
    border: '#E8D4D8',
    inputSurface: '#F9F0F2',
    unreadBadge: '#C46B7A',
    danger: '#B85C4A',
    success: '#6B8F71',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(58, 40, 48, 0.34)',
    shadow: '#3A2830',
  },
  midnight: {
    canvas: '#0D1117',
    surface: '#161B22',
    surfaceElevated: '#12171E',
    headerSurface: '#12171E',
    textPrimary: '#E6EDF3',
    textSecondary: '#9BA8B4',
    textMuted: '#6E7A86',
    accent: '#58A6FF',
    accentSoft: '#1C2836',
    border: '#30363D',
    inputSurface: '#1A2128',
    unreadBadge: '#58A6FF',
    danger: '#E85D5D',
    success: '#58A6FF',
    warning: '#D98A00',
    white: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.58)',
    shadow: '#000000',
  },
};

function buildGlobalRoles(
  paletteId: BuklodPaletteId
): BuklodThemeRoles {
  const p = PALETTE_SOURCES[paletteId];

  return {
    canvas: p.canvas,
    surface: p.surface,
    surfaceElevated: p.surfaceElevated,
    surfaceMuted: p.accentSoft,
    headerSurface: p.headerSurface,
    cardSurface: p.surface,
    textPrimary: p.textPrimary,
    textSecondary: p.textSecondary,
    textMuted: p.textMuted,
    accent: p.accent,
    accentSoft: p.accentSoft,
    border: p.border,
    inputSurface: p.inputSurface,
    buttonPrimary: p.accent,
    buttonSecondary: p.accentSoft,
    unreadBadge: p.unreadBadge,
    success: p.success,
    warning: p.warning,
    danger: p.danger,
    navBackground: p.surfaceElevated,
    navActive: p.accentSoft,
    navInactive: 'transparent',
    navActiveIndicator: p.accent,
    navIconActive: p.accent,
    navIconInactive: p.textMuted,
    navLabelActive: p.accent,
    navLabelInactive: p.textMuted,
    navBorder: p.border,
    navShadow: p.shadow,
    white: p.white,
    overlay: p.overlay,
    shadow: p.shadow,
  };
}

export const BUKLOD_PALETTE_PRESETS: Record<
  BuklodPaletteId,
  BuklodThemePreset
> = {
  cloudWhite: {
    id: 'cloudWhite',
    label: 'Cloud White',
    description: 'Crisp neutral light with blue accent',
    swatch: '#2563EB',
    roles: buildGlobalRoles('cloudWhite'),
  },
  softMint: {
    id: 'softMint',
    label: 'Soft Mint',
    description: 'Gentle mint wash with fresh green accent',
    swatch: '#2D8B57',
    roles: buildGlobalRoles('softMint'),
  },
  sage: {
    id: 'sage',
    label: 'Sage',
    description: 'Earthy green-gray with calm natural tones',
    swatch: '#6B8F71',
    roles: buildGlobalRoles('sage'),
  },
  sky: {
    id: 'sky',
    label: 'Sky',
    description: 'Soft blue canvas with airy accent',
    swatch: '#3B82C4',
    roles: buildGlobalRoles('sky'),
  },
  lavenderMist: {
    id: 'lavenderMist',
    label: 'Lavender Mist',
    description: 'Muted lavender with soft purple accent',
    swatch: '#7C6BA8',
    roles: buildGlobalRoles('lavenderMist'),
  },
  sandCream: {
    id: 'sandCream',
    label: 'Sand / Cream',
    description: 'Warm cream canvas with sand accent',
    swatch: '#A8926A',
    roles: buildGlobalRoles('sandCream'),
  },
  nightPine: {
    id: 'nightPine',
    label: 'Night Pine',
    description: 'Dark pine with luminous BUKLOD green',
    swatch: '#45D17A',
    roles: buildGlobalRoles('nightPine'),
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite',
    description: 'Charcoal neutral with restrained accent',
    swatch: '#6B9E78',
    roles: buildGlobalRoles('graphite'),
  },
  lightMint: {
    id: 'lightMint',
    label: 'Light Mint',
    description: 'Fresh light background with mint accents',
    swatch: '#176B2C',
    roles: buildGlobalRoles('lightMint'),
  },
  warmSoft: {
    id: 'warmSoft',
    label: 'Warm Light',
    description: 'Warm neutral with muted complementary accent',
    swatch: '#5C6B52',
    roles: buildGlobalRoles('warmSoft'),
  },
  softRose: {
    id: 'softRose',
    label: 'Soft Rose',
    description: 'Blush light canvas with rose accent',
    swatch: '#C46B7A',
    roles: buildGlobalRoles('softRose'),
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep blue-black with luminous accent',
    swatch: '#58A6FF',
    roles: buildGlobalRoles('midnight'),
  },
};

const GLOBAL_PALETTE_ORDER: BuklodPaletteId[] = [
  'cloudWhite',
  'softMint',
  'sage',
  'sky',
  'lavenderMist',
  'sandCream',
  'lightMint',
  'warmSoft',
  'graphite',
  'nightPine',
];

export const BUKLOD_GLOBAL_PREFERENCE_OPTIONS: BuklodGlobalPreferenceOption[] =
  [
    {
      id: 'system',
      label: 'System / Auto',
      description:
        'Follow your device light or dark appearance',
      swatch: '#697784',
    },
    ...GLOBAL_PALETTE_ORDER.map(id => {
      const preset = BUKLOD_PALETTE_PRESETS[id];

      return {
        id: preset.id as BuklodThemePreferenceId,
        label: preset.label,
        description: preset.description,
        swatch: preset.swatch,
      };
    }),
  ];

export function isBuklodPaletteId(
  value: string | null | undefined
): value is BuklodPaletteId {
  return (
    !!value &&
    value in BUKLOD_PALETTE_PRESETS
  );
}

export function isBuklodThemePreferenceId(
  value: string | null | undefined
): value is BuklodThemePreferenceId {
  if (!value) {
    return false;
  }

  if (value === 'system') {
    return true;
  }

  return isBuklodPaletteId(value);
}

export function resolveEffectivePaletteId(
  preference: BuklodThemePreferenceId,
  colorScheme: ColorSchemeName | null | undefined
): BuklodPaletteId {
  if (preference !== 'system') {
    return preference;
  }

  if (colorScheme === 'light') {
    return DEFAULT_BUKLOD_LIGHT_PALETTE;
  }

  return DEFAULT_BUKLOD_DARK_PALETTE;
}

export function getBuklodGlobalTheme(
  preference: BuklodThemePreferenceId,
  colorScheme?: ColorSchemeName | null
): {
  preference: BuklodThemePreferenceId;
  paletteId: BuklodPaletteId;
  roles: BuklodThemeRoles;
} {
  const paletteId = resolveEffectivePaletteId(
    preference,
    colorScheme
  );

  return {
    preference,
    paletteId,
    roles:
      BUKLOD_PALETTE_PRESETS[paletteId].roles,
  };
}

/** Shared motion tokens used app-wide (Messages re-exports). */
export const buklodMotion = {
  pressScale: 0.965,
  pressOpacity: 0.82,
  springDamping: 18,
};

/** Shared spacing rhythm (Messages may extend). */
export const buklodSpacing = {
  screenHorizontal: 16,
  sectionGap: 8,
  navHeight: 61,
};

/** Shared corner radii (Messages may extend). */
export const buklodRadii = {
  card: 14,
  button: 12,
  pill: 999,
  navCapsule: 20,
};

/** Expose palette source for Messages layer extension. */
export function getPaletteSource(
  paletteId: BuklodPaletteId
): PaletteSource {
  return PALETTE_SOURCES[paletteId];
}
