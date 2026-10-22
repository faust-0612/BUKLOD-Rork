import type { AssetRow, CatalogEpisode, MediaGate } from './types';
import { KL_RELEASED_THROUGH_EPISODE, klEpisodeId } from './catalog';
import { manilaSixUtc, mediaGateFor } from './gates';

/** Panimula (0) and Kabanata 1 are already with members. Approval queue starts here. */
export const KL_MEMBER_RELEASED_THROUGH = KL_RELEASED_THROUGH_EPISODE;

export const KL_ADMIN_FLOW_STORAGE_KEY = 'kl.admin.approval.flow.v1';

export type RevisionDirection = 'sent' | 'returned';

export type RevisionEntry = {
  id: string;
  episodeId: string;
  at: string;
  direction: RevisionDirection;
  text: string;
  action: string;
};

export type EpisodeApprovalDraft = {
  prose: string;
  title: string;
  imageKey: string | null;
  animationApplied: boolean;
  musicApplied: boolean;
  approvedLocally: boolean;
  approvedAt: string | null;
};

/**
 * Exact package that will open for members on the next 6:00 a.m. Manila slot.
 * Frozen at approve time — later desk edits do not change this until replaced.
 */
export type NextReleasePackage = {
  episodeId: string;
  episodeNumber: number;
  title: string;
  prose: string;
  imageKey: string | null;
  animationApplied: boolean;
  musicApplied: boolean;
  manilaDate: string;
  releaseAt: string;
  approvedAt: string;
  scheduled: boolean;
  fingerprint: string;
};

export type AdminApprovalFlow = {
  version: 1;
  focusEpisodeNumber: number;
  drafts: Record<string, EpisodeApprovalDraft>;
  revisions: RevisionEntry[];
  /** Exact content bound to the next release schedule. */
  nextRelease: NextReleasePackage | null;
  updatedAt: string;
};

export type ImageChoice = {
  key: string;
  label: string;
  source: number;
};

export function emptyDraft(title = ''): EpisodeApprovalDraft {
  return {
    prose: '',
    title,
    imageKey: null,
    animationApplied: false,
    musicApplied: false,
    approvedLocally: false,
    approvedAt: null,
  };
}

export function defaultAdminFlow(episodes: readonly CatalogEpisode[]): AdminApprovalFlow {
  const next = nextApprovalEpisodeNumber(episodes, {});
  return {
    version: 1,
    focusEpisodeNumber: next,
    drafts: {},
    revisions: [],
    nextRelease: null,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeNextRelease(raw: unknown): NextReleasePackage | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<NextReleasePackage>;
  if (
    typeof value.episodeId !== 'string'
    || !Number.isInteger(value.episodeNumber)
    || typeof value.title !== 'string'
    || typeof value.prose !== 'string'
    || typeof value.manilaDate !== 'string'
    || typeof value.releaseAt !== 'string'
    || typeof value.approvedAt !== 'string'
    || typeof value.fingerprint !== 'string'
  ) {
    return null;
  }
  return {
    episodeId: value.episodeId,
    episodeNumber: Number(value.episodeNumber),
    title: value.title,
    prose: value.prose,
    imageKey: typeof value.imageKey === 'string' ? value.imageKey : null,
    animationApplied: value.animationApplied === true,
    musicApplied: value.musicApplied === true,
    manilaDate: value.manilaDate,
    releaseAt: value.releaseAt,
    approvedAt: value.approvedAt,
    scheduled: value.scheduled === true,
    fingerprint: value.fingerprint,
  };
}

export function releaseFingerprint(input: {
  episodeId: string;
  title: string;
  prose: string;
  imageKey: string | null;
  animationApplied: boolean;
  musicApplied: boolean;
  manilaDate: string;
}): string {
  const body = [
    input.episodeId,
    input.title.trim(),
    input.prose.trim(),
    input.imageKey ?? '',
    input.animationApplied ? '1' : '0',
    input.musicApplied ? '1' : '0',
    input.manilaDate,
  ].join('\u001f');
  let hash = 2166136261;
  for (let index = 0; index < body.length; index += 1) {
    hash ^= body.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `kl-next-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** Build the exact next-release package from the approval desk preview. */
export function buildNextReleasePackage(input: {
  episode: CatalogEpisode;
  draft: EpisodeApprovalDraft;
  manilaDate: string;
  approvedAt?: string;
  scheduled?: boolean;
}): NextReleasePackage | null {
  const releaseAt = manilaSixUtc(input.manilaDate);
  if (!releaseAt) return null;
  const title = input.draft.title.trim() || input.episode.title;
  const prose = (input.draft.prose.trim() || input.episode.prose || '').trim();
  if (!prose) return null;
  const approvedAt = input.approvedAt ?? new Date().toISOString();
  const fingerprint = releaseFingerprint({
    episodeId: input.episode.id,
    title,
    prose,
    imageKey: input.draft.imageKey,
    animationApplied: input.draft.animationApplied,
    musicApplied: input.draft.musicApplied,
    manilaDate: input.manilaDate,
  });
  return {
    episodeId: input.episode.id,
    episodeNumber: input.episode.episodeNumber,
    title,
    prose,
    imageKey: input.draft.imageKey,
    animationApplied: input.draft.animationApplied,
    musicApplied: input.draft.musicApplied,
    manilaDate: input.manilaDate,
    releaseAt,
    approvedAt,
    scheduled: input.scheduled === true,
    fingerprint,
  };
}

export function sanitizeAdminFlow(
  raw: unknown,
  episodes: readonly CatalogEpisode[],
): AdminApprovalFlow {
  const fallback = defaultAdminFlow(episodes);
  if (!raw || typeof raw !== 'object') return fallback;
  const value = raw as Partial<AdminApprovalFlow>;
  const drafts: Record<string, EpisodeApprovalDraft> = {};
  if (value.drafts && typeof value.drafts === 'object') {
    for (const [id, draft] of Object.entries(value.drafts)) {
      if (!draft || typeof draft !== 'object') continue;
      drafts[id] = {
        prose: typeof draft.prose === 'string' ? draft.prose : '',
        title: typeof draft.title === 'string' ? draft.title : '',
        imageKey: typeof draft.imageKey === 'string' ? draft.imageKey : null,
        animationApplied: draft.animationApplied === true,
        musicApplied: draft.musicApplied === true,
        approvedLocally: draft.approvedLocally === true,
        approvedAt: typeof draft.approvedAt === 'string' ? draft.approvedAt : null,
      };
    }
  }
  const revisions = Array.isArray(value.revisions)
    ? value.revisions.filter((entry): entry is RevisionEntry => {
      return Boolean(
        entry
        && typeof entry === 'object'
        && typeof entry.id === 'string'
        && typeof entry.episodeId === 'string'
        && typeof entry.at === 'string'
        && (entry.direction === 'sent' || entry.direction === 'returned')
        && typeof entry.text === 'string'
        && typeof entry.action === 'string',
      );
    }).slice(-80)
    : [];
  const focus = Number.isInteger(value.focusEpisodeNumber)
    ? Math.max(KL_MEMBER_RELEASED_THROUGH + 1, Number(value.focusEpisodeNumber))
    : nextApprovalEpisodeNumber(episodes, drafts);
  return {
    version: 1,
    focusEpisodeNumber: focus,
    drafts,
    revisions,
    nextRelease: sanitizeNextRelease(value.nextRelease),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
  };
}

export function isMemberReleasedEpisode(episodeNumber: number): boolean {
  return episodeNumber >= 0 && episodeNumber <= KL_MEMBER_RELEASED_THROUGH;
}

export function nextApprovalEpisodeNumber(
  episodes: readonly CatalogEpisode[],
  drafts: Record<string, EpisodeApprovalDraft>,
): number {
  const pending = episodes
    .filter((episode) => episode.episodeNumber > KL_MEMBER_RELEASED_THROUGH)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  for (const episode of pending) {
    const draft = drafts[episode.id];
    if (!draft?.approvedLocally) return episode.episodeNumber;
  }
  return pending[pending.length - 1]?.episodeNumber ?? KL_MEMBER_RELEASED_THROUGH + 1;
}

export function draftForEpisode(
  flow: AdminApprovalFlow,
  episode: CatalogEpisode,
): EpisodeApprovalDraft {
  return flow.drafts[episode.id] ?? emptyDraft(episode.title);
}

export function mergeEpisodeForAdmin(
  episode: CatalogEpisode,
  draft: EpisodeApprovalDraft,
): CatalogEpisode {
  const prose = draft.prose.trim().length > 0 ? draft.prose : episode.prose;
  const complete = Boolean(prose?.trim());
  const released = isMemberReleasedEpisode(episode.episodeNumber);
  const approvedLocally = draft.approvedLocally === true;
  return {
    ...episode,
    title: draft.title.trim() || episode.title,
    titleMode: draft.title.trim() ? 'canon_title' : episode.titleMode,
    prose: prose ?? null,
    proseComplete: complete || episode.proseComplete,
    manuscriptStatus: complete || episode.manuscriptStatus === 'approved_complete'
      ? 'approved_complete'
      : episode.manuscriptStatus,
    status: released
      ? 'live'
      : approvedLocally
        ? 'approved'
        : complete
          ? 'draft'
          : episode.status,
    approvedAt: approvedLocally
      ? (draft.approvedAt ?? new Date().toISOString())
      : episode.approvedAt,
  };
}

export function adminMediaGate(
  assets: AssetRow[],
  draft: EpisodeApprovalDraft,
): MediaGate {
  if (draft.musicApplied && draft.animationApplied && draft.imageKey) return 'clear';
  if (draft.musicApplied || draft.animationApplied || draft.imageKey) return 'provisional';
  return mediaGateFor(assets);
}

/** Plain-language blockers for the approval desk. No internal codes. */
export function adminApprovalBlockers(
  episode: CatalogEpisode,
  draft: EpisodeApprovalDraft,
  imageChoicesAvailable: boolean,
): string[] {
  if (isMemberReleasedEpisode(episode.episodeNumber)) {
    return ['This chapter is already with members. Approve the next chapter instead.'];
  }
  const blockers: string[] = [];
  const prose = (draft.prose.trim() || episode.prose || '').trim();
  if (!prose) {
    blockers.push('Write or paste the story text first.');
  }
  if (imageChoicesAvailable && !draft.imageKey) {
    blockers.push('Choose one picture for this release.');
  }
  if (!draft.animationApplied) {
    blockers.push('Turn on the living motion for this preview.');
  }
  if (!draft.musicApplied) {
    blockers.push('Turn on the music bed for this preview.');
  }
  return blockers;
}

export function friendlyEpisodeLabel(
  episode: CatalogEpisode,
  draft: EpisodeApprovalDraft,
  nextRelease?: NextReleasePackage | null,
): string {
  if (isMemberReleasedEpisode(episode.episodeNumber)) return 'With members';
  if (nextRelease?.episodeId === episode.id) {
    return nextRelease.scheduled
      ? `Scheduled · ${nextRelease.manilaDate} 6:00 a.m.`
      : `Approved for ${nextRelease.manilaDate} 6:00 a.m.`;
  }
  if (draft.approvedLocally) return 'Approved · bound to next release';
  const prose = (draft.prose.trim() || episode.prose || '').trim();
  if (!prose) return 'Waiting for story text';
  if (!draft.imageKey || !draft.animationApplied || !draft.musicApplied) {
    return 'Almost ready · finish picture, motion, and music';
  }
  return 'Ready to approve';
}

export function nextReleaseSummary(package_: NextReleasePackage): string {
  const motion = package_.animationApplied ? 'motion on' : 'motion off';
  const music = package_.musicApplied ? 'music on' : 'music off';
  const picture = package_.imageKey ? 'picture chosen' : 'no picture';
  return `${package_.title} · ${package_.manilaDate} 6:00 a.m. · ${picture} · ${motion} · ${music}`;
}

/** True when desk edits would no longer match the frozen next-release package. */
export function draftDiffersFromNextRelease(
  draft: EpisodeApprovalDraft,
  episode: CatalogEpisode,
  nextRelease: NextReleasePackage | null,
): boolean {
  if (!nextRelease || nextRelease.episodeId !== episode.id) return false;
  const title = draft.title.trim() || episode.title;
  const prose = (draft.prose.trim() || episode.prose || '').trim();
  return (
    title !== nextRelease.title
    || prose !== nextRelease.prose
    || draft.imageKey !== nextRelease.imageKey
    || draft.animationApplied !== nextRelease.animationApplied
    || draft.musicApplied !== nextRelease.musicApplied
  );
}

export function appendRevision(
  flow: AdminApprovalFlow,
  entry: Omit<RevisionEntry, 'id' | 'at'> & { id?: string; at?: string },
): AdminApprovalFlow {
  const next: RevisionEntry = {
    id: entry.id ?? `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? new Date().toISOString(),
    episodeId: entry.episodeId,
    direction: entry.direction,
    text: entry.text.slice(0, 2000),
    action: entry.action,
  };
  return {
    ...flow,
    revisions: [...flow.revisions, next].slice(-80),
    updatedAt: next.at,
  };
}

export function markEpisodeApproved(
  flow: AdminApprovalFlow,
  episode: CatalogEpisode,
  episodes: readonly CatalogEpisode[],
  manilaDate: string,
): AdminApprovalFlow {
  const now = new Date().toISOString();
  const draft = {
    ...draftForEpisode(flow, episode),
    approvedLocally: true,
    approvedAt: now,
  };
  const nextRelease = buildNextReleasePackage({
    episode,
    draft,
    manilaDate,
    approvedAt: now,
    scheduled: false,
  });
  const drafts = { ...flow.drafts, [episode.id]: draft };
  return {
    ...flow,
    drafts,
    nextRelease,
    focusEpisodeNumber: nextApprovalEpisodeNumber(episodes, drafts),
    updatedAt: now,
  };
}

/** Bind the already-approved package to the 6:00 a.m. schedule without changing its content. */
export function markNextReleaseScheduled(
  flow: AdminApprovalFlow,
  manilaDate?: string,
): AdminApprovalFlow {
  if (!flow.nextRelease) return flow;
  const date = manilaDate ?? flow.nextRelease.manilaDate;
  const releaseAt = manilaSixUtc(date);
  if (!releaseAt) return flow;
  const fingerprint = releaseFingerprint({
    episodeId: flow.nextRelease.episodeId,
    title: flow.nextRelease.title,
    prose: flow.nextRelease.prose,
    imageKey: flow.nextRelease.imageKey,
    animationApplied: flow.nextRelease.animationApplied,
    musicApplied: flow.nextRelease.musicApplied,
    manilaDate: date,
  });
  const now = new Date().toISOString();
  return {
    ...flow,
    nextRelease: {
      ...flow.nextRelease,
      manilaDate: date,
      releaseAt,
      fingerprint,
      scheduled: true,
    },
    updatedAt: now,
  };
}

/** Replace the scheduled package only by re-approving the same episode's current desk preview. */
export function replaceNextReleaseFromDesk(
  flow: AdminApprovalFlow,
  episode: CatalogEpisode,
  manilaDate: string,
): AdminApprovalFlow {
  const draft = draftForEpisode(flow, episode);
  const nextRelease = buildNextReleasePackage({
    episode,
    draft,
    manilaDate,
    approvedAt: new Date().toISOString(),
    scheduled: flow.nextRelease?.episodeId === episode.id
      ? flow.nextRelease.scheduled
      : false,
  });
  if (!nextRelease) return flow;
  return {
    ...flow,
    nextRelease,
    drafts: {
      ...flow.drafts,
      [episode.id]: {
        ...draft,
        approvedLocally: true,
        approvedAt: nextRelease.approvedAt,
      },
    },
    updatedAt: nextRelease.approvedAt,
  };
}

export function patchEpisodeDraft(
  flow: AdminApprovalFlow,
  episodeId: string,
  patch: Partial<EpisodeApprovalDraft>,
): AdminApprovalFlow {
  const current = flow.drafts[episodeId] ?? emptyDraft();
  return {
    ...flow,
    drafts: {
      ...flow.drafts,
      [episodeId]: { ...current, ...patch },
    },
    updatedAt: new Date().toISOString(),
  };
}

export function focusEpisodeId(flow: AdminApprovalFlow): string {
  return klEpisodeId(flow.focusEpisodeNumber);
}

export function revisionThreadForEpisode(
  flow: AdminApprovalFlow,
  episodeId: string,
): RevisionEntry[] {
  return flow.revisions.filter((entry) => entry.episodeId === episodeId);
}

export function manilaStamp(iso = new Date().toISOString()): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
