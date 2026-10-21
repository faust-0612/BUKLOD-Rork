import type {
  AssetRow,
  CatalogEpisode,
  CompletionPlan,
  MediaGate,
  PointRule,
} from './types';
import {
  KL_EPISODE_RULE,
  KL_RELEASE_HOUR,
  KL_SEASON_RULE,
  KL_TIME_ZONE,
} from './types';

const READABLE_STATUSES = new Set(['approved', 'scheduled', 'live']);

export function manilaParts(instant: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return { hour, minute };
}

export function isManilaSix(iso: string): boolean {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return false;
  const parts = manilaParts(new Date(parsed));
  return parts.hour === KL_RELEASE_HOUR && parts.minute === 0;
}

/** 06:00 on the given Manila civil date, returned as UTC ISO. */
export function manilaSixUtc(manilaDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manilaDate)) return null;
  const utc = new Date(`${manilaDate}T06:00:00+08:00`);
  if (!Number.isFinite(utc.getTime())) return null;
  if (!isManilaSix(utc.toISOString())) return null;
  return utc.toISOString();
}

export function mediaGateFor(assets: AssetRow[]): MediaGate {
  const required = assets.filter((asset) => asset.required);
  if (required.length === 0) return 'missing';
  if (required.some((asset) => asset.classification === 'MISSING' || asset.classification === 'REJECTED')) {
    return 'missing';
  }
  if (required.some((asset) => asset.classification === 'PROVISIONAL')) return 'provisional';
  if (required.some((asset) => asset.classification !== 'APPROVED' || asset.approved !== true)) {
    return 'unapproved';
  }
  return 'clear';
}

export function publicationBlockers(episode: CatalogEpisode, assets: AssetRow[]): string[] {
  const blockers: string[] = [];
  if (episode.status === 'outline_only' || episode.manuscriptStatus === 'outline_only') {
    blockers.push('outline_only');
  }
  if (
    episode.manuscriptStatus !== 'approved_complete' ||
    !episode.proseComplete ||
    !episode.prose?.trim()
  ) {
    blockers.push('manuscript_incomplete');
  }
  if (episode.mediaGate !== 'clear' || mediaGateFor(assets) !== 'clear') {
    blockers.push('media_blocked');
  }
  return blockers;
}

export type ReadableDecision = {
  readable: boolean;
  reason:
    | 'released'
    | 'outline_only'
    | 'manuscript_incomplete'
    | 'media_blocked'
    | 'not_approved'
    | 'paused'
    | 'not_yet_released';
};

export function memberReadable(
  episode: CatalogEpisode,
  assets: AssetRow[],
  now = new Date(),
): ReadableDecision {
  if (episode.seasonEmergencyStop || episode.seasonPaused || episode.paused || episode.status === 'paused') {
    return { readable: false, reason: 'paused' };
  }
  if (episode.status === 'outline_only' || episode.manuscriptStatus === 'outline_only') {
    return { readable: false, reason: 'outline_only' };
  }
  if (
    episode.manuscriptStatus !== 'approved_complete' ||
    !episode.proseComplete ||
    !episode.prose?.trim()
  ) {
    return { readable: false, reason: 'manuscript_incomplete' };
  }
  if (episode.mediaGate !== 'clear' || mediaGateFor(assets) !== 'clear') {
    return { readable: false, reason: 'media_blocked' };
  }
  if (!episode.approvedAt || !READABLE_STATUSES.has(episode.status)) {
    return { readable: false, reason: 'not_approved' };
  }
  const releaseAt = Date.parse(episode.releaseAt);
  if (!Number.isFinite(releaseAt) || releaseAt > now.getTime()) {
    return { readable: false, reason: 'not_yet_released' };
  }
  return { readable: true, reason: 'released' };
}

export function episodeSourceKey(episodeId: string): string {
  return `kl:episode:v1:${episodeId}`;
}

export function seasonSourceKey(seasonId: string): string {
  return `kl:season:v1:${seasonId}`;
}

export function pointsFromRule(rule: PointRule | null | undefined): number | null {
  if (!rule || !rule.isActive) return null;
  if (!Number.isInteger(rule.basePoints) || !Number.isInteger(rule.maxPointsPerEvent)) return null;
  const award = Math.min(rule.basePoints, rule.maxPointsPerEvent);
  if (award < 1) return null;
  return award;
}

export function planEpisodeCompletion(input: {
  readable: boolean;
  alreadyCompleted: boolean;
  ledgerExists: boolean;
  rule: PointRule | null;
  episodeId: string;
}): CompletionPlan {
  const sourceKey = episodeSourceKey(input.episodeId);
  if (!input.readable) {
    return {
      writeProgress: false,
      writeLedger: false,
      points: null,
      sourceKey,
      claimState: null,
      alreadyCompleted: false,
      error: 'not_readable',
    };
  }
  if (input.alreadyCompleted || input.ledgerExists) {
    return {
      writeProgress: false,
      writeLedger: false,
      points: 0,
      sourceKey,
      claimState: null,
      alreadyCompleted: true,
      error: null,
    };
  }
  const points = pointsFromRule(input.rule);
  if (points == null || input.rule?.activityType !== KL_EPISODE_RULE) {
    return {
      writeProgress: false,
      writeLedger: false,
      points: null,
      sourceKey,
      claimState: null,
      alreadyCompleted: false,
      error: 'reward_rule_missing',
    };
  }
  return {
    writeProgress: true,
    writeLedger: true,
    points,
    sourceKey,
    claimState: 'pending',
    alreadyCompleted: false,
    error: null,
  };
}

export function planSeasonCompletion(input: {
  completedEpisodeCount: number;
  requiredEpisodeCount: number;
  alreadyCompleted: boolean;
  ledgerExists: boolean;
  rule: PointRule | null;
  seasonId: string;
}): CompletionPlan {
  const sourceKey = seasonSourceKey(input.seasonId);
  const ready = input.completedEpisodeCount === input.requiredEpisodeCount && input.requiredEpisodeCount > 0;
  if (!ready) {
    return {
      writeProgress: false,
      writeLedger: false,
      points: null,
      sourceKey,
      claimState: null,
      alreadyCompleted: false,
      error: 'season_incomplete',
    };
  }
  if (input.alreadyCompleted || input.ledgerExists) {
    return {
      writeProgress: false,
      writeLedger: false,
      points: 0,
      sourceKey,
      claimState: null,
      alreadyCompleted: true,
      error: null,
    };
  }
  const points = pointsFromRule(input.rule);
  if (points == null || input.rule?.activityType !== KL_SEASON_RULE) {
    return {
      writeProgress: false,
      writeLedger: false,
      points: null,
      sourceKey,
      claimState: null,
      alreadyCompleted: false,
      error: 'reward_rule_missing',
    };
  }
  return {
    writeProgress: true,
    writeLedger: true,
    points,
    sourceKey,
    claimState: 'pending',
    alreadyCompleted: false,
    error: null,
  };
}

export function applyCompletion(
  plan: CompletionPlan,
  state: { progress: Set<string>; ledger: Set<string> },
  progressId: string,
): CompletionPlan {
  if (!plan.writeLedger || !plan.writeProgress || !plan.sourceKey || plan.points == null) return plan;
  if (state.ledger.has(plan.sourceKey) || state.progress.has(progressId)) {
    return { ...plan, writeLedger: false, writeProgress: false, points: 0, alreadyCompleted: true };
  }
  state.ledger.add(plan.sourceKey);
  state.progress.add(progressId);
  return plan;
}
