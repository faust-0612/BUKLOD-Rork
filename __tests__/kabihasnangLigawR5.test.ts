import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { resolveAudioChannel, resumeAfterYield } from '../src/lib/kabihasnang-ligaw/audioPolicy';
import {
  buildAssetGate,
  buildCatalogEpisodes,
  buildMediaManifest,
  buildStoryboard,
  KL_CHAPTER_ONE_LIVING_SCOPE,
  KL_PROTAGONISTS,
  KL_PUBLISHED_SPECIAL_CAST,
  KL_UNRESOLVED_NAME,
} from '../src/lib/kabihasnang-ligaw/catalog';
import { klCopy } from '../src/lib/kabihasnang-ligaw/copy';
import {
  applyCompletion,
  isManilaSix,
  manilaSixUtc,
  mediaGateFor,
  memberReadable,
  planEpisodeCompletion,
  planSeasonCompletion,
  publicationBlockers,
} from '../src/lib/kabihasnang-ligaw/gates';
import { journeyMark, journeySummary } from '../src/lib/kabihasnang-ligaw/journey';
import { isLowBandwidth, resolveLivingMotion, visibleLivingLayers } from '../src/lib/kabihasnang-ligaw/livingMotion';
import {
  paragraphDisplayText,
  resolveAnchorRange,
  sceneRangesAreOrdered,
  splitCanonicalParagraphs,
} from '../src/lib/kabihasnang-ligaw/manuscript';
import {
  imageSlot,
  queueReaderIssue,
  rememberScroll,
  sanitizeReaderCache,
  sceneArtDecision,
  selectMemberReading,
} from '../src/lib/kabihasnang-ligaw/readerSession';
import { KL_EPISODE_RULE, KL_SEASON_RULE } from '../src/lib/kabihasnang-ligaw/types';
import type { AssetRow, CatalogEpisode, PointRule } from '../src/lib/kabihasnang-ligaw/types';

const root = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const episodeRule: PointRule = {
  activityType: KL_EPISODE_RULE,
  basePoints: 2,
  maxPointsPerEvent: 2,
  isActive: true,
};

const seasonRule: PointRule = {
  activityType: KL_SEASON_RULE,
  basePoints: 10,
  maxPointsPerEvent: 10,
  isActive: true,
};

function readableFixture(): { episode: CatalogEpisode; assets: AssetRow[] } {
  const episode: CatalogEpisode = {
    ...buildCatalogEpisodes()[1],
    status: 'live',
    manuscriptStatus: 'approved_complete',
    prose: 'Approved paragraph.',
    proseComplete: true,
    mediaGate: 'clear',
    approvedAt: '2026-10-20T22:00:00.000Z',
    releaseAt: '2026-10-20T22:00:00.000Z',
  };
  const assets: AssetRow[] = [
    {
      id: 'ok',
      kind: 'illustration',
      episodeId: episode.id,
      sceneId: 'scene',
      path: 'approved.png',
      classification: 'APPROVED',
      required: true,
      approved: true,
      reason: 'Owner approval record in this fixture only.',
    },
  ];
  return { episode, assets };
}

describe('Kabihasnang Ligaw R5 gates', () => {
  const catalog = buildCatalogEpisodes();
  const storyboard = buildStoryboard();
  const assets = buildAssetGate();

  it('keeps the cast order and leaves Jawo/Javvo unpublished', () => {
    expect(KL_PROTAGONISTS).toEqual(['Phan', 'Quin', 'Van', 'Christian', 'Lhen']);
    expect(KL_PUBLISHED_SPECIAL_CAST).not.toContain('Jawo');
    expect(KL_PUBLISHED_SPECIAL_CAST).not.toContain('Javvo');
    expect(KL_UNRESOLVED_NAME.published).toBe(false);
    expect(KL_UNRESOLVED_NAME.resolved).toBe(false);
  });

  it('does not publish Panimula, Kabanata 1, or episodes 2–30', () => {
    expect(catalog).toHaveLength(31);
    const panimulaFile = read('content/kabihasnang-ligaw/panimula.md');
    const chapterFile = read('content/kabihasnang-ligaw/kabanata-01.md');
    expect(catalog[0].prose).toBe(panimulaFile);
    expect(catalog[1].prose).toBe(chapterFile);
    expect(catalog[0].proseSha256).toBe(crypto.createHash('sha256').update(panimulaFile).digest('hex'));
    expect(catalog[1].proseSha256).toBe(crypto.createHash('sha256').update(chapterFile).digest('hex'));
    expect(panimulaFile.startsWith('### KABIHASNANG LIGAW\n')).toBe(true);
    expect(panimulaFile.endsWith('hinintay na marinig.\n')).toBe(true);
    expect(chapterFile.startsWith('### UNANG SERYE\n')).toBe(true);
    expect(chapterFile.endsWith('WAKAS NG KABANATA 1\n')).toBe(true);
    expect(catalog[0].proseComplete).toBe(true);
    expect(catalog[1].proseComplete).toBe(true);
    expect(catalog[0].manuscriptStatus).toBe('approved_complete');
    expect(catalog[1].status).toBe('draft');
    expect(catalog[1].approvedAt).toBeNull();
    const panimulaParagraphs = splitCanonicalParagraphs(panimulaFile, 0);
    const chapterParagraphs = splitCanonicalParagraphs(chapterFile, 1);
    expect(panimulaParagraphs[0].id).toBe('kl-e00-p001');
    expect(chapterParagraphs[chapterParagraphs.length - 1].id).toBe(`kl-e01-p${String(chapterParagraphs.length).padStart(3, '0')}`);
    expect(chapterParagraphs[chapterParagraphs.length - 1].text).toBe('WAKAS NG KABANATA 1');
    expect(paragraphDisplayText(panimulaParagraphs[0])).toBe('KABIHASNANG LIGAW');
    expect(paragraphDisplayText(chapterParagraphs[3])).toBe(chapterParagraphs[3].text);
    for (const episode of catalog) {
      const rows = assets.filter((asset) => asset.episodeId === episode.id);
      expect(memberReadable(episode, rows, new Date(), storyboard).readable).toBe(false);
      expect(publicationBlockers(episode, rows).length).toBeGreaterThan(0);
      if (episode.episodeNumber >= 2) {
        expect(episode.prose).toBeNull();
        expect(episode.proseComplete).toBe(false);
      }
    }
    expect(memberReadable(catalog[0], [], new Date(), storyboard).reason).toBe('media_blocked');
    expect(memberReadable(catalog[1], [], new Date(), storyboard).reason).toBe('media_blocked');
    expect(memberReadable(catalog[2], []).reason).toBe('outline_only');
    expect(selectMemberReading({
      locallyReadable: false,
      serverState: 'unknown',
      serverText: null,
      bundledText: catalog[1].prose,
      cachedText: catalog[1].prose,
    }).text).toBeNull();
    expect(storyboard.filter((row) => row.episodeNumber >= 2).every((row) =>
      row.status === 'OUTLINE ONLY / MANUSCRIPT NOT APPROVED / NO ARTWORK' &&
      row.editorialIntent === null &&
      row.paragraphRange === null,
    )).toBe(true);
  });

  it('binds no invented paragraph ranges and leaves artwork pending', () => {
    const chapter = storyboard.filter((row) => row.episodeNumber === 1);
    expect(chapter).toHaveLength(5);
    expect(chapter.every((row) => row.paragraphRangeStatus === 'BOUND' && row.paragraphRange != null && row.approved === false)).toBe(true);
    const ranges = chapter.flatMap((row) => (row.paragraphRange ? [row.paragraphRange] : []));
    expect(sceneRangesAreOrdered(ranges)).toBe(true);
    expect(chapter[4].spoiler).toBe(true);
    expect(chapter.slice(0, 4).every((row) => row.spoiler === false)).toBe(true);
    const reveal = chapter[4].paragraphRange;
    const paragraphs = splitCanonicalParagraphs(catalog[1].prose ?? '', 1);
    const missingShadow = paragraphs.filter((paragraph) => paragraph.text.includes('walang aninong sumusunod'));
    const duplicatedVoice = paragraphs.filter((paragraph) => paragraph.text.includes('Bakit mo ako iniwan'));
    expect(missingShadow).toHaveLength(1);
    expect(duplicatedVoice).toHaveLength(1);
    expect(reveal != null && missingShadow[0].index >= reveal.start && missingShadow[0].index <= reveal.end).toBe(true);
    expect(reveal != null && duplicatedVoice[0].index >= reveal.start && duplicatedVoice[0].index <= reveal.end).toBe(true);
    expect(resolveAnchorRange(paragraphs, 'missing anchor phrase', 'missing anchor phrase').ok).toBe(false);
    expect(resolveAnchorRange(
      [
        { id: 'a', index: 1, text: 'same phrase', kind: 'body' },
        { id: 'b', index: 2, text: 'same phrase', kind: 'body' },
      ],
      'same phrase',
      'same phrase',
    ).ok).toBe(false);
    expect(storyboard[0].paragraphRangeStatus).toBe('NO_SCENE_ANCHORS');
    expect(storyboard[0].paragraphRange).toBeNull();
    expect(KL_CHAPTER_ONE_LIVING_SCOPE.find((row) => row.layer === 'rain')?.activation).toBe('FORBIDDEN_NOT_IN_CHAPTER_TEXT');
    expect(KL_CHAPTER_ONE_LIVING_SCOPE.find((row) => row.layer === 'rain')?.paragraphRange).toBeNull();
    expect(KL_CHAPTER_ONE_LIVING_SCOPE.filter((row) => row.layer !== 'rain').every((row) =>
      row.paragraphRange != null && row.approved === false,
    )).toBe(true);
    expect(KL_CHAPTER_ONE_LIVING_SCOPE.find((row) => row.layer === 'water_ripples')?.activation).toBe('CLOSING_REVEAL_ONLY');
    expect(assets.every((asset) => asset.approved === false)).toBe(true);
    expect(assets.find((asset) => asset.kind === 'music')?.required).toBe(true);
    expect(assets.find((asset) => asset.kind === 'ambient')?.required).toBe(true);
    expect(assets.filter((asset) => asset.classification === 'APPROVED').map((asset) => asset.path)).toEqual([
      'docs/kabihasnang-ligaw-approved-creative-release-contract-r5.md',
    ]);
    expect(assets.some((asset) => asset.classification === 'MISSING' && asset.kind === 'music')).toBe(true);
  });

  it('keeps an approved chapter readable after 06:00 and locks unapproved chapters', () => {
    const { episode, assets: ready } = readableFixture();
    const morning = new Date('2026-10-21T00:30:00.000Z');
    expect(isManilaSix(episode.releaseAt)).toBe(true);
    expect(memberReadable(episode, ready, morning).readable).toBe(true);
    const later = new Date('2026-10-22T02:00:00.000Z');
    expect(memberReadable(episode, ready, later).readable).toBe(true);
    expect(memberReadable({ ...episode, approvedAt: null, status: 'draft' }, ready, later).reason).toBe('not_approved');
    expect(memberReadable(catalog[1], ready, later, storyboard).readable).toBe(false);
    expect(memberReadable(episode, ready, morning, [{
      episodeId: episode.id,
      required: true,
      approved: true,
      paragraphRange: { start: 1, end: 2 },
    }]).readable).toBe(true);
    expect(manilaSixUtc('2026-10-21')).toBe('2026-10-20T22:00:00.000Z');
    expect(isManilaSix('2026-10-20T23:00:00.000Z')).toBe(false);
  });

  it('awards configured points once and keeps journey off the ledger', () => {
    const state = { progress: new Set<string>(), ledger: new Set<string>() };
    const first = planEpisodeCompletion({
      readable: true,
      alreadyCompleted: false,
      ledgerExists: false,
      rule: episodeRule,
      episodeId: 'episode-1',
    });
    expect(first.points).toBe(2);
    expect(first.claimState).toBe('pending');
    applyCompletion(first, state, 'episode-1');
    const second = applyCompletion(
      planEpisodeCompletion({
        readable: true,
        alreadyCompleted: false,
        ledgerExists: state.ledger.has(first.sourceKey),
        rule: { ...episodeRule, basePoints: 9, maxPointsPerEvent: 9 },
        episodeId: 'episode-1',
      }),
      state,
      'episode-1',
    );
    expect(second.writeLedger).toBe(false);
    expect(second.alreadyCompleted).toBe(true);
    expect(planEpisodeCompletion({
      readable: false,
      alreadyCompleted: false,
      ledgerExists: false,
      rule: episodeRule,
      episodeId: 'episode-1',
    }).error).toBe('not_readable');
    expect(planSeasonCompletion({
      completedEpisodeCount: 30,
      requiredEpisodeCount: 30,
      alreadyCompleted: false,
      ledgerExists: false,
      rule: seasonRule,
      seasonId: 'season-1',
    }).points).toBe(10);
    expect(planSeasonCompletion({
      completedEpisodeCount: 1,
      requiredEpisodeCount: 30,
      alreadyCompleted: false,
      ledgerExists: false,
      rule: seasonRule,
      seasonId: 'season-1',
    }).error).toBe('season_incomplete');
    expect(journeyMark('episode-1', 40, false)).toBeNull();
    expect(journeyMark('episode-1', 140, true)?.ledgerSourceKey).toBeNull();
    expect(journeySummary(0, 30)).toEqual({ completed: 0, total: 30, percent: 0 });
  });

  it('stays silent without a licensed asset and yields to other audio', () => {
    expect(resolveAudioChannel({
      channel: 'music',
      assetStatus: 'MISSING',
      userIntentPlaying: true,
      otherAudioPlaying: false,
      failed: false,
    })).toMatchObject({ audible: false, autoplay: false, message: 'silent_missing' });
    expect(resolveAudioChannel({
      channel: 'ambient',
      assetStatus: 'APPROVED',
      userIntentPlaying: true,
      otherAudioPlaying: true,
      failed: false,
    })).toMatchObject({ audible: false, yielded: true });
    expect(resolveAudioChannel({
      channel: 'music',
      assetStatus: 'APPROVED',
      userIntentPlaying: false,
      otherAudioPlaying: false,
      failed: false,
    }).message).toBe('paused');
    expect(resumeAfterYield({
      hadUserIntent: true,
      otherAudioPlaying: false,
      assetStatus: 'APPROVED',
    })).toBe(true);
    expect(resumeAfterYield({
      hadUserIntent: false,
      otherAudioPlaying: false,
      assetStatus: 'APPROVED',
    })).toBe(false);
  });

  it('does not animate Chapter 1 until a manuscript paragraph is bound', () => {
    expect(resolveLivingMotion({
      boundToManuscriptParagraph: false,
      manuscriptApprovedComplete: false,
      ownerApproved: false,
      depictsStory: true,
      technicalFixture: false,
      allowUnapprovedPreview: true,
      visible: true,
      appActive: true,
      reduceMotion: false,
      userMotionEnabled: true,
      batterySaver: false,
      lowBandwidth: false,
      layers: ['rain', 'magical_glow', 'water_ripples'],
    })).toMatchObject({ animate: false, reason: 'manuscript_unbound', layers: [] });

    expect(resolveLivingMotion({
      boundToManuscriptParagraph: false,
      manuscriptApprovedComplete: false,
      ownerApproved: false,
      depictsStory: false,
      technicalFixture: true,
      allowUnapprovedPreview: true,
      visible: true,
      appActive: true,
      reduceMotion: false,
      userMotionEnabled: true,
      batterySaver: false,
      lowBandwidth: false,
    }).reason).toBe('provisional_fixture');

    expect(resolveLivingMotion({
      boundToManuscriptParagraph: false,
      manuscriptApprovedComplete: false,
      ownerApproved: false,
      depictsStory: false,
      technicalFixture: true,
      allowUnapprovedPreview: true,
      visible: false,
      appActive: false,
      reduceMotion: true,
      userMotionEnabled: false,
      batterySaver: true,
      lowBandwidth: true,
    }).reason).toBe('paused');

    expect(resolveLivingMotion({
      boundToManuscriptParagraph: true,
      manuscriptApprovedComplete: true,
      ownerApproved: true,
      depictsStory: true,
      technicalFixture: false,
      allowUnapprovedPreview: false,
      visible: true,
      appActive: true,
      reduceMotion: false,
      userMotionEnabled: true,
      batterySaver: false,
      lowBandwidth: false,
      layers: ['rain'],
    }).reason).toBe('forbidden_layer');
    const reveal = KL_CHAPTER_ONE_LIVING_SCOPE.find((row) => row.layer === 'water_ripples');
    expect(visibleLivingLayers({
      layers: KL_CHAPTER_ONE_LIVING_SCOPE,
      viewStart: 1,
      viewEnd: 8,
      revealParagraph: reveal?.paragraphRange?.start ?? null,
    }).includes('water_ripples')).toBe(false);
    expect(visibleLivingLayers({
      layers: KL_CHAPTER_ONE_LIVING_SCOPE,
      viewStart: 1,
      viewEnd: 8,
      revealParagraph: reveal?.paragraphRange?.start ?? null,
    }).includes('rain')).toBe(false);
  });

  it('withholds images on a weak connection and does not cache locked reading progress', () => {
    expect(isLowBandwidth({ online: false, connectionType: 'wifi', userDataSaver: false })).toBe(true);
    expect(imageSlot(null, false).message).toBe('missing');
    expect(imageSlot('https://example.test/scene.png', true).showImage).toBe(false);
    const cache = sanitizeReaderCache(null);
    const next = rememberScroll(cache, 'locked', 80, false);
    expect(next.scrollByEpisode.locked).toBeUndefined();
    expect(next.lastEpisodeId).toBe('locked');
    expect(queueReaderIssue(cache, { kind: 'unlock', detail: 'x'.repeat(400), at: 't' }).issues[0].detail).toHaveLength(180);
    expect(mediaGateFor([])).toBe('missing');
    expect(sceneArtDecision({
      spoiler: true,
      rangeStart: 186,
      reachedParagraph: 10,
      approvedUri: 'https://example.test/reveal.png',
      lowBandwidth: false,
    }).message).toBe('spoiler_held');
    expect(sceneArtDecision({
      spoiler: true,
      rangeStart: 186,
      reachedParagraph: 186,
      approvedUri: 'https://example.test/reveal.png',
      lowBandwidth: true,
    }).showImage).toBe(false);
  });

  it('keeps member copy free of allegory, unresolved names, and system jargon', () => {
    const text = Object.values(klCopy).join('\n');
    expect(text.toLowerCase()).not.toMatch(/jawo|javvo|allegory|one mind|ledger|rpc|row level/);
    expect(text).toContain('Hindi pa mababasa');
    expect(read('src/app/kabihasnang-ligaw.tsx')).not.toContain('Ang unang tahanang gumuho');
    expect(read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx')).not.toContain('oscillator');
  });

  it('keeps the wall card between LIFE and BUKLOD TODAY', () => {
    const wall = read('src/app/(tabs)/buklod.tsx');
    const life = wall.indexOf('<BuklodLifeWallCard />');
    const story = wall.indexOf('<KabihasnangLigawWallCard />');
    const today = wall.indexOf('<BuklodTodayCard');
    expect(life).toBeGreaterThan(0);
    expect(life).toBeLessThan(story);
    expect(story).toBeLessThan(today);
  });

  it('locks the SQL candidate to server checks, config points, and no cash ledger', () => {
    const sql = read('supabase/migrations/20261021153000_kabihasnang_ligaw_r5_reader_admin.sql');
    expect(sql).toContain('buklod_is_system_admin');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain("'kl_episode_completion'");
    expect(sql).toContain('2, 2');
    expect(sql).toContain("'kl_season_completion'");
    expect(sql).toContain('10, 10');
    expect(sql).toContain('claim_state');
    expect(sql).toContain('on conflict (user_id, source_key) do nothing');
    expect(sql).toContain('kl_audit_immutable');
    expect(sql).not.toContain('bayanihan_ledger');
    expect(sql).not.toContain('Ang unang tahanang gumuho');
    expect(sql).not.toContain('grant insert');
    expect(sql.toLowerCase()).not.toContain('javvo');
    const manifest = buildMediaManifest();
    expect(manifest.rcFrozen).toBe(false);
    expect(manifest.manuscript).toBe('CANONICAL_IMPORTED_UNPUBLISHED');
    expect(manifest.assetGate).toBe('BLOCKED_NO_ORIGINAL_SCENE_ART');
    expect(manifest.audioGate).toBe('BLOCKED_NO_RIGHTS_CLEARED_FILE');
    expect(manifest.ownerImageApproval).toBe('pending');
    const canonicalSql = read('supabase/migrations/20261021234500_kabihasnang_ligaw_r5_canonical_text.sql');
    expect(canonicalSql).toContain(catalog[0].proseSha256 ?? '');
    expect(canonicalSql).toContain(catalog[1].proseSha256 ?? '');
    expect(canonicalSql).toContain('FORBIDDEN_NOT_IN_CHAPTER_TEXT');
    expect(canonicalSql).toContain('one_episode_per_manila_day');
    expect(canonicalSql).toContain('pg_advisory_xact_lock');
    expect(canonicalSql).not.toContain('bayanihan_ledger');
    expect(read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx')).not.toContain('May mga lugar sa daigdig na hindi makikita');
    const exported = JSON.parse(read('docs/kabihasnang-ligaw-r5-media-storyboard-manifest.json'));
    expect(exported).toEqual(manifest);
  });
});
