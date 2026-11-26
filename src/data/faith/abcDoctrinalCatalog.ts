/**
 * ABaKa's open-ended published doctrine catalog. Correct answers are never
 * returned to the client; server RPC verifies the choice and reflection.
 * Existing bundled A-Z lessons remain available offline.
 */
import { supabase } from '@/lib/supabase';
import type { AbcBlock, AbcLesson, FaithBibleReference } from './abcLessons';

export type DoctrineDifficulty = 'foundation' | 'intermediate' | 'advanced' | 'deep';
export const DOCTRINE_POINTS: Record<DoctrineDifficulty, number> = {
  foundation: 8,
  intermediate: 12,
  advanced: 18,
  deep: 25,
};
export const DOCTRINE_LABELS: Record<DoctrineDifficulty, string> = {
  foundation: 'Foundation',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  deep: 'Deep Study',
};
export const DOCTRINE_DAILY_REWARD_CAP = 50;

type CatalogRow = {
  lesson_id: string;
  series_key: string;
  series_title: string;
  position: number;
  code: string;
  title: string;
  difficulty: DoctrineDifficulty;
  prerequisite_id: string | null;
  body_blocks: Array<{ kind?: AbcBlock['kind']; text: string; refs?: FaithBibleReference[] }>;
  assessment_prompt: string;
  assessment_options: string[];
};

export function mapDoctrinalLesson(row: CatalogRow): AbcLesson {
  if (!Object.prototype.hasOwnProperty.call(DOCTRINE_POINTS, row.difficulty)) {
    throw new Error('Unsupported doctrine difficulty');
  }
  if (!Array.isArray(row.body_blocks) || !Array.isArray(row.assessment_options) ||
      row.assessment_options.length !== 4) {
    throw new Error('Invalid published doctrine content');
  }
  const blocks: AbcBlock[] = row.body_blocks.map((block, i) => ({
    id: 'd' + (i + 1),
    kind: ['heading', 'body', 'question', 'homework', 'memory', 'notes'].includes(block.kind ?? '')
      ? block.kind! : 'body',
    text: String(block.text ?? ''),
    answerable: false,
    refs: Array.isArray(block.refs) ? block.refs : [],
  }));
  const references = blocks.flatMap(block => block.refs);
  return {
    id: row.lesson_id,
    code: row.code,
    title: row.title,
    order: Number(row.position),
    sourcePages: [0, 0],
    blocks,
    references,
    seriesKey: row.series_key,
    seriesTitle: row.series_title,
    difficulty: row.difficulty,
    prerequisiteId: row.prerequisite_id ?? undefined,
    rewardPoints: DOCTRINE_POINTS[row.difficulty],
    assessment: {
      prompt: row.assessment_prompt,
      options: row.assessment_options,
    },
  };
}

const CATALOG_COLUMNS = 'lesson_id,series_key,series_title,position,code,title,difficulty,prerequisite_id,body_blocks,assessment_prompt,assessment_options';
export const DOCTRINE_CATALOG_PAGE_SIZE = 80;

export async function loadPublishedDoctrinalLessons(offset = 0): Promise<AbcLesson[]> {
  const { data, error } = await supabase.from('buklod_abc_doctrinal_lessons')
    .select(CATALOG_COLUMNS)
    .eq('published', true)
    .order('created_at', { ascending: true })
    .order('lesson_id', { ascending: true })
    .range(offset, offset + DOCTRINE_CATALOG_PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []).map((row: any) => mapDoctrinalLesson(row as CatalogRow));
}

export async function loadPublishedDoctrinalLesson(lessonId: string): Promise<AbcLesson | null> {
  const { data, error } = await supabase.from('buklod_abc_doctrinal_lessons')
    .select(CATALOG_COLUMNS)
    .eq('lesson_id', lessonId)
    .eq('published', true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDoctrinalLesson(data as CatalogRow) : null;
}
