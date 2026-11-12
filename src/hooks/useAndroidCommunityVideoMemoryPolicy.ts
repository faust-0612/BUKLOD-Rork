import { useEffect, useMemo, useState } from 'react';
import { getMaxMemoryAsync } from 'expo-device';
import { Platform } from 'react-native';

import { androidCommunityVideoMemoryPolicy } from '@/lib/communityVideoPlayback';

let androidJavaHeapBytesPromise: Promise<number | null> | null = null;

function readAndroidJavaHeapBytes(): Promise<number | null> {
  if (!androidJavaHeapBytesPromise) {
    // Share a single native query across Wall, Marites and sponsored cards.
    androidJavaHeapBytesPromise = Promise.resolve()
      .then(() => getMaxMemoryAsync())
      .then(bytes => Number.isFinite(bytes) && bytes > 0 ? bytes : null)
      .catch(() => null);
  }
  return androidJavaHeapBytesPromise;
}

/**
 * Fail closed on Android until the Java-heap budget is known.
 * Does not require a new native package or an SDK upgrade.
 */
export function useAndroidCommunityVideoMemoryPolicy() {
  const [maxHeapBytes, setMaxHeapBytes] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let mounted = true;
    void readAndroidJavaHeapBytes().then(bytes => {
      if (mounted) setMaxHeapBytes(bytes);
    });
    return () => { mounted = false; };
  }, []);

  return useMemo(
    () => androidCommunityVideoMemoryPolicy(maxHeapBytes),
    [maxHeapBytes],
  );
}
