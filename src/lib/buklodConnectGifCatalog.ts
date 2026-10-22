import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import {
  type ConnectPickedFile,
} from '@/lib/buklodConnect';

export const CONNECT_GIF_CATEGORIES = [
  'All',
  'Happy',
  'Love',
  'Laugh',
  'Sad',
  'Angry',
  'Celebrate',
  'Prayer',
  'Encourage',
] as const;

export type ConnectGifCategory =
  (typeof CONNECT_GIF_CATEGORIES)[number];

export type ConnectGifProvider =
  | 'giphy'
  | 'fallback';

export type ConnectGifCatalogItem = {
  id: string;
  label: string;
  url: string;
  previewUri?: string;
  category?: ConnectGifCategory;
  provider?: ConnectGifProvider;
  sourceId?: string;
};

export type ConnectGifSearchResult = {
  items: ConnectGifCatalogItem[];
  provider: ConnectGifProvider;
  nextOffset: number;
  hasMore: boolean;
  warning?: string | null;
};

const CATEGORY_SEARCH: Record<
  ConnectGifCategory,
  string
> = {
  All: '',
  Happy: 'happy reaction',
  Love: 'love heart hug reaction',
  Laugh: 'laughing funny reaction',
  Sad: 'sad crying reaction',
  Angry: 'angry mad reaction',
  Celebrate: 'celebration congratulations party reaction',
  Prayer: 'prayer amen blessed faith',
  Encourage: 'encouragement keep going you can do it',
};

/**
 * Offline-safe starter set. These give every BUKLOD reaction category real
 * content even when the live provider is unavailable. Live GIPHY results are
 * merged into this same registry at runtime so the existing send path can send
 * any result without changing the Connect message schema.
 */
export const CONNECT_GIF_CATALOG: ConnectGifCatalogItem[] = [
  {
    id: 'pray',
    label: 'Pray',
    category: 'Prayer',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/7ws0TO8Tx5LYTOqjkv/giphy.gif',
  },
  {
    id: 'amen',
    label: 'Amen',
    category: 'Prayer',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/3ohs4fclWK2VHJxd8Q/giphy.gif',
  },
  {
    id: 'church-amen',
    label: 'Church Amen',
    category: 'Prayer',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/xUOwG2e035ksoCIQlq/giphy.gif',
  },
  {
    id: 'yes-and-amen',
    label: 'Yes & Amen',
    category: 'Prayer',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/POtnMrbGIdxXYLcbgu/giphy.gif',
  },
  {
    id: 'celebrate',
    label: 'Celebrate',
    category: 'Celebrate',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
  },
  {
    id: 'celebrate-cheers',
    label: 'Cheers',
    category: 'Celebrate',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/tkBWaxF2LhcwJ9omwx/giphy.gif',
  },
  {
    id: 'celebrate-winner',
    label: 'Winner',
    category: 'Celebrate',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/26u4exk4zsAqPcq08/giphy.gif',
  },
  {
    id: 'great-job',
    label: 'Great Job',
    category: 'Celebrate',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/26gss0Ef1YwPS1JdK/giphy.gif',
  },
  {
    id: 'love',
    label: 'Love',
    category: 'Love',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/7W1rgKAxlDe3m/giphy.gif',
  },
  {
    id: 'hug',
    label: 'Hug',
    category: 'Love',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/M8o1MOwcwsWOmueqN4/giphy.gif',
  },
  {
    id: 'support-hug',
    label: 'Support Hug',
    category: 'Love',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/qgkRhggrlm5SqZGuMy/giphy.gif',
  },
  {
    id: 'hugs-for-you',
    label: 'Hugs For You',
    category: 'Love',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/gHKnFHkGPUmG4GTzUt/giphy.gif',
  },
  {
    id: 'love-you-hug',
    label: 'Love You Hug',
    category: 'Love',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/Y1vXQrJoTtYRxkbQrl/giphy.gif',
  },
  {
    id: 'thanks',
    label: 'Thanks',
    category: 'Encourage',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
  },
  {
    id: 'keep-going',
    label: 'Keep Going',
    category: 'Encourage',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/clcHPGpHqS209KA3b0/giphy.gif',
  },
  {
    id: 'you-got-this',
    label: 'You Got This',
    category: 'Encourage',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/JBFHdCAR5cjkwLt6dd/giphy.gif',
  },
  {
    id: 'bless',
    label: 'Bless',
    category: 'Prayer',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/WFhn2CM4KzMDRk7R7K/giphy.gif',
  },
  {
    id: 'peace',
    label: 'Peace',
    category: 'Encourage',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/3o7b9HZ6nf9RlNu96E/giphy.gif',
  },
  {
    id: 'yes',
    label: 'Yes',
    category: 'Happy',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/fkD36jhiqzJ9m/giphy.gif',
  },
  {
    id: 'wow',
    label: 'Wow',
    category: 'Happy',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif',
  },
  {
    id: 'happy-clap',
    label: 'So Happy',
    category: 'Happy',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/l4HodBpDmoMA5p9bG/giphy.gif',
  },
  {
    id: 'laugh',
    label: 'Laugh',
    category: 'Laugh',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/anYBNhqT2BYcg/giphy.gif',
  },
  {
    id: 'try-not-laugh',
    label: 'Try Not To Laugh',
    category: 'Laugh',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/pk2SjAFWICrgcBuPCN/giphy.gif',
  },
  {
    id: 'sad-cry',
    label: 'Sad Cry',
    category: 'Sad',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/yL9R0Bv2acS7M5zAHG/giphy.gif',
  },
  {
    id: 'sad-tears',
    label: 'Tears',
    category: 'Sad',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/rWlLdCPTZNvWKHwclr/giphy.gif',
  },
  {
    id: 'sad-phone',
    label: 'Sad',
    category: 'Sad',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/dTTt9Oeomo02KlfZAA/giphy.gif',
  },
  {
    id: 'angry-reaction',
    label: 'Angry',
    category: 'Angry',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/l49K18UjXYJJ3ecCY/giphy.gif',
  },
  {
    id: 'angry-mad',
    label: 'Mad',
    category: 'Angry',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/NTHx4T5Mgc3ogmXSL8/giphy.gif',
  },
  {
    id: 'clap',
    label: 'Clap',
    category: 'Celebrate',
    provider: 'fallback',
    url: 'https://media.giphy.com/media/1rOVfYAmatiYgLsxmK/giphy.gif',
  },
];

for (const item of CONNECT_GIF_CATALOG) {
  if (!item.previewUri && /\/media\//i.test(item.url)) {
    item.previewUri = item.url.replace(
      /\/[^/]+$/,
      '/200.gif'
    );
  }
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 24;
const MAX_RUNTIME_GIFS = 360;
const GIPHY_UNAVAILABLE_BYTES = 239321;
const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
const SEND_MAX_BYTES = 8 * 1024 * 1024;

function giphyApiKey() {
  const generic =
    process.env.EXPO_PUBLIC_GIPHY_API_KEY?.trim() ?? '';

  if (Platform.OS === 'android') {
    return (
      process.env.EXPO_PUBLIC_GIPHY_ANDROID_API_KEY?.trim() ||
      generic
    );
  }

  if (Platform.OS === 'ios') {
    return (
      process.env.EXPO_PUBLIC_GIPHY_IOS_API_KEY?.trim() ||
      generic
    );
  }

  return (
    process.env.EXPO_PUBLIC_GIPHY_WEB_API_KEY?.trim() ||
    generic
  );
}

function normalizeCategory(
  value?: string | null
): ConnectGifCategory {
  const match =
    CONNECT_GIF_CATEGORIES.find(
      category =>
        category.toLowerCase() ===
        String(value ?? '').trim().toLowerCase()
    );

  return match ?? 'All';
}

function fallbackText(item: ConnectGifCatalogItem) {
  return [
    item.label,
    item.category,
    item.id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function fallbackSearch(
  query: string,
  category: ConnectGifCategory,
  offset: number,
  limit: number,
): ConnectGifSearchResult {
  const q = query.trim().toLowerCase();
  const filtered = CONNECT_GIF_CATALOG.filter(item => {
    if (item.provider === 'giphy') {
      return false;
    }

    if (
      category !== 'All' &&
      item.category !== category
    ) {
      return false;
    }

    return !q || fallbackText(item).includes(q);
  });

  const items = filtered.slice(
    offset,
    offset + limit
  );

  return {
    items,
    provider: 'fallback',
    nextOffset: offset + items.length,
    hasMore: offset + items.length < filtered.length,
  };
}

function giphySizedUrl(
  image: any,
  maxBytes: number
) {
  const url = image?.url;

  if (
    typeof url !== 'string' ||
    !/^https:\/\//i.test(url)
  ) {
    return undefined;
  }

  const size = Number(image?.size ?? 0);

  if (size > maxBytes) {
    return undefined;
  }

  return url;
}

function bestGiphyUri(
  images: any,
  kind: 'preview' | 'original'
) {
  const order =
    kind === 'preview'
      ? [
          'fixed_width',
          'downsized_medium',
          'fixed_height',
          'downsized',
          'fixed_width_small',
          'original',
        ]
      : [
          'downsized_medium',
          'fixed_width',
          'downsized',
          'downsized_large',
          'original',
        ];
  const maxBytes =
    kind === 'preview'
      ? PREVIEW_MAX_BYTES
      : SEND_MAX_BYTES;

  for (const key of order) {
    const url = giphySizedUrl(
      images?.[key],
      maxBytes
    );

    if (url) {
      return url;
    }
  }

  return giphySizedUrl(
    images?.original,
    MAX_FILE_BYTES
  );
}

function registerLiveItems(
  items: ConnectGifCatalogItem[]
) {
  for (const item of items) {
    const index =
      CONNECT_GIF_CATALOG.findIndex(
        existing => existing.id === item.id
      );

    if (index >= 0) {
      CONNECT_GIF_CATALOG[index] = item;
    }
    else {
      CONNECT_GIF_CATALOG.push(item);
    }
  }

  const liveIndexes = CONNECT_GIF_CATALOG
    .map((item, index) => ({ item, index }))
    .filter(row => row.item.provider === 'giphy');

  if (liveIndexes.length > MAX_RUNTIME_GIFS) {
    const removeCount =
      liveIndexes.length - MAX_RUNTIME_GIFS;
    const idsToRemove = new Set(
      liveIndexes
        .slice(0, removeCount)
        .map(row => row.item.id)
    );

    for (
      let index = CONNECT_GIF_CATALOG.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (idsToRemove.has(CONNECT_GIF_CATALOG[index].id)) {
        CONNECT_GIF_CATALOG.splice(index, 1);
      }
    }
  }
}

export async function searchConnectGifs({
  query = '',
  category = 'All',
  offset = 0,
  limit = DEFAULT_PAGE_SIZE,
}: {
  query?: string;
  category?: ConnectGifCategory | string;
  offset?: number;
  limit?: number;
} = {}): Promise<ConnectGifSearchResult> {
  const normalizedCategory =
    normalizeCategory(category);
  const safeOffset =
    Math.max(0, Number(offset) || 0);
  const safeLimit =
    Math.max(
      1,
      Math.min(36, Number(limit) || DEFAULT_PAGE_SIZE)
    );
  const key = giphyApiKey();

  if (!key) {
    return {
      ...fallbackSearch(
        query,
        normalizedCategory,
        safeOffset,
        safeLimit
      ),
      warning:
        'Live GIF search is not configured on this build.',
    };
  }

  const categorySearch =
    CATEGORY_SEARCH[normalizedCategory];
  const userQuery = query.trim();
  const searchTerm =
    userQuery && categorySearch
      ? `${categorySearch} ${userQuery}`
      : userQuery || categorySearch;

  const endpoint = searchTerm
    ? 'search'
    : 'trending';
  const params = new URLSearchParams({
    api_key: key,
    limit: String(safeLimit),
    offset: String(safeOffset),
    rating: 'g',
    lang: 'en',
  });

  if (searchTerm) {
    params.set('q', searchTerm);
  }

  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/${endpoint}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        `GIF provider returned ${response.status}.`
      );
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : [];
    const items = rows
      .map((row: any) => {
        const original = bestGiphyUri(
          row?.images,
          'original'
        );
        const preview = bestGiphyUri(
          row?.images,
          'preview'
        );

        if (!original || !row?.id) {
          return null;
        }

        const title =
          String(row?.title ?? '')
            .replace(/\s*GIF\s*$/i, '')
            .trim() ||
          `${normalizedCategory === 'All' ? 'Reaction' : normalizedCategory} GIF`;

        return {
          id: `giphy-${String(row.id)}`,
          sourceId: String(row.id),
          label: title,
          category:
            normalizedCategory === 'All'
              ? undefined
              : normalizedCategory,
          provider: 'giphy' as const,
          previewUri: preview || original,
          url: original,
        } satisfies ConnectGifCatalogItem;
      })
      .filter(
        (item: ConnectGifCatalogItem | null):
          item is ConnectGifCatalogItem =>
          !!item
      );

    registerLiveItems(items);

    const totalCount = Number(
      payload?.pagination?.total_count ?? 0
    );
    const returnedCount = Number(
      payload?.pagination?.count ?? items.length
    );
    const nextOffset =
      safeOffset + Math.max(returnedCount, items.length);

    return {
      items,
      provider: 'giphy',
      nextOffset,
      hasMore:
        returnedCount > 0 &&
        (
          totalCount <= 0 ||
          nextOffset < totalCount
        ),
      warning: null,
    };
  }
  catch {
    return {
      ...fallbackSearch(
        query,
        normalizedCategory,
        safeOffset,
        safeLimit
      ),
      warning:
        'Live GIFs could not load. Showing available reactions instead.',
    };
  }
}

export function getConnectGifCatalogItem(
  id: string
): ConnectGifCatalogItem | null {
  return (
    CONNECT_GIF_CATALOG.find(
      item => item.id === id
    ) ?? null
  );
}

export async function downloadConnectCatalogGif(
  item: ConnectGifCatalogItem
): Promise<ConnectPickedFile> {
  const cacheDir =
    FileSystem.cacheDirectory;

  if (!cacheDir) {
    throw new Error(
      'Could not prepare GIF download.'
    );
  }

  const safeId = String(item.id)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80);
  const target =
    `${cacheDir}connect-gif-${safeId}-${Date.now()}.gif`;
  const result = await FileSystem.downloadAsync(
    item.url,
    target
  );

  const nativeFile = new File(result.uri);
  const size = Number(nativeFile.size ?? 0);

  if (!size) {
    throw new Error(
      'Could not download that GIF. Check your connection and try again.'
    );
  }

  if (size === GIPHY_UNAVAILABLE_BYTES) {
    throw new Error(
      'That GIF is no longer available. Choose another one.'
    );
  }

  if (size > MAX_FILE_BYTES) {
    throw new Error(
      'Maximum attachment size is 25 MB.'
    );
  }

  return {
    uri: result.uri,
    name: `${safeId || 'reaction'}.gif`,
    mimeType: 'image/gif',
    size,
  };
}
