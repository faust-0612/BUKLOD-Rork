import Constants from 'expo-constants';

export type BuklodAppTarget = 'main' | 'classroom';

const rawTarget = String(
  Constants.expoConfig?.extra?.appTarget ?? 'main'
).trim().toLowerCase();

export const buklodAppTarget: BuklodAppTarget =
  rawTarget === 'classroom' ? 'classroom' : 'main';

export const isClassroomApp = buklodAppTarget === 'classroom';
export const buklodAppDisplayName = isClassroomApp ? 'BUKLOD Classroom' : 'BUKLOD';
