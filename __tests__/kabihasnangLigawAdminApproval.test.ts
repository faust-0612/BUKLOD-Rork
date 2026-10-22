import {
  adminApprovalBlockers,
  defaultAdminFlow,
  emptyDraft,
  friendlyEpisodeLabel,
  isMemberReleasedEpisode,
  markEpisodeApproved,
  mergeEpisodeForAdmin,
  nextApprovalEpisodeNumber,
  patchEpisodeDraft,
  sanitizeAdminFlow,
} from '@/lib/kabihasnang-ligaw/adminApproval';
import { buildCatalogEpisodes, KL_RELEASED_THROUGH_EPISODE } from '@/lib/kabihasnang-ligaw/catalog';
import { paragraphDisplayText, splitCanonicalParagraphs } from '@/lib/kabihasnang-ligaw/manuscript';

const episodes = buildCatalogEpisodes();

describe('Kabihasnang Ligaw admin approval desk', () => {
  it('treats Panimula and Kabanata 1 as already released', () => {
    expect(KL_RELEASED_THROUGH_EPISODE).toBe(1);
    expect(isMemberReleasedEpisode(0)).toBe(true);
    expect(isMemberReleasedEpisode(1)).toBe(true);
    expect(isMemberReleasedEpisode(2)).toBe(false);
    expect(episodes.find((item) => item.episodeNumber === 0)?.status).toBe('live');
    expect(episodes.find((item) => item.episodeNumber === 1)?.status).toBe('live');
  });

  it('starts the approval queue at Kabanata 02', () => {
    const flow = defaultAdminFlow(episodes);
    expect(flow.focusEpisodeNumber).toBe(2);
    expect(nextApprovalEpisodeNumber(episodes, {})).toBe(2);
  });

  it('hides paragraph codes from the exact release preview helper', () => {
    const chapter = episodes.find((item) => item.episodeNumber === 1);
    expect(chapter?.prose).toBeTruthy();
    const paragraphs = splitCanonicalParagraphs(chapter!.prose!, 1);
    const shown = paragraphs.map((paragraph) => paragraphDisplayText(paragraph)).join('\n');
    expect(shown).not.toMatch(/kl-e\d+-p\d+/);
    expect(shown).toContain('Lunawen');
  });

  it('requires story, picture, motion, and music before approve', () => {
    const chapter = episodes.find((item) => item.episodeNumber === 2)!;
    const empty = emptyDraft(chapter.title);
    expect(adminApprovalBlockers(chapter, empty, true).length).toBeGreaterThan(0);

    const ready = {
      ...empty,
      prose: '### KABANATA 2\n\nUnang talata ng susunod na gabi.',
      imageKey: 'series-poster',
      animationApplied: true,
      musicApplied: true,
    };
    expect(adminApprovalBlockers(chapter, ready, true)).toEqual([]);
    expect(friendlyEpisodeLabel(chapter, ready)).toBe('Ready to approve');
  });

  it('advances next-release focus after a local approve', () => {
    const chapter = episodes.find((item) => item.episodeNumber === 2)!;
    let flow = defaultAdminFlow(episodes);
    flow = patchEpisodeDraft(flow, chapter.id, {
      prose: 'Handang teksto',
      imageKey: 'series-poster',
      animationApplied: true,
      musicApplied: true,
    });
    flow = markEpisodeApproved(
      flow,
      mergeEpisodeForAdmin(chapter, flow.drafts[chapter.id]),
      episodes,
      '2026-10-23',
    );
    expect(flow.focusEpisodeNumber).toBe(3);
    expect(flow.drafts[chapter.id].approvedLocally).toBe(true);
    expect(flow.nextRelease?.title).toBeTruthy();
    expect(flow.nextRelease?.manilaDate).toBe('2026-10-23');
    expect(flow.nextRelease?.prose).toContain('Handang teksto');
  });

  it('round-trips stored flow without dropping revision feedback shape', () => {
    const raw = {
      version: 1,
      focusEpisodeNumber: 4,
      drafts: {
        demo: {
          prose: 'Teksto',
          title: 'Kabanata 04',
          imageKey: 'chapter-strip',
          animationApplied: true,
          musicApplied: true,
          approvedLocally: false,
          approvedAt: null,
        },
      },
      revisions: [
        {
          id: 'a',
          episodeId: 'demo',
          at: '2026-10-22T10:00:00.000Z',
          direction: 'sent',
          text: 'Ayusin ang pangalawang talata',
          action: 'revise',
        },
      ],
      updatedAt: '2026-10-22T10:00:00.000Z',
    };
    const clean = sanitizeAdminFlow(raw, episodes);
    expect(clean.focusEpisodeNumber).toBe(4);
    expect(clean.revisions).toHaveLength(1);
    expect(clean.drafts.demo.prose).toBe('Teksto');
  });
});
