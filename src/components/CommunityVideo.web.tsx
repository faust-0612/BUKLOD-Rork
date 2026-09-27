import React from 'react';

type Props = {
  uri: string;
  height?: number;
  autoPlay?: boolean;
  expectedDurationSeconds?: number;
};

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/*
 * BUKLOD_COMMUNITY_HTML5_VIDEO_R3
 *
 * Browser-native video playback for Community Wall.
 * preload=metadata gives duration/seek data early, and native HTML5 controls
 * work directly with signed Supabase/S3 URLs.
 */
export function CommunityVideo({
  uri,
  height = 380,
  autoPlay = false,
  expectedDurationSeconds,
}: Props) {
  const duration =
    Number(expectedDurationSeconds ?? 0) > 0
      ? formatDuration(Number(expectedDurationSeconds))
      : null;

  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height,
        marginTop: 12,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#111',
        position: 'relative',
      },
    },
    React.createElement('video', {
      key: uri,
      src: uri,
      controls: true,
      preload: 'metadata',
      playsInline: true,
      autoPlay,
      style: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        background: '#111',
      },
    }),
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
