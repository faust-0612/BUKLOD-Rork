'use dom';

import React, { useEffect, useRef } from 'react';

type LocationResult = {
  nonce: number;
  type: 'BUKLOD_MAP_LOCATION_RESULT';
  ok: boolean;
  latitude?: number;
  longitude?: number;
  locateOnly?: boolean;
  message?: string;
};

type Props = {
  srcDoc: string;
  interactive: boolean;
  title: string;
  locationResult?: LocationResult | null;
  onRequestLocation: (request: { locateOnly: boolean }) => void;
  onOpenUrl: (url: string) => void;
  dom?: import('expo/dom').DOMProps;
};

export default function BuklodCommunityMapDom({
  srcDoc,
  interactive,
  title,
  locationResult,
  onRequestLocation,
  onOpenUrl,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const requestRef = useRef(onRequestLocation);
  const openUrlRef = useRef(onOpenUrl);

  requestRef.current = onRequestLocation;
  openUrlRef.current = onOpenUrl;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event?.data as
        | {
            type?: string;
            locateOnly?: boolean;
            url?: string;
          }
        | null;

      if (!data || typeof data !== 'object') return;

      if (data.type === 'BUKLOD_MAP_REQUEST_LOCATION') {
        requestRef.current({
          locateOnly: Boolean(data.locateOnly),
        });
      }

      if (
        data.type === 'BUKLOD_MAP_OPEN_URL' &&
        typeof data.url === 'string'
      ) {
        openUrlRef.current(data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!locationResult) return;

    iframeRef.current?.contentWindow?.postMessage(
      {
        type: locationResult.type,
        ok: locationResult.ok,
        latitude: locationResult.latitude,
        longitude: locationResult.longitude,
        locateOnly: locationResult.locateOnly,
        message: locationResult.message,
      },
      '*',
    );
  }, [locationResult]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: '100%',
        height: '100%',
        margin: 0,
        overflow: 'hidden',
        background: '#eef2f4',
      }}
    >
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={srcDoc}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          border: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          background: '#eef2f4',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
