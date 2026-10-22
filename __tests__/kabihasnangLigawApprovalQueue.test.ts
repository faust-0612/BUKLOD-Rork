import { buildCatalogEpisodes } from '@/lib/kabihasnang-ligaw/catalog';
import { memberReadable } from '@/lib/kabihasnang-ligaw/gates';
import {
  approvalArrivalAt,
  approvalQueue,
  isReleasedForApproval,
  liveReleaseAt,
  manilaCivilDate,
  manilaDayRelation,
  nextApprovalArrival,
  nextLiveRelease,
} from '@/lib/kabihasnang-ligaw/approvalQueue';

describe('Kabihasnang Ligaw approval window', () => {
  it('has Kabanata 2 and 3 for approval after 6:00 p.m. on 22 October, because Kabanata 2 is live the next morning', () => {
    const afterSix = new Date('2026-10-22T10:30:00.000Z');
    expect(manilaCivilDate(afterSix)).toBe('2026-10-22');
    expect(approvalQueue(afterSix).map((entry) => entry.episodeNumber)).toEqual([2, 3]);
    expect(nextLiveRelease(afterSix)?.episodeNumber).toBe(2);
    expect(manilaDayRelation(afterSix, nextLiveRelease(afterSix)!.at)).toBe('tomorrow');
    expect(liveReleaseAt(2)?.toISOString()).toBe('2026-10-22T22:00:00.000Z');
    expect(nextApprovalArrival(afterSix)?.episodeNumber).toBe(4);
    expect(manilaDayRelation(afterSix, nextApprovalArrival(afterSix)!.at)).toBe('tomorrow');
    expect(approvalArrivalAt(4)?.toISOString()).toBe('2026-10-23T10:00:00.000Z');
  });

  it('holds Kabanata 3 until 6:00 p.m. and Kabanata 4 until the next evening', () => {
    const beforeSix = new Date('2026-10-22T09:59:00.000Z');
    expect(approvalQueue(beforeSix).map((entry) => entry.episodeNumber)).toEqual([2]);
    expect(isReleasedForApproval(3, beforeSix)).toBe(false);

    const nextAfternoon = new Date('2026-10-23T09:59:00.000Z');
    expect(approvalQueue(nextAfternoon).map((entry) => entry.episodeNumber)).toEqual([2, 3]);

    const nextEvening = new Date('2026-10-23T10:00:00.000Z');
    expect(approvalQueue(nextEvening).map((entry) => entry.episodeNumber)).toEqual([2, 3, 4]);
    expect(nextLiveRelease(nextEvening)?.episodeNumber).toBe(3);
  });

  it('stops at Kabanata 30 and does not open Panimula or Kabanata 1 through this window', () => {
    const afterLast = new Date('2026-11-18T10:00:00.000Z');
    expect(approvalQueue(afterLast)).toHaveLength(29);
    expect(approvalQueue(afterLast).at(-1)?.episodeNumber).toBe(30);
    expect(nextApprovalArrival(afterLast)).toBeNull();
    expect(isReleasedForApproval(1, afterLast)).toBe(false);
    expect(approvalArrivalAt(2)?.toISOString()).toBe('2026-10-21T10:00:00.000Z');
  });

  it('does not let an approval slot become member-readable', () => {
    const chapter = buildCatalogEpisodes().find((item) => item.episodeNumber === 2);
    expect(chapter).toBeTruthy();
    const now = new Date('2026-10-22T10:30:00.000Z');
    expect(isReleasedForApproval(2, now)).toBe(true);
    expect(memberReadable(chapter!, [], now).readable).toBe(false);
  });
});