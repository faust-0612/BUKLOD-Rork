import { getSharedPayloads } from 'expo-sharing';

/* BUKLOD_NATIVE_INCOMING_SHARE_R2 */
export async function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (getSharedPayloads().length > 0) {
      return '/handle-share';
    }
  } catch {
    // Preserve the original system route if native share inspection fails.
  }

  return path;
}
