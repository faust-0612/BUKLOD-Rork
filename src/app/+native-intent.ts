/* BUKLOD_SHARE_TARGET_187A */
export async function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/handle-share';
    }
  } catch {
    // Not an Expo Sharing URL; keep the original path.
  }

  return path;
}
