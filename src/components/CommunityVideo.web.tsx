import React, { useEffect, useRef, useState } from 'react';

type Props = {
  uri: string;
  height?: number;
  autoPlay?: boolean;
  expectedDurationSeconds?: number;
  fullscreen?: boolean;
  edgeToEdge?: boolean;
  fitFrame?: boolean;
  active?: boolean;
  onOpenFullscreen?: () => void;
  onPlaybackError?: () => void;
  posterUri?: string | null;
  onPosterGenerated?: (thumbnail: unknown) => void | Promise<unknown>;
};

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/*
 * BUKLOD_COMMUNITY_HTML5_VIDEO_R3
 * BUKLOD_COMMUNITY_VIDEO_FULLSCREEN_R4
 * BUKLOD_COMMUNITY_VIDEO_RETRY_R6
 *
 * Browser-native video playback for Community Wall.
 * preload=metadata gives duration/seek data early, and native HTML5 controls
 * work directly with signed Supabase/S3 URLs.
 */
export function enableCommunityVideoSound() {}

export function CommunityVideo({
  uri,
  height = 380,
  autoPlay = false,
  expectedDurationSeconds,
  fullscreen = false,
  edgeToEdge = false,
  fitFrame = false,
  active = true,
  onOpenFullscreen,
  onPlaybackError,
  posterUri,
  onPosterGenerated,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    setReady(false);
  }, [uri, active]);
  const posterGeneratedRef = useRef(false);
  useEffect(() => {
    posterGeneratedRef.current = false;
  }, [uri]);
  const duration =
    Number(expectedDurationSeconds ?? 0) > 0
      ? formatDuration(Number(expectedDurationSeconds))
      : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!active) {
      video.pause();
      return;
    }

    if (autoPlay) {
      void video.play().catch(() => undefined);
    }
  }, [active, autoPlay, uri]);

  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height,
        marginTop: fullscreen ? 0 : 12,
        borderRadius: fullscreen || edgeToEdge ? 0 : 14,
        overflow: 'hidden',
        background: '#111',
        position: 'relative',
      },
    },
    React.createElement('video', {
      ref: videoRef,
      key: uri,
      // Do not download metadata for every offscreen Feed row.
      src: active ? uri : undefined,
      poster: posterUri || undefined,
      crossOrigin: 'anonymous',
      controls: true,
      preload: active ? 'metadata' : 'none',
      playsInline: true,
      autoPlay: autoPlay && active,
      onLoadedData: () => {
        setReady(true);
        const video = videoRef.current;
        if (posterUri || posterGeneratedRef.current || !onPosterGenerated || !video ||
            !(video.videoWidth > 0 && video.videoHeight > 0)) return;
        posterGeneratedRef.current = true;
        try {
          const doc = (globalThis as any).document;
          const URLApi = (globalThis as any).URL;
          const canvas = doc?.createElement?.('canvas');
          if (!canvas || !URLApi?.createObjectURL) return;
          const longest = Math.max(video.videoWidth, video.videoHeight);
          const scale = Math.min(1, 480 / longest);
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) return;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob: Blob | null) => {
            if (!blob || blob.size < 1 || blob.size > 125_000) return;
            const objectUrl = URLApi.createObjectURL(blob);
            void Promise.resolve(onPosterGenerated(objectUrl))
              .catch(() => undefined)
              .finally(() => URLApi.revokeObjectURL(objectUrl));
          }, 'image/jpeg', 0.56);
        } catch {
          // Cross-origin/tainted canvas or browser codec failures are optional.
        }
      },
      onPlaying: () => setReady(true),
      onWaiting: () => setReady(false),
      muted: fullscreen ? false : !soundOn,
      loop: !fullscreen,
      onError: () => {
        onPlaybackError?.();
      },
      style: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: fullscreen || fitFrame ? 'contain' : 'cover',
        background: '#111',
      },
    }),
    active && !ready
      ? React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              left: 0,
              right: 0,
              top: '44%',
              color: '#CDE7DD',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              pointerEvents: 'none',
            },
          },
          'Ihahanda ang video…',
        )
      : null,
    onOpenFullscreen && !fullscreen
      ? React.createElement(
          'button',
          {
            type: 'button',
            'aria-label': 'Open video full screen',
            onClick: (event: any) => {
              event.stopPropagation();
              videoRef.current?.pause();
              onOpenFullscreen();
            },
            style: {
              position: 'absolute',
              right: 10,
              bottom: 10,
              width: 42,
              height: 42,
              border: 0,
              borderRadius: 21,
              background: 'rgba(0,0,0,.62)',
              color: '#fff',
              fontSize: 24,
              lineHeight: '42px',
              textAlign: 'center',
              cursor: 'pointer',
              zIndex: 3,
            },
          },
          '⛶',
        )
      : null,
    !fullscreen
      ? React.createElement(
          'button',
          {
            type: 'button',
            'aria-label': soundOn ? 'Turn sound off' : 'Turn sound on',
            'aria-pressed': soundOn,
            onClick: (event: any) => {
              event.stopPropagation();
              setSoundOn(value => !value);
            },
            style: {
              position: 'absolute',
              right: 10,
              bottom: 10,
              width: 42,
              height: 42,
              border: 0,
              borderRadius: 21,
              background: 'rgba(0,0,0,.68)',
              color: '#fff',
              fontSize: 19,
              cursor: 'pointer',
              zIndex: 4,
            },
          },
          soundOn ? '🔊' : '🔇',
        )
      : null,
    duration
      ? React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              right: 10,
              top: 10,
              borderRadius: 8,
              background: 'rgba(0,0,0,.68)',
              color: '#fff',
              padding: '4px 7px',
              fontSize: 11,
              fontWeight: 800,
              pointerEvents: 'none',
            },
          },
          duration,
        )
      : null,
  );
}

export default CommunityVideo;
