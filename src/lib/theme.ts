export const colors = {
  // Core BUKLOD Report brand
  green: '#1A6B46',
  greenDark: '#103D2C',
  greenSoft: '#E9F4EE',
  blue: '#1E4E6E',

  // Text / surfaces
  text: '#17231E',
  textStrong: '#10231B',
  muted: '#66756E',
  mutedSoft: '#8A9690',
  line: '#DCE5E0',
  lineStrong: '#C7D4CD',
  background: '#F3F6F4',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAF9',
  white: '#FFFFFF',

  // Semantic states
  success: '#18794E',
  successSoft: '#E7F6ED',
  danger: '#B93833',
  dangerSoft: '#FCECEA',
  amber: '#B76A00',
  amberSoft: '#FFF4DD',
  info: '#245B78',
  infoSoft: '#EAF3F8',
};

/**
 * Shared visual foundations for the standalone BUKLOD Report experience.
 * Existing color keys stay compatible with older Report components while the
 * semantic tokens below give modernization work one consistent vocabulary.
 */
export const reportTheme = {
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  typography: {
    eyebrow: 9,
    meta: 11,
    body: 13,
    cardTitle: 15,
    sectionTitle: 18,
    pageTitle: 25,
    display: 32,
  },
  layout: {
    mobilePadding: 14,
    widePadding: 22,
    maxContentWidth: 1080,
    maxFormWidth: 720,
  },
  touch: {
    min: 44,
    primary: 50,
  },
} as const;
