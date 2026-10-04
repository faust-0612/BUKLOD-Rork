import React, { useEffect, useRef } from 'react';

type Props = {
  uri: string;
  height?: number;
  autoPlay?: boolean;
  expectedDurationSeconds?: number;
  fullscreen?: boolean;
  edgeToEdge?: boolean;
  active?: boolean;
  onOpenFullscreen?: () => void;
  onPlaybackError?: () => void;
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
  active = true,
  onOpenFullscreen,
  onPlaybackError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
      src: uri,
      controls: true,
      preload: 'metadata',
      playsInline: true,
      autoPlay,
      muted: !fullscreen,
      loop: !fullscreen,
      onError: () => {
        onPlaybackError?.();
      },
      style: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: fullscreen ? 'contain' : 'cover',
        background: '#111',
      },
    }),
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
