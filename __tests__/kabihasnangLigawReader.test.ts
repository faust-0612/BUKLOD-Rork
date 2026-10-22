import { buildAssetGate, buildCatalogEpisodes, buildStoryboard } from '@/lib/kabihasnang-ligaw/catalog';
import { memberReadable } from '@/lib/kabihasnang-ligaw/gates';
import { selectMemberReading } from '@/lib/kabihasnang-ligaw/readerSession';

const episodes = buildCatalogEpisodes();
const assets = buildAssetGate();
const storyboard = buildStoryboard();

function readable(episodeNumber: number) {
  const episode = episodes.find((item) => item.episodeNumber === episodeNumber);
  if (!episode) throw new Error(`missing episode ${episodeNumber}`);
  return memberReadable(
    episode,
    assets.filter((asset) => asset.episodeId === episode.id),
    new Date(),
    storyboard,
  ).readable;
}

describe('Kabihasnang Ligaw reader availability', () => {
  it('keeps Panimula and Kabanata 01 readable without waiting for the server', () => {
    expect(readable(0)).toBe(true);
    expect(readable(1)).toBe(true);
    const chapter = episodes.find((item) => item.episodeNumber === 1);
    const shown = selectMemberReading({
      locallyReadable: true,
      serverState: 'unread',
      serverText: null,
      bundledText: chapter?.prose ?? null,
      cachedText: null,
    });
    expect(shown.source).toBe('bundle');
    expect(shown.text).toContain('Lunawen');
  });

  it('does not hide a released chapter when the server has not published it yet', () => {
    const shown = selectMemberReading({
      locallyReadable: true,
      serverState: 'hidden',
      serverText: null,
      bundledText: 'Unang naramdaman ni Phan',
      cachedText: null,
    });
    expect(shown.text).toBe('Unang naramdaman ni Phan');
  });

  it('keeps later chapters locked until the server returns the text', () => {
    expect(readable(2)).toBe(false);
    expect(readable(30)).toBe(false);
    expect(selectMemberReading({
      locallyReadable: false,
      serverState: 'hidden',
      serverText: null,
      bundledText: null,
      cachedText: null,
    }).text).toBeNull();
    expect(selectMemberReading({
      locallyReadable: false,
      serverState: 'readable',
      serverText: 'Bagong kabanata',
      bundledText: null,
      cachedText: null,
    }).text).toBe('Bagong kabanata');
  });
});
