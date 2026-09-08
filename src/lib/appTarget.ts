import Constants from 'expo-constants';

export const CLASSROOM_APP_IDENTITY = {
  appTarget: 'classroom',
  displayName: 'BUKLOD Classroom',
  slug: 'buklod-classroom',
  scheme: 'buklod-classroom',
  androidPackage: 'org.mzbministry.buklod.classroom',
  expoProjectId: '14100ed1-7f25-4551-9627-09d280498241',
  homeRoute: '/profile/buklod-classroom-home',
} as const;

export type BuklodAppTarget = 'main' | 'classroom';

function normalized(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getBuklodAppTarget(): BuklodAppTarget {
  const expoConfig = Constants.expoConfig as any;
  const explicitTarget = normalized(expoConfig?.extra?.appTarget);

  if (explicitTarget === 'classroom') return 'classroom';
  if (explicitTarget === 'main') return 'main';

  const projectId = String(
    expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? ''
  ).trim();
  const slug = normalized(expoConfig?.slug);
  const scheme = normalized(expoConfig?.scheme);
  const androidPackage = normalized(expoConfig?.android?.package);

  if (
    projectId === CLASSROOM_APP_IDENTITY.expoProjectId ||
    slug === CLASSROOM_APP_IDENTITY.slug ||
    scheme === CLASSROOM_APP_IDENTITY.scheme ||
    androidPackage === CLASSROOM_APP_IDENTITY.androidPackage
  ) {
    return 'classroom';
  }

  return 'main';
}

export function isClassroomApp() {
  return getBuklodAppTarget() === 'classroom';
}

export function appDisplayName() {
  return isClassroomApp() ? CLASSROOM_APP_IDENTITY.displayName : 'BUKLOD';
}
