import {
  canonicalProse,
  paragraphsForEpisode,
  resolveAnchorRange,
  sceneRangesAreOrdered,
} from './manuscript';
import type {
  AssetRow,
  CatalogEpisode,
  LivingLayerKind,
  LivingScopeRow,
  ParagraphRange,
  StoryboardRow,
} from './types';

/**
 * Panimula and Kabanata 1 are the canonical markdown files and are already
 * readable for members (see canonicalMemberRelease). Approval work starts at
 * Kabanata 2. Episodes 2–30 begin as outline labels until prose is saved.
 * Jawo/Javvo is not published.
 * release/BUKLOD_ENGINEERING_CHARTER.md is not in this branch or on origin/main.
 */

/** Highest episode number already with members. Next approval is this + 1. */
export const KL_RELEASED_THROUGH_EPISODE = 1;

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
  'content/kabihasnang-ligaw/panimula.md',
  'content/kabihasnang-ligaw/kabanata-01.md',
  'release/BUKLOD_ENGINEERING_CHARTER.md',
] as const;

export const KL_PANIMULA_TITLE = 'Ang Daigdig na May Sariling Alaala';

/** Far-future 06:00 Asia/Manila. Time alone cannot unlock these rows. */
export const KL_LOCKED_RELEASE_AT = '2099-01-01T22:00:00.000Z';

export function klEpisodeId(episodeNumber: number): string {
  const tail = String(episodeNumber).padStart(12, '0');
  return `11111111-1111-4111-8111-${tail}`;
}

type SceneAnchor = {
  sceneId: string;
  startAnchor: string;
  endAnchor: string;
  editorialIntent: string;
  spoiler: boolean;
};

/** Literal anchors from docs/kabihasnang-ligaw-r5-chapter-01-living-storyboard.md. */
const CHAPTER_ONE_SCENES: readonly SceneAnchor[] = [
  {
    sceneId: 's1-e01-shot-01',
    startAnchor: 'Unang naramdaman ni Phan ang paggalaw',
    endAnchor: 'dahan-dahang humaba ang guhit',
    editorialIntent: 'Lunawen storehouse, tied stalks, grain jar rolling, hairline floor crack. No giant root or child. No rainfall.',
    spoiler: false,
  },
  {
    sceneId: 's1-e01-shot-02',
    startAnchor: 'Nakatayo sa bungad ang kanyang ina',
    endAnchor: 'may lumilitaw na maputlang liwanag.',
    editorialIntent: 'Mother, Tali, Phan, tilting homestead and grey massive root with pale green veins. No visible father. No rainfall.',
    spoiler: false,
  },
  {
    sceneId: 's1-e01-shot-03',
    startAnchor: 'Sa pagitan ng dalawang gumuhong bakod',
    endAnchor: 'Sa pagitan ng mga ito ay may liwanag',
    editorialIntent: 'Child gripping fissure edge, Phan reaching, tangled underground roots and light. Child looks ordinary. Do not hint at a missing shadow.',
    spoiler: false,
  },
  {
    sceneId: 's1-e01-shot-04',
    startAnchor: 'Hinila ni Phan ang lubid.',
    endAnchor: 'Nawala rin ang tinig ng kanyang ama.',
    editorialIntent: 'Phan securing rope, child rising, root at ankle, collapsing home. Father is a voice only, never a visible ghost. Do not expose a hidden creature form.',
    spoiler: false,
  },
  {
    sceneId: 's1-e01-shot-05',
    startAnchor: 'Ngunit pagdaan nila sa tabi ng isang nakatumbang sisidlang puno ng tubig',
    endAnchor: 'WAKAS NG KABANATA 1',
    editorialIntent: 'Moonlight, water reflection of the child, no child shadow on the ground, ruined house beyond. Closing reveal only.',
    spoiler: true,
  },
];

function emptyStoryboard(
  episodeNumber: number,
  sceneId: string,
  status: StoryboardRow['paragraphRangeStatus'],
  label: string,
  editorialIntent: string | null,
  spoiler: boolean,
): StoryboardRow {
  return {
    episodeId: klEpisodeId(episodeNumber),
    sceneId,
    episodeNumber,
    paragraphRange: null,
    paragraphRangeStatus: status,
    editorialIntent,
    status: label,
    artworkStatus: 'NO_ARTWORK',
    approvalStatus: 'pending',
    approved: false,
    required: true,
    spoiler,
    livingLayers: [],
  };
}

function layerWindow(
  layer: LivingLayerKind,
  startAnchor: string,
  endAnchor: string,
  activation: LivingScopeRow['activation'],
  note: string,
): LivingScopeRow {
  const resolved = resolveAnchorRange(paragraphsForEpisode(1), startAnchor, endAnchor);
  return {
    episodeId: klEpisodeId(1),
    layer,
    activation: resolved.ok ? activation : 'BLOCKED_ANCHOR_MISMATCH',
    paragraphRange: resolved.ok ? resolved.range : null,
    approved: false,
    note: resolved.ok ? note : `Anchor failed closed: ${resolved.reason}. ${note}`,
  };
}

export function buildChapterOneLivingScope(): LivingScopeRow[] {
  return [
    {
      episodeId: klEpisodeId(1),
      layer: 'rain',
      activation: 'FORBIDDEN_NOT_IN_CHAPTER_TEXT',
      paragraphRange: null,
      approved: false,
      note: 'Chapter 1 is a moonlit, windy night. Rainfall is not in the text and must not be drawn or animated.',
    },
    layerWindow(
      'wind_foliage',
      'pagaspas ng mga dahon',
      'pagaspas ng mga dahon',
      'BOUND_PENDING_OWNER',
      'Leaf movement only while that storehouse paragraph is on screen. Owner art is still pending.',
    ),
    layerWindow(
      'dust',
      'sa gitna ng alikabok',
      'sa gitna ng alikabok',
      'BOUND_PENDING_OWNER',
      'Dust only in the collapse paragraph that names it. Owner art is still pending.',
    ),
    layerWindow(
      'magical_glow',
      'may lumilitaw na maputlang liwanag',
      'Nawala ang liwanag.',
      'BOUND_PENDING_OWNER',
      'Root light from the moment it appears until the prose says the light is gone. Owner art is still pending.',
    ),
    layerWindow(
      'water_ripples',
      'Ngunit pagdaan nila sa tabi ng isang nakatumbang sisidlang puno ng tubig',
      'WAKAS NG KABANATA 1',
      'CLOSING_REVEAL_ONLY',
      'Water ripples only after the reader reaches the closing reveal. No earlier preview.',
    ),
  ];
}

export const KL_CHAPTER_ONE_LIVING_SCOPE: LivingScopeRow[] = buildChapterOneLivingScope();

function layersOverlapping(range: ParagraphRange | null): LivingLayerKind[] {
  if (!range) return [];
  return KL_CHAPTER_ONE_LIVING_SCOPE.filter((layer) => {
    if (layer.activation === 'FORBIDDEN_NOT_IN_CHAPTER_TEXT' || layer.paragraphRange == null) return false;
    return layer.paragraphRange.end >= range.start && layer.paragraphRange.start <= range.end;
  }).map((layer) => layer.layer);
}

export function buildStoryboard(): StoryboardRow[] {
  const panimula = emptyStoryboard(
    0,
    's1-panimula-unbound',
    'NO_SCENE_ANCHORS',
    'CANONICAL TEXT IMPORTED / NO SCENE ANCHORS / NO ARTWORK',
    null,
    false,
  );

  const chapterParagraphs = paragraphsForEpisode(1);
  const resolved = CHAPTER_ONE_SCENES.map((scene) => {
    const anchor = resolveAnchorRange(chapterParagraphs, scene.startAnchor, scene.endAnchor);
    return { scene, anchor };
  });
  const ranges = resolved.flatMap((row) => (row.anchor.ok ? [row.anchor.range] : []));
  const ordered = ranges.length === CHAPTER_ONE_SCENES.length && sceneRangesAreOrdered(ranges);
  const chapterOne: StoryboardRow[] = resolved.map(({ scene, anchor }) => {
    if (!anchor.ok || !ordered) {
      return emptyStoryboard(
        1,
        scene.sceneId,
        'BLOCKED_ANCHOR_MISMATCH',
        'BLOCKED / ANCHOR MISMATCH / NO ARTWORK',
        scene.editorialIntent,
        scene.spoiler,
      );
    }
    return {
      episodeId: klEpisodeId(1),
      sceneId: scene.sceneId,
      episodeNumber: 1,
      paragraphRange: anchor.range,
      paragraphRangeStatus: 'BOUND',
      editorialIntent: scene.editorialIntent,
      status: 'BOUND / ART PENDING OWNER APPROVAL / NO ARTWORK',
      artworkStatus: 'NO_ARTWORK',
      approvalStatus: 'pending',
      approved: false,
      required: true,
      spoiler: scene.spoiler,
      livingLayers: layersOverlapping(anchor.range),
    };
  });

  const outlines: StoryboardRow[] = [];
  for (let number = 2; number <= 30; number += 1) {
    outlines.push(emptyStoryboard(
      number,
      `s1-e${String(number).padStart(2, '0')}-outline`,
      'OUTLINE_ONLY',
      'OUTLINE ONLY / MANUSCRIPT NOT APPROVED / NO ARTWORK',
      null,
      false,
    ));
  }
  return [panimula, ...chapterOne, ...outlines];
}

function canonicalEpisode(episodeNumber: number, kind: CatalogEpisode['kind'], title: string): CatalogEpisode {
  const prose = canonicalProse(episodeNumber);
  const memberLive = episodeNumber <= KL_RELEASED_THROUGH_EPISODE;
  return {
    id: klEpisodeId(episodeNumber),
    seasonId: KL_SEASON_ONE_ID,
    kind,
    episodeNumber,
    title,
    titleMode: 'canon_title',
    status: memberLive ? 'live' : 'draft',
    manuscriptStatus: prose ? 'approved_complete' : 'content_blocked',
    prose: prose?.text ?? null,
    proseSha256: prose?.sha256 ?? null,
    sourcePath: prose?.path ?? null,
    proseComplete: prose != null && prose.text.trim().length > 0,
    mediaGate: memberLive ? 'provisional' : 'missing',
    approvedAt: memberLive ? '2026-10-20T22:00:00.000Z' : null,
    approvedBy: memberLive ? 'owner' : null,
    releaseAt: memberLive ? '2026-10-21T22:00:00.000Z' : KL_LOCKED_RELEASE_AT,
    paused: false,
    seasonPaused: false,
    seasonEmergencyStop: false,
  };
}

export function buildCatalogEpisodes(): CatalogEpisode[] {
  const panimula = canonicalEpisode(0, 'panimula', KL_PANIMULA_TITLE);
  const chapterOne = canonicalEpisode(1, 'episode', KL_CHAPTER_ONE_TITLE);

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
      prose: null,
      proseSha256: null,
      sourcePath: null,
      proseComplete: false,
    });
  }

  return [panimula, chapterOne, ...outlines];
}

/** Original cloud-generated stills. Not publication-cleared: approved stays false. */
const PROVISIONAL_SCENE_ART: Record<string, string> = {
  's1-e01-shot-01': 'assets/kabihasnang-ligaw/kl-e01-shot-01.jpg',
  's1-e01-shot-02': 'assets/kabihasnang-ligaw/kl-e01-shot-02.jpg',
  's1-e01-shot-03': 'assets/kabihasnang-ligaw/kl-e01-shot-03.jpg',
  's1-e01-shot-04': 'assets/kabihasnang-ligaw/kl-e01-shot-04.jpg',
  's1-e01-shot-05': 'assets/kabihasnang-ligaw/kl-e01-shot-05.jpg',
};

export function buildAssetGate(): AssetRow[] {
  const storyboardAssets: AssetRow[] = buildStoryboard().map((row) => {
    const generated = row.sceneId ? PROVISIONAL_SCENE_ART[row.sceneId] : undefined;
    if (generated) {
      return {
        id: `asset-${row.sceneId}`,
        kind: 'illustration' as const,
        episodeId: row.episodeId,
        sceneId: row.sceneId,
        path: generated,
        classification: 'PROVISIONAL' as const,
        required: true,
        approved: false,
        reason: 'Original scene still generated in cloud. Not owner-approved. Publication stays blocked while required music and ambient audio are absent.',
      };
    }
    return {
      id: `asset-${row.sceneId}`,
      kind: 'illustration' as const,
      episodeId: row.episodeId,
      sceneId: row.sceneId,
      path: null,
      classification: 'MISSING' as const,
      required: true,
      approved: false,
      reason: 'No scene-accurate illustration binary is in the repository. Owner approval is pending.',
    };
  });

  const repoAssets: AssetRow[] = [
    {
      id: 'asset-music',
      kind: 'music',
      episodeId: null,
      sceneId: null,
      path: null,
      classification: 'MISSING',
      required: true,
      approved: false,
      reason: 'No rights-cleared music file. The owner has not waived the media gate.',
    },
    {
      id: 'asset-ambient',
      kind: 'ambient',
      episodeId: null,
      sceneId: null,
      path: null,
      classification: 'MISSING',
      required: true,
      approved: false,
      reason: 'No rights-cleared ambient file. The owner has not waived the media gate.',
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
      reason: 'Reader shell. Canonical prose is loaded from content/kabihasnang-ligaw, not from this screen.',
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
    manuscript: 'CANONICAL_IMPORTED_UNPUBLISHED',
    assetGate: 'BLOCKED_NO_ORIGINAL_SCENE_ART',
    audioGate: 'BLOCKED_NO_RIGHTS_CLEARED_FILE',
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
