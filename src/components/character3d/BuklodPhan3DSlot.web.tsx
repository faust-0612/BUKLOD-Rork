import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import BuklodCharacterLayeredArt
  from '@/components/points/BuklodCharacterLayeredArt';
import {
  createPhan3DManifest,
  type Phan3DAnimation,
  type Phan3DQuality,
} from '@/components/character3d/phan3dConfig';
import type {
  BodyId,
  Equipment,
} from '@/lib/character-lab-core/types';

export type BuklodPhan3DSlotProps = {
  level: number;
  body: BodyId;
  equipment: Equipment;
  height?: number;
  width?: number;
  animation?: Phan3DAnimation;
  quality?: Phan3DQuality;
  active?: boolean;
  style?: ViewStyle;
};

const MODEL_VIEWER_SCRIPT_ID = 'buklod-model-viewer-loader';
const MODEL_VIEWER_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js';

function ensureModelViewer(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  if (window.customElements?.get('model-viewer')) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const existing = document.getElementById(
      MODEL_VIEWER_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener(
        'load',
        () => resolve(Boolean(window.customElements?.get('model-viewer'))),
        { once: true },
      );
      existing.addEventListener('error', () => resolve(false), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = MODEL_VIEWER_SCRIPT_ID;
    script.type = 'module';
    script.src = MODEL_VIEWER_SCRIPT;
    script.crossOrigin = 'anonymous';
    script.addEventListener(
      'load',
      () => resolve(Boolean(window.customElements?.get('model-viewer'))),
      { once: true },
    );
    script.addEventListener('error', () => resolve(false), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

async function modelExists(url: string) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default function BuklodPhan3DSlot({
  level,
  body,
  equipment,
  height = 124,
  width = 82,
  animation = 'Idle',
  quality = 'medium',
  active = true,
  style,
}: BuklodPhan3DSlotProps) {
  const manifest = useMemo(
    () => createPhan3DManifest(level),
    [level],
  );
  const modelRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setAvailable(false);
    setRendererReady(false);

    void modelExists(manifest.modelUrl).then((exists) => {
      if (cancelled) return;
      setAvailable(exists);
      if (!exists) return;

      void ensureModelViewer().then((loaded) => {
        if (!cancelled) {
          setRendererReady(loaded);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [manifest.modelUrl]);

  useEffect(() => {
    const node = modelRef.current;
    if (!node || !rendererReady || !available) return;

    const handleLoad = () => setReady(true);
    const handleError = () => setReady(false);
    node.addEventListener('load', handleLoad);
    node.addEventListener('error', handleError);

    return () => {
      node.removeEventListener('load', handleLoad);
      node.removeEventListener('error', handleError);
    };
  }, [available, rendererReady, manifest.modelUrl]);

  useEffect(() => {
    const node = modelRef.current as
      | (HTMLElement & {
          pause?: () => void;
          play?: () => void;
        })
      | null;

    if (!node || !ready) return;

    const syncPlayback = () => {
      const visible =
        typeof document === 'undefined' ||
        document.visibilityState === 'visible';
      if (active && visible) {
        node.play?.();
      } else {
        node.pause?.();
      }
    };

    syncPlayback();
    document.addEventListener('visibilitychange', syncPlayback);
    return () =>
      document.removeEventListener('visibilitychange', syncPlayback);
  }, [active, ready]);

  const fallback = (
    <BuklodCharacterLayeredArt
      body={body}
      equipment={equipment}
      height={height}
      viewportWidth={width}
      showStage={false}
      showEffects={false}
    />
  );

  const modelViewer =
    available && rendererReady
      ? React.createElement('model-viewer' as any, {
          ref: (node: HTMLElement | null) => {
            modelRef.current = node;
          },
          src: manifest.modelUrl,
          alt: `Phan level ${manifest.level}`,
          loading: 'lazy',
          reveal: 'auto',
          autoplay: active,
          'animation-name': animation,
          'camera-controls': true,
          'disable-zoom': true,
          'interaction-prompt': 'none',
          'shadow-intensity': quality === 'low' ? '0' : '0.65',
          exposure: quality === 'high' ? '1.05' : '1',
          style: {
            width: '100%',
            height: '100%',
            background: 'transparent',
            display: 'block',
          },
          'data-buklod-appearance': manifest.appearanceKey,
        })
      : null;

  return (
    <View
      style={[
        styles.viewport,
        { width, height },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.fallback,
          ready && styles.hidden,
        ]}
      >
        {fallback}
      </View>

      {modelViewer}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  hidden: {
    opacity: 0,
  },
});
