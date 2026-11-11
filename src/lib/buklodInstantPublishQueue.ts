/**
 * JS-session instant posting feedback shared by IGPAT and Marites.
 *
 * Upload work is still asynchronous and requires BUKLOD to stay open.
 * Pending previews are AUTHOR-ONLY and never impersonate confirmed server posts.
 * A failed/uncertain commit is never automatically replayed.
 */
export type InstantPublishKind = 'igpat' | 'marites';
export type InstantPublishStatus = 'uploading' | 'posted' | 'device_only' | 'failed' | 'uncertain';
export type InstantPublishSnapshot = {
  id: string;
  ownerId: string;
  kind: InstantPublishKind;
  caption: string;
  mediaUri: string | null;
  photoUris: string[];
  createdAt: string;
  status: InstantPublishStatus;
  progress: number | null;
  notice: string;
};

export class InstantPublishUncertainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstantPublishUncertainError';
  }
}

type Work = (
  progress: (fraction: number | null, notice: string) => void,
) => Promise<'posted' | 'device_only'>;
type Listener = () => void;
const listeners = new Set<Listener>();
const jobs = new Map<string, InstantPublishSnapshot>();
const workById = new Map<string, Work>();

function emit() {
  listeners.forEach(listener => listener());
}
function mutate(id: string, patch: Partial<InstantPublishSnapshot>) {
  const current = jobs.get(id);
  if (!current) return;
  jobs.set(id, { ...current, ...patch });
  emit();
}
export function subscribeInstantPublish(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getInstantPublishes(ownerId: string | null | undefined, kind: InstantPublishKind) {
  if (!ownerId) return [];
  return [...jobs.values()]
    .filter(job => job.ownerId === ownerId && job.kind === kind)
    .map(job => ({ ...job, photoUris: [...job.photoUris] }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function dismissInstantPublish(id: string, ownerId: string) {
  const job = jobs.get(id);
  if (!job || job.ownerId !== ownerId || job.status === 'uploading') return false;
  jobs.delete(id);
  workById.delete(id);
  emit();
  return true;
}

async function run(id: string) {
  const work = workById.get(id);
  if (!work) return;
  try {
    const result = await work((fraction, notice) => {
      mutate(id, {
        progress: fraction == null ? null : Math.min(1, Math.max(0, fraction)),
        notice,
      });
    });
    mutate(id, {
      status: result,
      progress: result === 'posted' ? 1 : null,
      notice: result === 'posted'
        ? 'Published. Updating your feed…'
        : 'Saved on this device only. Not shared yet.',
    });
    // Successful publication/offline fallback can be reconciled by the feed.
    setTimeout(() => {
      if (jobs.get(id)?.status === result) {
        jobs.delete(id);
        workById.delete(id);
        emit();
      }
    }, result === 'posted' ? 12000 : 20000);
  } catch (error) {
    const uncertain = error instanceof InstantPublishUncertainError;
    mutate(id, {
      status: uncertain ? 'uncertain' : 'failed',
      progress: null,
      notice: uncertain
        ? error.message
        : (error instanceof Error ? error.message : 'Upload failed. You can retry.'),
    });
  }
}
export function enqueueInstantPublish(
  input: Pick<InstantPublishSnapshot, 'ownerId' | 'kind' | 'caption' | 'mediaUri' | 'photoUris'>,
  work: Work,
) {
  if (getInstantPublishes(input.ownerId, input.kind).some(job => job.status === 'uploading')) {
    throw new Error('Another upload is running. Finish it before creating another.');
  }
  const id = `pending-${input.kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  jobs.set(id, {
    ...input,
    photoUris: [...input.photoUris],
    id,
    createdAt: new Date().toISOString(),
    status: 'uploading',
    progress: 0,
    notice: 'Uploading… Keep BUKLOD open.',
  });
  workById.set(id, work);
  emit();
  void run(id);
  return id;
}
export function retryInstantPublish(id: string, ownerId: string) {
  const job = jobs.get(id);
  if (!job || job.ownerId !== ownerId || job.status !== 'failed' || !workById.has(id)) return false;
  mutate(id, { status: 'uploading', progress: 0, notice: 'Retrying upload… Keep BUKLOD open.' });
  void run(id);
  return true;
}
