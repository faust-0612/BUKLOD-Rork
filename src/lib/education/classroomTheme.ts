export type ClassroomThemeId = 'CHALKBOARD' | 'NOTEBOOK' | 'STUDIO' | 'NIGHT_STUDY';

export type ClassroomTheme = {
  id: ClassroomThemeId;
  name: string;
  caption: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
  muted: string;
  primary: string;
  primaryInk: string;
  secondary: string;
  accent: string;
  border: string;
  chip: string;
  drawer: string;
  drawerInk: string;
  heroStart: string;
  heroEnd: string;
  success: string;
  warning: string;
  danger: string;
};

export const CLASSROOM_THEMES: Record<ClassroomThemeId, ClassroomTheme> = {
  CHALKBOARD: {
    id: 'CHALKBOARD',
    name: 'Chalkboard',
    caption: 'Deep board, warm paper, brass accent',
    background: '#EDE9DE',
    surface: '#F9F5EA',
    surfaceRaised: '#FFFDF7',
    ink: '#1D2926',
    muted: '#68716D',
    primary: '#183C36',
    primaryInk: '#FFF9EC',
    secondary: '#B66A3C',
    accent: '#D1A44B',
    border: '#D8D0BF',
    chip: '#E5DDC9',
    drawer: '#122D29',
    drawerInk: '#F7F0DF',
    heroStart: '#183C36',
    heroEnd: '#2C5B50',
    success: '#2E7D5A',
    warning: '#B0712C',
    danger: '#A9463D',
  },
  NOTEBOOK: {
    id: 'NOTEBOOK',
    name: 'Notebook',
    caption: 'Ink blue, off-white paper, coral marks',
    background: '#EEF1F5',
    surface: '#FAFBFD',
    surfaceRaised: '#FFFFFF',
    ink: '#172232',
    muted: '#687488',
    primary: '#244D76',
    primaryInk: '#FFFFFF',
    secondary: '#D66C58',
    accent: '#D2A445',
    border: '#D8DFE8',
    chip: '#E3EAF2',
    drawer: '#172A42',
    drawerInk: '#F7FAFF',
    heroStart: '#244D76',
    heroEnd: '#547AA2',
    success: '#2F7C67',
    warning: '#B77A31',
    danger: '#B94E4B',
  },
  STUDIO: {
    id: 'STUDIO',
    name: 'Studio',
    caption: 'Graphite, clay, sage, editorial layout',
    background: '#EEECE8',
    surface: '#F7F5F1',
    surfaceRaised: '#FFFFFF',
    ink: '#252523',
    muted: '#77746F',
    primary: '#3F5346',
    primaryInk: '#FFFFFF',
    secondary: '#B75D4E',
    accent: '#C79046',
    border: '#D9D5CE',
    chip: '#E6E2DA',
    drawer: '#2E302D',
    drawerInk: '#FAF8F2',
    heroStart: '#3F5346',
    heroEnd: '#6B796F',
    success: '#49755A',
    warning: '#B07D37',
    danger: '#A84D46',
  },
  NIGHT_STUDY: {
    id: 'NIGHT_STUDY',
    name: 'Night Study',
    caption: 'Charcoal, indigo, amber desk light',
    background: '#121722',
    surface: '#1C2330',
    surfaceRaised: '#252E3C',
    ink: '#F5F1E8',
    muted: '#A7B0C0',
    primary: '#7586D9',
    primaryInk: '#0E1420',
    secondary: '#D57A64',
    accent: '#E2B65F',
    border: '#313B4C',
    chip: '#2B3444',
    drawer: '#0C111A',
    drawerInk: '#F4F1E9',
    heroStart: '#283356',
    heroEnd: '#4D5E94',
    success: '#66A780',
    warning: '#D6A45C',
    danger: '#D26B66',
  },
};

export const CLASSROOM_THEME_OPTIONS = Object.values(CLASSROOM_THEMES);

export const DEFAULT_CLASSROOM_THEME_ID: ClassroomThemeId = 'CHALKBOARD';

export function isClassroomThemeId(value: unknown): value is ClassroomThemeId {
  return typeof value === 'string' && value in CLASSROOM_THEMES;
}
