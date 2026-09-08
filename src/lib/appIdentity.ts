import Constants from 'expo-constants';

export type BuklodAppTarget = 'main' | 'classroom';

const resolvedTarget = String(
  Constants.expoConfig?.extra?.appTarget ?? 'main'
)
  .trim()
  .toLowerCase();

export const APP_TARGET: BuklodAppTarget =
  resolvedTarget === 'classroom' ? 'classroom' : 'main';

export const IS_CLASSROOM_APP = APP_TARGET === 'classroom';

export const APP_DISPLAY_NAME = IS_CLASSROOM_APP
  ? 'BUKLOD Classroom'
  : 'BUKLOD';

export const APP_LOGIN_TAGLINE = IS_CLASSROOM_APP
  ? 'Classes, learning, attendance, assessments and results in one place.'
  : 'Samahang Binuklod ng Pag-ibig';
