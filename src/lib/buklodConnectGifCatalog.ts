import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';

import {
  type ConnectPickedFile,
} from '@/lib/buklodConnect';

export type ConnectGifCatalogItem = {
  id: string;
  label: string;
  url: string;
};

/** Curated reaction GIFs — tap to send instantly in Connect. */
export const CONNECT_GIF_CATALOG: ConnectGifCatalogItem[] = [
  {
    id: 'pray',
    label: 'Pray',
    url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif',
  },
  {
    id: 'amen',
    label: 'Amen',
    url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7sYnC/giphy.gif',
  },
  {
    id: 'celebrate',
    label: 'Celebrate',
    url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
  },
  {
    id: 'love',
    label: 'Love',
    url: 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',
  },
  {
    id: 'hug',
    label: 'Hug',
    url: 'https://media.giphy.com/media/3o7abKh0pu8N47KJ32/giphy.gif',
  },
  {
    id: 'thanks',
    label: 'Thanks',
    url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
  },
  {
    id: 'yes',
    label: 'Yes',
    url: 'https://media.giphy.com/media/111eb45AYSZxcY/giphy.gif',
  },
  {
    id: 'wow',
    label: 'Wow',
    url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif',
  },
  {
    id: 'laugh',
    label: 'Laugh',
    url: 'https://media.giphy.com/media/13Co7iaSlZnhzG/giphy.gif',
  },
  {
    id: 'clap',
    label: 'Clap',
    url: 'https://media.giphy.com/media/7rj2ZgTvgovYDJMpUq/giphy.gif',
  },
  {
    id: 'bless',
    label: 'Bless',
    url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif',
  },
  {
    id: 'peace',
    label: 'Peace',
    url: 'https://media.giphy.com/media/xUPGcguWZHRC2BXBFO/giphy.gif',
  },
];

const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

  const target = `${cacheDir}connect-gif-${item.id}-${Date.now()}.gif`;
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

  if (size > MAX_FILE_BYTES) {
    throw new Error(
      'Maximum attachment size is 25 MB.'
    );
  }

  return {
    uri: result.uri,
    name: `${item.id}.gif`,
    mimeType: 'image/gif',
    size,
  };
}
