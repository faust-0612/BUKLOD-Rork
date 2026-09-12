import { colors as sharedColors } from '@/lib/theme';

/**
 * Standalone BUKLOD Report visual system.
 * Kept separate from the shared BUKLOD Main theme so Report modernization can
 * evolve without changing Main, Classroom, IGPat, Character or other apps.
 */
export const reportColors = {
  ...sharedColors,
  green: '#1A6B46',
  greenDark: '#103D2C',
  greenSoft: '#E9F4EE',
  blue: '#1E4E6E',
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
  success: '#18794E',
  successSoft: '#E7F6ED',
  danger: '#B93833',
  dangerSoft: '#FCECEA',
  amber: '#B76A00',
  amberSoft: '#FFF4DD',
  info: '#245B78',
  infoSoft: '#EAF3F8',
} as const;

export const reportTheme = {
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 },
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
  touch: { min: 44, primary: 50 },
} as const;
