import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROFILE_SECTION_IDS = [
  'highlights',
  'quickActions',
  'communities',
  'focusApps',
  'myBuklod',
] as const;

export type ProfileSectionId =
  (typeof PROFILE_SECTION_IDS)[number];

export type ProfileSectionLayout = {
  id: ProfileSectionId;
  visible: boolean;
};

export const DEFAULT_PROFILE_LAYOUT: ProfileSectionLayout[] =
  PROFILE_SECTION_IDS.map((id) => ({
    id,
    visible: true,
  }));

export const PROFILE_SECTION_LABELS: Record<
  ProfileSectionId,
  string
> = {
  highlights: 'Personal Highlights',
  quickActions: 'Quick Actions',
  communities: 'My Communities',
  focusApps: 'My Focus Apps',
  myBuklod: 'My BUKLOD',
};

function storageKey(userId: string) {
  return `buklod.profile.layout.v1:${userId}`;
}

function normalizeLayout(
  value: unknown
): ProfileSectionLayout[] {
  const incoming = Array.isArray(value)
    ? value
    : [];

  const seen = new Set<string>();
  const next: ProfileSectionLayout[] = [];

  for (const row of incoming) {
    const id = String(
      (row as ProfileSectionLayout)?.id ?? ''
    ) as ProfileSectionId;

    if (
      !PROFILE_SECTION_IDS.includes(id) ||
      seen.has(id)
    ) {
      continue;
    }

    seen.add(id);
    next.push({
      id,
      visible:
        (row as ProfileSectionLayout)?.visible !== false,
    });
  }

  for (const id of PROFILE_SECTION_IDS) {
    if (!seen.has(id)) {
      next.push({ id, visible: true });
    }
  }

  return next;
}

export async function loadProfileLayout(
  userId: string
): Promise<ProfileSectionLayout[]> {
  try {
    const raw = await AsyncStorage.getItem(
      storageKey(userId)
    );

    if (!raw) {
      return DEFAULT_PROFILE_LAYOUT;
    }

    return normalizeLayout(JSON.parse(raw));
  } catch {
    return DEFAULT_PROFILE_LAYOUT;
  }
}

export async function saveProfileLayout(
  userId: string,
  layout: ProfileSectionLayout[]
): Promise<void> {
  await AsyncStorage.setItem(
    storageKey(userId),
    JSON.stringify(normalizeLayout(layout))
  );
}
