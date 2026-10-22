import React from 'react';

type Props = {
  url?: string | null;
  visible?: boolean;
  opacity?: number;
};

/**
 * Web-safe fallback.
 *
 * Native bundlers resolve BuklodRiveSceneOverlay.native.tsx and get the real
 * @rive-app/react-native runtime. Web intentionally resolves this no-op until
 * a dedicated BUKLOD web Rive runtime is approved, preventing a native-only
 * dependency from becoming a production-web regression.
 */
export default function BuklodRiveSceneOverlay(props: Props) {
  void props;
  return null;
}
