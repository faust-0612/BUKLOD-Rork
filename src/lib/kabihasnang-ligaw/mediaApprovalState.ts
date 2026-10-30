/** Server-backed private-preview and scene-save indicators for KL admin. */
export type KlMediaApprovalItem = {
  approved?: boolean | null;
  effect?: string | null;
  intensity?: number | null;
};

export function klServerApprovedCount(items: readonly KlMediaApprovalItem[]): number {
  return items.reduce((count, item) => count + (item.approved === true ? 1 : 0), 0);
}

export function klSceneEffectSaved(
  item: KlMediaApprovalItem | null | undefined,
  effect: string,
  intensity: number,
): boolean {
  return !!item && (item.effect ?? 'none') === effect && (item.intensity ?? 30) === intensity;
}

/** Local artwork/chapter approval never grants server-media approval. */
export function klPreviewReadyForEpisode(
  episodes: readonly { id: string; preview_ready?: boolean | null }[],
  episodeId: string,
  confirmedPreparedEpisodeId: string,
): boolean {
  return !!episodeId && (episodeId === confirmedPreparedEpisodeId
    || episodes.some((entry) => entry.id === episodeId && entry.preview_ready === true));
}
