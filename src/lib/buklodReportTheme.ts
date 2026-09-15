import { colors as sharedColors } from '@/lib/theme';

/**
 * Standalone BUKLOD Report visual system.
 * Kept separate from the shared BUKLOD Main theme so Report modernization can
 * evolve without changing Main, Classroom, IGPat, Character or other apps.
 */
export const reportColors = {
  ...sharedColors,
  green: '#0878E8',
  greenDark: '#062D59',
  greenSoft: '#EAF5FF',
  blue: '#0878E8',
  text: '#102A43',
  textStrong: '#062D59',
  muted: '#60758B',
  mutedSoft: '#8496A8',
  line: '#D7E7F6',
  lineStrong: '#BDD6EB',
  background: '#F4F9FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FCFF',
  white: '#FFFFFF',
  success: '#13A66B',
  successSoft: '#E9F8F1',
  danger: '#C83C3C',
  dangerSoft: '#FDECEC',
  amber: '#D99000',
  amberSoft: '#FFF3DD',
  info: '#0878E8',
  infoSoft: '#EAF5FF',
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
    maxContentWidth: 1240,
    maxFormWidth: 720,
  },
  touch: { min: 44, primary: 50 },
} as const;
