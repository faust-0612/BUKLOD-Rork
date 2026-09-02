/**
 * Chat background — independent of Messages theme palette.
 * Precedence: thread override → global override → theme canvas default.
 */

export type ChatBackgroundKind =
  | 'themeDefault'
  | 'solid'
  | 'softColor'
  | 'pattern'
  | 'gradient'
  | 'customImage';

export type ChatBackgroundOverlay =
  | 'none'
  | 'dim'
  | 'light';

export type ChatBackgroundScope =
  | 'global'
  | 'thread';

export type ChatBackgroundConfig = {
  kind: ChatBackgroundKind;
  /** Preset id for solid, softColor, pattern, or gradient. */
  presetId?: string;
  /** Custom hex color when kind is solid/softColor without preset. */
  customColor?: string;
  /** Local image URI from expo-image-picker. */
  imageUri?: string;
  /** Background layer opacity (0.35–1). Default 1. */
  intensity: number;
  /** Readability overlay on top of background. */
  overlay: ChatBackgroundOverlay;
};

export type ChatBackgroundPreset = {
  id: string;
  label: string;
  swatch: string;
  kind: Exclude<
    ChatBackgroundKind,
    'themeDefault' | 'customImage'
  >;
  color?: string;
  gradientColors?: [string, string];
  pattern?: 'dots' | 'grid' | 'diagonal' | 'waves';
  patternColor?: string;
};

export const CHAT_BACKGROUND_GLOBAL_STORAGE_KEY =
  'buklod_chat_background_global_v1';

export const CHAT_BACKGROUND_THREADS_STORAGE_KEY =
  'buklod_chat_background_threads_v1';

export const DEFAULT_CHAT_BACKGROUND: ChatBackgroundConfig =
  {
    kind: 'themeDefault',
    intensity: 1,
    overlay: 'none',
  };

export const CHAT_SOLID_PRESETS: ChatBackgroundPreset[] =
  [
    {
      id: 'solid-white',
      label: 'White',
      swatch: '#FFFFFF',
      kind: 'solid',
      color: '#FFFFFF',
    },
    {
      id: 'solid-silver',
      label: 'Silver',
      swatch: '#E8ECF0',
      kind: 'solid',
      color: '#E8ECF0',
    },
    {
      id: 'solid-slate',
      label: 'Slate',
      swatch: '#CBD5E1',
      kind: 'solid',
      color: '#CBD5E1',
    },
    {
      id: 'solid-charcoal',
      label: 'Charcoal',
      swatch: '#374151',
      kind: 'solid',
      color: '#374151',
    },
    {
      id: 'solid-navy',
      label: 'Navy',
      swatch: '#1E293B',
      kind: 'solid',
      color: '#1E293B',
    },
  ];

export const CHAT_SOFT_PRESETS: ChatBackgroundPreset[] =
  [
    {
      id: 'soft-cloud',
      label: 'Cloud',
      swatch: '#F8FAFC',
      kind: 'softColor',
      color: '#F8FAFC',
    },
    {
      id: 'soft-mint',
      label: 'Mint',
      swatch: '#E8F5EE',
      kind: 'softColor',
      color: '#E8F5EE',
    },
    {
      id: 'soft-sage',
      label: 'Sage',
      swatch: '#E4EBE5',
      kind: 'softColor',
      color: '#E4EBE5',
    },
    {
      id: 'soft-sky',
      label: 'Sky',
      swatch: '#E3EEF8',
      kind: 'softColor',
      color: '#E3EEF8',
    },
    {
      id: 'soft-lavender',
      label: 'Lavender',
      swatch: '#EDE8F5',
      kind: 'softColor',
      color: '#EDE8F5',
    },
    {
      id: 'soft-cream',
      label: 'Cream',
      swatch: '#F5F0E8',
      kind: 'softColor',
      color: '#F5F0E8',
    },
    {
      id: 'soft-rose',
      label: 'Rose',
      swatch: '#F5E8EB',
      kind: 'softColor',
      color: '#F5E8EB',
    },
    {
      id: 'soft-peach',
      label: 'Peach',
      swatch: '#FCEFE6',
      kind: 'softColor',
      color: '#FCEFE6',
    },
  ];

export const CHAT_PATTERN_PRESETS: ChatBackgroundPreset[] =
  [
    {
      id: 'pattern-dots-mint',
      label: 'Mint dots',
      swatch: '#E8F5EE',
      kind: 'pattern',
      color: '#F4FAF7',
      pattern: 'dots',
      patternColor: 'rgba(45, 139, 87, 0.12)',
    },
    {
      id: 'pattern-dots-sky',
      label: 'Sky dots',
      swatch: '#E3EEF8',
      kind: 'pattern',
      color: '#F0F6FC',
      pattern: 'dots',
      patternColor: 'rgba(59, 130, 196, 0.12)',
    },
    {
      id: 'pattern-grid-sage',
      label: 'Sage grid',
      swatch: '#E4EBE5',
      kind: 'pattern',
      color: '#EFF2EE',
      pattern: 'grid',
      patternColor: 'rgba(107, 143, 113, 0.1)',
    },
    {
      id: 'pattern-diagonal-cream',
      label: 'Cream lines',
      swatch: '#F5F0E8',
      kind: 'pattern',
      color: '#FAF6F0',
      pattern: 'diagonal',
      patternColor: 'rgba(168, 146, 106, 0.1)',
    },
    {
      id: 'pattern-waves-lavender',
      label: 'Lavender waves',
      swatch: '#EDE8F5',
      kind: 'pattern',
      color: '#F5F3FA',
      pattern: 'waves',
      patternColor: 'rgba(124, 107, 168, 0.1)',
    },
  ];

export const CHAT_GRADIENT_PRESETS: ChatBackgroundPreset[] =
  [
    {
      id: 'gradient-mint-fade',
      label: 'Mint fade',
      swatch: '#C8E6D4',
      kind: 'gradient',
      gradientColors: ['#E8F5EE', '#D4EBE0'],
    },
    {
      id: 'gradient-sky-fade',
      label: 'Sky fade',
      swatch: '#B8D4F0',
      kind: 'gradient',
      gradientColors: ['#E3EEF8', '#C8DCF0'],
    },
    {
      id: 'gradient-lavender-fade',
      label: 'Lavender fade',
      swatch: '#D4C8E8',
      kind: 'gradient',
      gradientColors: ['#EDE8F5', '#DCD0EC'],
    },
    {
      id: 'gradient-warm-fade',
      label: 'Warm fade',
      swatch: '#E8DCC8',
      kind: 'gradient',
      gradientColors: ['#F5F0E8', '#E8DDD0'],
    },
    {
      id: 'gradient-slate-fade',
      label: 'Slate fade',
      swatch: '#94A3B8',
      kind: 'gradient',
      gradientColors: ['#CBD5E1', '#94A3B8'],
    },
  ];

export const ALL_CHAT_BACKGROUND_PRESETS: ChatBackgroundPreset[] =
  [
    ...CHAT_SOLID_PRESETS,
    ...CHAT_SOFT_PRESETS,
    ...CHAT_PATTERN_PRESETS,
    ...CHAT_GRADIENT_PRESETS,
  ];

const PRESET_BY_ID = new Map(
  ALL_CHAT_BACKGROUND_PRESETS.map(p => [p.id, p])
);

export function clampChatBackgroundIntensity(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0.35, value));
}

export function normalizeChatBackgroundConfig(
  raw: Partial<ChatBackgroundConfig> | null | undefined
): ChatBackgroundConfig {
  if (!raw || raw.kind === 'themeDefault') {
    return { ...DEFAULT_CHAT_BACKGROUND };
  }

  const kind = raw.kind ?? 'themeDefault';

  if (kind === 'customImage') {
    return {
      kind: 'customImage',
      imageUri: raw.imageUri,
      intensity: clampChatBackgroundIntensity(
        raw.intensity ?? 1
      ),
      overlay: raw.overlay ?? 'dim',
    };
  }

  if (
    kind === 'pattern' ||
    kind === 'gradient'
  ) {
    return {
      kind,
      presetId: raw.presetId,
      intensity: clampChatBackgroundIntensity(
        raw.intensity ?? 1
      ),
      overlay: raw.overlay ?? 'light',
    };
  }

  return {
    kind,
    presetId: raw.presetId,
    customColor: raw.customColor,
    intensity: clampChatBackgroundIntensity(
      raw.intensity ?? 1
    ),
    overlay: raw.overlay ?? 'none',
  };
}

export function isChatBackgroundConfig(
  value: unknown
): value is ChatBackgroundConfig {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const candidate = value as ChatBackgroundConfig;

  return (
    typeof candidate.kind === 'string' &&
    typeof candidate.intensity === 'number'
  );
}

export function resolveChatBackgroundPreset(
  config: ChatBackgroundConfig
): ChatBackgroundPreset | null {
  if (!config.presetId) {
    return null;
  }

  return PRESET_BY_ID.get(config.presetId) ?? null;
}

export function resolveChatBackgroundBaseColor(
  config: ChatBackgroundConfig,
  themeCanvas: string
): string {
  if (config.kind === 'themeDefault') {
    return themeCanvas;
  }

  if (config.kind === 'customImage') {
    return themeCanvas;
  }

  const preset = resolveChatBackgroundPreset(config);

  if (preset?.color) {
    return preset.color;
  }

  if (preset?.gradientColors?.[0]) {
    return preset.gradientColors[0];
  }

  if (config.customColor) {
    return config.customColor;
  }

  return themeCanvas;
}

export function resolveChatBackgroundOverlayColor(
  overlay: ChatBackgroundOverlay,
  isDarkCanvas: boolean
): string | null {
  switch (overlay) {
    case 'dim':
      return isDarkCanvas
        ? 'rgba(0, 0, 0, 0.28)'
        : 'rgba(0, 0, 0, 0.12)';
    case 'light':
      return isDarkCanvas
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(255, 255, 255, 0.22)';
    default:
      return null;
  }
}

export function isDarkHexColor(hex: string): boolean {
  const normalized = hex.replace('#', '');

  if (normalized.length !== 6) {
    return false;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance =
    (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.45;
}

export function resolveEffectiveChatBackground(
  args: {
    themeCanvas: string;
    globalConfig: ChatBackgroundConfig | null;
    threadConfig: ChatBackgroundConfig | null;
    threadId?: string | null;
  }
): {
  config: ChatBackgroundConfig;
  source: 'theme' | 'global' | 'thread';
} {
  if (
    args.threadId &&
    args.threadConfig &&
    args.threadConfig.kind !== 'themeDefault'
  ) {
    return {
      config: args.threadConfig,
      source: 'thread',
    };
  }

  if (
    args.globalConfig &&
    args.globalConfig.kind !== 'themeDefault'
  ) {
    return {
      config: args.globalConfig,
      source: 'global',
    };
  }

  return {
    config: DEFAULT_CHAT_BACKGROUND,
    source: 'theme',
  };
}
