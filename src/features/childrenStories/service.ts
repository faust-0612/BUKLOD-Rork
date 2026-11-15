import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { BUNDLED_CHILDREN_STORIES, ChildrenStory, isValidChildrenStory } from './catalog';

// All progress belongs to the adult BUKLOD account, never to a child identity.
const key = (uid: string, suffix: string) => `@buklod/children-stories/v1/${uid}/${suffix}`;
export type StoryProgress = Record<string, { page: number; completed: boolean; favorite: boolean }>;
const EMPTY: StoryProgress = {};
export async function readStoryProgress(uid?: string | null): Promise<StoryProgress> {
  if (!uid) return EMPTY;
  try {
    const raw = await AsyncStorage.getItem(key(uid,'progress'));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const output: StoryProgress = {};
    for (const [id,value] of Object.entries(parsed as Record<string, any>).slice(0,200)) {
      if (!/^[a-z0-9-]{3,70}$/.test(id) || !value || typeof value !== 'object') continue;
      output[id] = {
        page: Number.isInteger(value.page) ? Math.max(0, Math.min(15, value.page)) : 0,
        completed: value.completed === true,
        favorite: value.favorite === true
      };
    }
    return output;
  } catch { return {}; }
}
const progressWrites = new Map<string, Promise<void>>();
// Serialize a single adult account's updates; rapid next/favorite/completion actions
// must not overwrite one another after AsyncStorage read-modify-write races.
export async function saveStoryProgress(uid: string | null | undefined, storyId: string, patch: Partial<StoryProgress[string]>) {
  if (!uid || !/^[a-z0-9-]{3,70}$/.test(storyId)) return;
  const storeKey = key(uid, 'progress');
  const previous = progressWrites.get(storeKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const current = await readStoryProgress(uid);
    const prior = current[storyId] ?? { page: 0, completed: false, favorite: false };
    const merged = { ...prior, ...patch };
    current[storyId] = {
      page: Number.isInteger(merged.page) ? Math.max(0, Math.min(15, merged.page)) : prior.page,
      completed: merged.completed === true,
      favorite: merged.favorite === true,
    };
    await AsyncStorage.setItem(storeKey, JSON.stringify(current));
  });
  progressWrites.set(storeKey, next);
  try { await next; }
  catch { /* low-storage devices retain session-only progress safely */ }
  finally { if (progressWrites.get(storeKey) === next) progressWrites.delete(storeKey); }
}
function normalizedRemoteRows(data: any[]): ChildrenStory[] {
  return data
    .filter(row => row?.is_published === true && (!row.publish_at || Date.parse(row.publish_at) <= Date.now()))
    .map(row => ({ ...row.payload, id: row.id, source: 'published' as const }))
    .filter(isValidChildrenStory)
    .slice(0,50);
}
export function mergeStoryLibrary(published: ChildrenStory[]): ChildrenStory[] {
  // A published editorial edition may replace the bundled version without duplicate shelves.
  const merged = new Map(BUNDLED_CHILDREN_STORIES.map(item => [item.id, item] as const));
  for (const item of published) merged.set(item.id,item);
  return [...merged.values()];
}
export async function fetchChildrenStoryLibrary(uid?: string | null): Promise<ChildrenStory[]> {
  if (!uid) return BUNDLED_CHILDREN_STORIES;
  const cacheKey = key(uid,'published');
  try {
    const {data,error} = await supabase
      .from('buklod_children_stories')
      .select('id,payload,is_published,publish_at')
      .eq('is_published',true)
      .limit(60);
    if (error) throw error;
    const remote = normalizedRemoteRows(data ?? []);
    await AsyncStorage.setItem(cacheKey,JSON.stringify(remote)).catch(() => undefined);
    return mergeStoryLibrary(remote);
  } catch {
    // Cache only the last authorized published snapshot, scoped to this signed-in adult.
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      const cached: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(cached)) return mergeStoryLibrary(cached.filter(isValidChildrenStory).slice(0,50));
    } catch { /* always retain bundled stories */ }
    return BUNDLED_CHILDREN_STORIES;
  }
}
export function formatStoryAge(story: ChildrenStory) {
  return story.minAge === story.maxAge ? `${story.minAge}` : `${story.minAge}–${story.maxAge}`;
}
