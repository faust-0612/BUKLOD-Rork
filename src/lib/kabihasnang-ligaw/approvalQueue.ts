import { KL_RELEASE_HOUR, KL_TIME_ZONE } from './types';

/**
 * Kabihasnang Ligaw schedule, Asia/Manila.
 * Kabanata 2 targets 24 October 2026 at 6:00 a.m., subject to server approval and release gates.
 * Each later chapter goes live one day after that, at 6:00 a.m.
 * The draft for approval arrives at 6:00 p.m., two civil days before that live morning.
 * A draft in this window is not approved and is not visible to members.
 */
export const KL_APPROVAL_HOUR = 18;
export const KL_FIRST_LIVE_DATE = '2026-10-24';
export const KL_APPROVAL_FIRST_EPISODE = 2;
export const KL_APPROVAL_LAST_EPISODE = 30;

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ApprovalQueueEntry = {
  episodeNumber: number;
  /** Manila civil date the draft arrived for approval. */
  releasedOn: string;
  arrivedAt: Date;
  liveAt: Date;
};

export type ScheduledChapter = {
  episodeNumber: number;
  at: Date;
};

export function manilaCivilDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return KL_FIRST_LIVE_DATE;
  return `${year}-${month}-${day}`;
}

export function addCivilDays(isoDate: string, days: number): string {
  if (!CIVIL_DATE.test(isoDate) || !Number.isInteger(days)) return isoDate;
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function manilaClock(isoDate: string, hour: number): Date | null {
  if (!CIVIL_DATE.test(isoDate) || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const clock = new Date(`${isoDate}T${String(hour).padStart(2, '0')}:00:00+08:00`);
  if (!Number.isFinite(clock.getTime())) return null;
  if (manilaCivilDate(clock) !== isoDate) return null;
  return clock;
}

function liveDateFor(episodeNumber: number): string | null {
  if (!Number.isInteger(episodeNumber)) return null;
  if (episodeNumber < KL_APPROVAL_FIRST_EPISODE || episodeNumber > KL_APPROVAL_LAST_EPISODE) return null;
  return addCivilDays(KL_FIRST_LIVE_DATE, episodeNumber - KL_APPROVAL_FIRST_EPISODE);
}

export function liveReleaseAt(episodeNumber: number): Date | null {
  const date = liveDateFor(episodeNumber);
  return date ? manilaClock(date, KL_RELEASE_HOUR) : null;
}

export function approvalArrivalAt(episodeNumber: number): Date | null {
  const date = liveDateFor(episodeNumber);
  if (!date) return null;
  return manilaClock(addCivilDays(date, -2), KL_APPROVAL_HOUR);
}

export function approvalQueue(now: Date): ApprovalQueueEntry[] {
  const entries: ApprovalQueueEntry[] = [];
  for (let episodeNumber = KL_APPROVAL_FIRST_EPISODE; episodeNumber <= KL_APPROVAL_LAST_EPISODE; episodeNumber += 1) {
    const arrivedAt = approvalArrivalAt(episodeNumber);
    const liveAt = liveReleaseAt(episodeNumber);
    if (!arrivedAt || !liveAt || arrivedAt.getTime() > now.getTime()) continue;
    entries.push({
      episodeNumber,
      releasedOn: manilaCivilDate(arrivedAt),
      arrivedAt,
      liveAt,
    });
  }
  return entries;
}

export function isReleasedForApproval(episodeNumber: number, now: Date): boolean {
  const arrivedAt = approvalArrivalAt(episodeNumber);
  return arrivedAt != null && arrivedAt.getTime() <= now.getTime();
}

export function nextApprovalArrival(now: Date): ScheduledChapter | null {
  for (let episodeNumber = KL_APPROVAL_FIRST_EPISODE; episodeNumber <= KL_APPROVAL_LAST_EPISODE; episodeNumber += 1) {
    const at = approvalArrivalAt(episodeNumber);
    if (at && at.getTime() > now.getTime()) return { episodeNumber, at };
  }
  return null;
}

export function nextLiveRelease(now: Date): ScheduledChapter | null {
  for (let episodeNumber = KL_APPROVAL_FIRST_EPISODE; episodeNumber <= KL_APPROVAL_LAST_EPISODE; episodeNumber += 1) {
    const at = liveReleaseAt(episodeNumber);
    if (at && at.getTime() > now.getTime()) return { episodeNumber, at };
  }
  return null;
}

export function manilaDayRelation(now: Date, at: Date): 'today' | 'tomorrow' | 'later' {
  const today = manilaCivilDate(now);
  const target = manilaCivilDate(at);
  if (target === today) return 'today';
  if (target === addCivilDays(today, 1)) return 'tomorrow';
  return 'later';
}
