/** Privacy-safe KL-only error signatures: no manuscript, media URL, or raw stack leaves the device. */
export function klEditorRenderSignature(error: Error): string {
  const source = (error?.name ?? 'Error') + ':' + (error?.message ?? '');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return 'RENDER_' + (hash >>> 0).toString(16).toUpperCase();
}

export function klEditorCrashComponent(stack: string | undefined): string {
  const s = stack ?? '';
  if (/KlSceneEffect/.test(s)) return 'KL_SCENE_EFFECT';
  if (/KlChapterAudio/.test(s)) return 'KL_CHAPTER_AUDIO';
  if (/KlAdminMediaUpload/.test(s)) return 'KL_MEDIA_EDITOR';
  if (/KlPublishingStudio/.test(s)) return 'KL_PUBLISHING_STUDIO';
  return 'KL_EDITOR_UNKNOWN';
}
