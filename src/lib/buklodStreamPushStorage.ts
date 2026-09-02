import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAM_API_KEY_KEY =
  '@buklod_stream_api_key';

const BUILD_STREAM_API_KEY =
  (
    process.env
      .EXPO_PUBLIC_STREAM_API_KEY
    ?? ''
  )
    .toString()
    .trim();

export async function rememberStreamApiKey(
  apiKey: string
) {
  const key =
    apiKey.trim();

  if (!key) {
    return;
  }

  await AsyncStorage.setItem(
    STREAM_API_KEY_KEY,
    key
  );
}

export async function readCachedStreamApiKey():
  Promise<string> {
  try {
    const cached =
      (
        await AsyncStorage.getItem(
          STREAM_API_KEY_KEY
        )
      )
        ?.trim() ?? '';

    return cached;
  }
  catch {
    return '';
  }
}

export function getBuildStreamApiKey() {
  return BUILD_STREAM_API_KEY;
}

export async function resolveStreamApiKey(
  fetchFromServer?: () => Promise<string>
): Promise<string> {
  if (BUILD_STREAM_API_KEY) {
    return BUILD_STREAM_API_KEY;
  }

  const cached =
    await readCachedStreamApiKey();

  if (cached) {
    return cached;
  }

  if (!fetchFromServer) {
    return '';
  }

  try {
    const remote =
      (
        await fetchFromServer()
      ).trim();

    if (remote) {
      await rememberStreamApiKey(
        remote
      );
    }

    return remote;
  }
  catch {
    return '';
  }
}
