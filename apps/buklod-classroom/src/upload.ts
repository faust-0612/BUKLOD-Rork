import * as tus from 'tus-js-client';
import { supabase } from './core';

export type LocalUpload = { uri: string; name: string; type: string; size?: number | null };

export async function uploadClassroomResumable(
  classroomId: string,
  ownerUserId: string,
  submissionId: string,
  file: LocalUpload,
  onProgress?: (percent: number) => void,
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in required.');
  const baseUrl = String((supabase as any).supabaseUrl || '');
  const projectId = new URL(baseUrl).hostname.split('.')[0];
  if (!projectId) throw new Error('Storage project is not configured.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-140);
  const objectName = `${classroomId}/${ownerUserId}/submission/${submissionId}/${Date.now()}_${safeName}`;
  const source: any = { uri: file.uri, name: file.name, type: file.type };

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(source, {
      endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: 'buklod-classroom', objectName, contentType: file.type || 'application/octet-stream', cacheControl: '3600' },
      onError: reject,
      onProgress: (uploaded, total) => onProgress?.(total > 0 ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(),
    });
    void upload.findPreviousUploads().then(previous => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });

  const kind = file.type.startsWith('video/') ? 'VIDEO' : file.type.startsWith('image/') ? 'PHOTO' : 'FILE';
  const { error } = await supabase.from('buklod_education_classroom_files').insert({
    classroom_id: classroomId,
    owner_user_id: ownerUserId,
    entity_type: 'SUBMISSION',
    entity_id: submissionId,
    file_kind: kind,
    storage_bucket: 'buklod-classroom',
    storage_path: objectName,
    original_name: file.name,
    mime_type: file.type,
    file_size: file.size ?? null,
  });
  if (error) throw error;
  return objectName;
}
