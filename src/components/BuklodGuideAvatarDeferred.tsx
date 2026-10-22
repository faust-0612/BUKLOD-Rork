import React, { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

type GuideComponent = React.ComponentType;

/*
 * PERF_STARTUP_R1
 *
 * Guide avatar pulls Reanimated + six PNG assets. Mount it after the first
 * interactions so cold start is not competing with brand intro / first route.
 */
export default function BuklodGuideAvatarDeferred() {
  const [Guide, setGuide] = useState<GuideComponent | null>(null);

  useEffect(() => {
    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      void import('@/components/BuklodGuideAvatar')
        .then((mod) => {
          if (cancelled) return;
          setGuide(() => mod.BuklodGuideAvatar);
        })
        .catch((error) => {
          console.warn('BUKLOD guide avatar defer:', error);
        });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  if (!Guide) {
    return null;
  }

  return <Guide />;
}
