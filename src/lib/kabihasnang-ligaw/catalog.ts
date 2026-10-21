import type {
  AssetRow,
  CatalogEpisode,
  LivingScopeRow,
  StoryboardRow,
} from './types';

/**
 * Manuscript lock: Panimula and Kabanata 1 are CONTENT BLOCKED.
 * Searched and found no complete approved text:
 * - docs/kabihasnang-ligaw-approved-creative-release-contract-r5.md (summary only)
 * - docs/kabihasnang-ligaw-work-release-handoff-r5.md (says import the manuscript; names no full-text file)
 * - docs/kabihasnang-ligaw-story-admin-ota-gate-r5.md
 * - src/app/kabihasnang-ligaw.tsx (short preview only; not used here)
 * - release/BUKLOD_ENGINEERING_CHARTER.md (file absent)
 * Episode titles 2–30 are outline labels, not approved prose.
 * Jawo/Javvo is an unresolved owner blocker and is not published.
 */

export const KL_SEASON_ONE_ID = '22222222-2222-4222-8222-000000000001';
export const KL_AUTHOR = 'Likha ni Faustino Jr. M. Gabut';
export const KL_SEASON_ONE_TITLE = 'Ang Lupang Hindi Namamatay';
export const KL_CHAPTER_ONE_TITLE = 'Ang Gabi ng Pag-ahon';

export const KL_PROTAGONISTS = ['Phan', 'Quin', 'Van', 'Christian', 'Lhen'] as const;

/** Published special cast. The unresolved name is intentionally absent. */
export const KL_PUBLISHED_SPECIAL_CAST = [
  'Ace',
  'Elesur',
  'Mitch',
  'Niel',
  'Angel',
  'Vhen',
  'Trudice',
] as const;

export const KL_UNRESOLVED_NAME = {
  blocker: 'jawo_javvo_spelling',
  resolved: false,
  published: false,
} as const;

export const KL_MANUSCRIPT_SEARCH_PATHS = [
  'docs/kabihasnang-ligaw-approved-creative-release-contract-r5.md',
  'docs/kabihasnang-ligaw-work-release-handoff-r5.md',
  'docs/kabihasnang-ligaw-story-admin-ota-gate-r5.md',
  'src/app/kabihasnang-ligaw.tsx',
  'release/BUKLOD_ENGINEERING_CHARTER.md',
] as const;

/** Far-future 06:00 Asia/Manila. Time alone cannot unlock these rows. */
export const KL_LOCKED_RELEASE_AT = '2099-01-01T22:00:00.000Z';

export function klEpisodeId(episodeNumber: number): string {
  const tail = String(episodeNumber).padStart(12, '0');
  return `11111111-1111-4111-8111-${tail}`;
}

const CHAPTER_ONE_INTENTS = [
  'Phan tying harvested stalks in a quiet Lunawen storehouse as a floor crack forms.',
  'Mother and Tali at the doorway while earth and a pale-green veined root rise beside the storehouse.',
  'A small child gripping a fissure edge above luminous roots, Phan lowering a knotted rope.',
  'Phan hauling the child while the father\'s voice is heard; no visible ghost or physical father.',
  'Moonlit water vessel reflection and the child\'s absent cast shadow, preserving the narrative distinction: reflection visible, ground shadow absent.',
] as const;

function blockedStoryboard(
  episodeNumber: number,
  sceneId: string,
  editorialIntent: string | null,
  outline: boolean,
): StoryboardRow {
  return {
    episodeId: klEpisodeId(episodeNumber),
    sceneId,
    episodeNumber,
    paragraphRange: null,
    paragraphRangeStatus: outline ? 'OUTLINE_ONLY' : 'BLOCKED_NO_APPROVED_MANUSCRIPT',
    editorialIntent,
    status: outline
      ? 'OUTLINE ONLY / MANUSCRIPT NOT APPROVED / NO ARTWORK'
      : 'CONTENT BLOCKED / MANUSCRIPT NOT IN REPOSITORY / NO ARTWORK',
    artworkStatus: 'NO_ARTWORK',
    approvalStatus: 'pending',
    approved: false,
    required: true,
    livingLayers: [],
  };
}

export function buildStoryboard(): StoryboardRow[] {
  const panimula = blockedStoryboard(0, 's1-panimula-unbound', null, false);
  const chapterOne = CHAPTER_ONE_INTENTS.map((intent, index) =>
    blockedStoryboard(1, `s1-e01-shot-${String(index + 1).padStart(2, '0')}`, intent, false),
  );
  const outlines: StoryboardRow[] = [];
  for (let number = 2; number <= 30; number += 1) {
    outlines.push(
      blockedStoryboard(
        number,
        `s1-e${String(number).padStart(2, '0')}-outline`,
        null,
        true,
      ),
    );
  }
  return [panimula, ...chapterOne, ...outlines];
}

export const KL_CHAPTER_ONE_LIVING_SCOPE: LivingScopeRow[] = [
  {
    episodeId: klEpisodeId(1),
    layer: 'rain',
    activation: 'BLOCKED_UNTIL_WORD_FOR_WORD_MANUSCRIPT',
    paragraphRange: null,
    approved: false,
    note: 'Atmospheric rain stays inactive until that moment is present in the word-for-word approved manuscript.',
  },
  {
    episodeId: klEpisodeId(1),
    layer: 'wind_foliage',
    activation: 'BLOCKED_UNTIL_WORD_FOR_WORD_MANUSCRIPT',
    paragraphRange: null,
    approved: false,
    note: 'Environmental motion stays inactive until the approved manuscript names the moment.',
  },
  {
    episodeId: klEpisodeId(1),
    layer: 'magical_glow',
    activation: 'BLOCKED_UNTIL_WORD_FOR_WORD_MANUSCRIPT',
    paragraphRange: null,
    approved: false,
    note: 'Glowing-root light stays inactive until a real paragraph range is bound. Contract shot notes are not the manuscript.',
  },
  {
    episodeId: klEpisodeId(1),
    layer: 'water_ripples',
    activation: 'BLOCKED_UNTIL_WORD_FOR_WORD_MANUSCRIPT',
    paragraphRange: null,
    approved: false,
    note: 'Water-reflection motion stays inactive until a real paragraph range is bound.',
  },
];

export function buildCatalogEpisodes(): CatalogEpisode[] {
  const panimula: CatalogEpisode = {
    id: klEpisodeId(0),
    seasonId: KL_SEASON_ONE_ID,
    kind: 'panimula',
    episodeNumber: 0,
    title: 'Panimula',
    titleMode: 'canon_title',
    status: 'draft',
    manuscriptStatus: 'content_blocked',
    prose: null,
    proseComplete: false,
    mediaGate: 'missing',
    approvedAt: null,
    approvedBy: null,
    releaseAt: KL_LOCKED_RELEASE_AT,
    paused: false,
    seasonPaused: false,
    seasonEmergencyStop: false,
  };

  const chapterOne: CatalogEpisode = {
    ...panimula,
    id: klEpisodeId(1),
    kind: 'episode',
    episodeNumber: 1,
    title: KL_CHAPTER_ONE_TITLE,
  };

  const outlines: CatalogEpisode[] = [];
  for (let number = 2; number <= 30; number += 1) {
    outlines.push({
      ...panimula,
      id: klEpisodeId(number),
      kind: 'episode',
      episodeNumber: number,
      title: `Kabanata ${String(number).padStart(2, '0')}`,
      titleMode: 'outline_label',
      status: 'outline_only',
      manuscriptStatus: 'outline_only',
    });
  }

  return [panimula, chapterOne, ...outlines];
}

export function buildAssetGate(): AssetRow[] {
  const storyboardAssets: AssetRow[] = buildStoryboard().map((row) => ({
    id: `asset-${row.sceneId}`,
    kind: 'illustration',
    episodeId: row.episodeId,
    sceneId: row.sceneId,
    path: null,
    classification: 'MISSING',
    required: true,
    approved: false,
    reason: 'No scene-accurate illustration binary is in the repository. Owner approval is pending.',
  }));

  const repoAssets: AssetRow[] = [
    {
      id: 'asset-music',
      kind: 'music',
      episodeId: null,
      sceneId: null,
      path: null,
      classification: 'MISSING',
      required: false,
      approved: false,
      reason: 'No original or licensed melodic instrumental file is in the repository.',
    },
    {
      id: 'asset-ambient',
      kind: 'ambient',
      episodeId: null,
      sceneId: null,
      path: null,
      classification: 'MISSING',
      required: false,
      approved: false,
      reason: 'No original or licensed ambient bed is in the repository.',
    },
    {
      id: 'asset-font',
      kind: 'font',
      episodeId: null,
      sceneId: null,
      path: null,
      classification: 'MISSING',
      required: false,
      approved: false,
      reason: 'No bundled Filipino display font. The reader uses the platform font with readable body metrics.',
    },
    {
      id: 'asset-contract',
      kind: 'document',
      episodeId: null,
      sceneId: null,
      path: 'docs/kabihasnang-ligaw-approved-creative-release-contract-r5.md',
      classification: 'APPROVED',
      required: false,
      approved: false,
      reason: 'The file records creative-direction approval on 2026-10-20. Publication clearance stays off. Manuscripts, images, and audio are not approved.',
    },
    {
      id: 'asset-charter',
      kind: 'document',
      episodeId: null,
      sceneId: null,
      path: 'release/BUKLOD_ENGINEERING_CHARTER.md',
      classification: 'MISSING',
      required: false,
      approved: false,
      reason: 'Engineering charter path is not in the repository.',
    },
    {
      id: 'asset-r3-r4-visual',
      kind: 'layout',
      episodeId: null,
      sceneId: null,
      path: null,
      classification: 'MISSING',
      required: false,
      approved: false,
      reason: 'No separate R3/R4 visual-direction file was found under docs/.',
    },
    {
      id: 'asset-wall-card',
      kind: 'layout',
      episodeId: null,
      sceneId: null,
      path: 'src/components/KabihasnangLigawWallCard.tsx',
      classification: 'PROVISIONAL',
      required: false,
      approved: false,
      reason: 'Existing dashboard card is an earlier prototype, not final art approval.',
    },
    {
      id: 'asset-reader-prototype',
      kind: 'layout',
      episodeId: null,
      sceneId: null,
      path: 'src/app/kabihasnang-ligaw.tsx',
      classification: 'PROVISIONAL',
      required: false,
      approved: false,
      reason: 'Earlier reader prototype. Its short preview is not the approved manuscript.',
    },
    {
      id: 'asset-brand-generic',
      kind: 'illustration',
      episodeId: null,
      sceneId: null,
      path: 'assets/release/buklod-generic.png',
      classification: 'REJECTED',
      required: false,
      approved: false,
      reason: 'Unrelated branding image. Not a Kabihasnang Ligaw scene.',
    },
    {
      id: 'asset-brand-photo',
      kind: 'illustration',
      episodeId: null,
      sceneId: null,
      path: 'assets/release/buklod-generic-photo.jpg',
      classification: 'REJECTED',
      required: false,
      approved: false,
      reason: 'Unrelated branding photo. Not a Kabihasnang Ligaw scene.',
    },
    {
      id: 'asset-points-wav',
      kind: 'ambient',
      episodeId: null,
      sceneId: null,
      path: 'assets/sounds/buklod-points-claim.wav',
      classification: 'REJECTED',
      required: false,
      approved: false,
      reason: 'Points chime. Not licensed story music.',
    },
    {
      id: 'asset-reaction-wav',
      kind: 'ambient',
      episodeId: null,
      sceneId: null,
      path: 'assets/sounds/buklod-reaction.wav',
      classification: 'REJECTED',
      required: false,
      approved: false,
      reason: 'Interface tap. Not licensed story music.',
    },
    {
      id: 'asset-bible-rain',
      kind: 'ambient',
      episodeId: null,
      sceneId: null,
      path: 'assets/bible-ambience/rain.wav',
      classification: 'REJECTED',
      required: false,
      approved: false,
      reason: 'Bible ambience. No Kabihasnang Ligaw license or owner approval.',
    },
  ];

  return [...repoAssets, ...storyboardAssets];
}

export function buildMediaManifest() {
  return {
    version: 1,
    rcFrozen: false,
    ownerImageApproval: 'pending',
    manuscript: 'CONTENT_BLOCKED',
    jawoJavvo: KL_UNRESOLVED_NAME,
    seasonOne: {
      id: KL_SEASON_ONE_ID,
      protagonist: 'Phan',
      proposedTitle: KL_SEASON_ONE_TITLE,
      episodeCount: 30,
      ensembleNotInThisSeason: true,
    },
    episodes: buildCatalogEpisodes(),
    storyboard: buildStoryboard(),
    livingScope: KL_CHAPTER_ONE_LIVING_SCOPE,
    assets: buildAssetGate(),
    searchedManuscriptPaths: KL_MANUSCRIPT_SEARCH_PATHS,
  };
}
