/** Bundled chapter-1 stills. They travel with the app, so weak data does not hide them. */
export const KL_SCENE_STILLS: Record<string, number> = {
  's1-e01-shot-01': require('../../../assets/kabihasnang-ligaw/kl-e01-shot-01.jpg'),
  's1-e01-shot-02': require('../../../assets/kabihasnang-ligaw/kl-e01-shot-02.jpg'),
  's1-e01-shot-03': require('../../../assets/kabihasnang-ligaw/kl-e01-shot-03.jpg'),
  's1-e01-shot-04': require('../../../assets/kabihasnang-ligaw/kl-e01-shot-04.jpg'),
  's1-e01-shot-05': require('../../../assets/kabihasnang-ligaw/kl-e01-shot-05.jpg'),
};

const SERIES_POSTER = require('../../../assets/kabihasnang-ligaw/kl-s1-ang-lupang-hindi-namamatay.jpg');
const CHAPTER_STRIP = require('../../../assets/kabihasnang-ligaw/kl-r5-approved-cover.webp');

/** Light image choices for admin release preview. Labels stay reader-facing. */
export const KL_ADMIN_IMAGE_CHOICES: ReadonlyArray<{
  key: string;
  label: string;
  source: number;
}> = [
  { key: 'series-poster', label: 'Series poster', source: SERIES_POSTER },
  { key: 'chapter-strip', label: 'Chapter cover', source: CHAPTER_STRIP },
  { key: 's1-e01-shot-01', label: 'Storehouse night', source: KL_SCENE_STILLS['s1-e01-shot-01'] },
  { key: 's1-e01-shot-02', label: 'Root and homestead', source: KL_SCENE_STILLS['s1-e01-shot-02'] },
  { key: 's1-e01-shot-03', label: 'Fissure rescue', source: KL_SCENE_STILLS['s1-e01-shot-03'] },
  { key: 's1-e01-shot-04', label: 'Rope and collapse', source: KL_SCENE_STILLS['s1-e01-shot-04'] },
  { key: 's1-e01-shot-05', label: 'Closing reveal', source: KL_SCENE_STILLS['s1-e01-shot-05'] },
];

export function adminImageSource(key: string | null | undefined): number | null {
  if (!key) return null;
  return KL_ADMIN_IMAGE_CHOICES.find((choice) => choice.key === key)?.source ?? null;
}
