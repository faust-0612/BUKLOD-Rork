import { supabase } from '@/lib/supabase';
import type { IgpatQuickEditState } from '@/components/igpat/IgpatQuickEditPanel';

export type IgpatPostMetadata = IgpatQuickEditState & { postId: string };

function missing(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  return message.includes('could not find the function') || message.includes('schema cache') || message.includes('does not exist');
}

export async function saveIgpatPostMetadata(postId: string, edit: IgpatQuickEditState) {
  const { error } = await (supabase as any).rpc('igpat_set_post_metadata_v1', {
    p_post_id: postId,
    p_trim_start_seconds: edit.trimStartSeconds,
    p_trim_end_seconds: edit.trimEndSeconds,
    p_playback_speed: edit.speed,
    p_text_overlay: edit.textOverlay,
    p_captions_enabled: edit.captionsEnabled,
    p_audio_label: edit.audioLabel,
    p_cover_seconds: edit.coverSeconds,
  });
  if (error && !missing(error)) throw error;
  return !error;
}

export async function getIgpatPostMetadata(postIds: string[]): Promise<Record<string, IgpatQuickEditState>> {
  if (!postIds.length) return {};
  try {
    const { data, error } = await (supabase as any).rpc('igpat_get_post_metadata_v1', { p_post_ids: postIds });
    if (error) {
      if (missing(error)) return {};
      throw error;
    }
    const result: Record<string, IgpatQuickEditState> = {};
    for (const row of data ?? []) {
      const id = String(row?.post_id ?? '');
      if (!id) continue;
      result[id] = {
        trimStartSeconds: Math.max(0, Number(row?.trim_start_seconds ?? 0)),
        trimEndSeconds: row?.trim_end_seconds == null ? null : Math.max(0, Number(row.trim_end_seconds)),
        speed: Math.max(.5, Math.min(2, Number(row?.playback_speed ?? 1))),
        textOverlay: String(row?.text_overlay ?? ''),
        captionsEnabled: Boolean(row?.captions_enabled),
        audioLabel: String(row?.audio_label ?? ''),
        coverSeconds: Math.max(0, Number(row?.cover_seconds ?? 0)),
      };
    }
    return result;
  } catch {
    return {};
  }
}
