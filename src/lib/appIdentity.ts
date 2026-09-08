import Constants from 'expo-constants';

export type BuklodAppTarget = 'main' | 'classroom';

const rawTarget = String(
  Constants.expoConfig?.extra?.appTarget ?? 'main'
)
  .trim()
  .toLowerCase();

export const BUKLOD_APP_TARGET: BuklodAppTarget =
  rawTarget === 'classroom' ? 'classroom' : 'main';

export const isClassroomApp = BUKLOD_APP_TARGET === 'classroom';

export const BUKLOD_APP_IDENTITY = isClassroomApp
  ? {
      target: 'classroom' as const,
      displayName: 'BUKLOD Classroom',
      slug: 'buklod-classroom',
      scheme: 'buklod-classroom',
      androidPackage: 'org.mzbministry.buklod.classroom',
      expoProjectId: '14100ed1-7f25-4551-9627-09d280498241',
      homeRoute: '/classroom' as const,
    }
  : {
      target: 'main' as const,
      displayName: 'BUKLOD',
      slug: 'buklod',
      scheme: 'buklod',
      androidPackage: 'org.mzbministry.buklod',
      expoProjectId: '23dad7d0-389a-406e-8dec-08965dab85d8',
      homeRoute: '/(tabs)/home' as const,
    };
