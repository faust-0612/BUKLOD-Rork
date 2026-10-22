import React, { createElement, useEffect, type ReactNode } from 'react';

const SCRIPT_ID = 'buklod-adsense-auto-ads';
const META_ID = 'buklod-adsense-account';

function clean(value: string | undefined) {
  return String(value ?? '').trim();
}

const client = clean(process.env.EXPO_PUBLIC_ADSENSE_CLIENT_ID);
const liveIds =
  clean(process.env.EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS).toLowerCase() === 'true';
const siteApproved =
  clean(process.env.EXPO_PUBLIC_ADSENSE_SITE_APPROVED).toLowerCase() === 'true';

function validClient(value: string) {
  return /^ca-pub-\d{16}$/.test(value);
}

export function buklodAdSenseTechnicalState() {
  return {
    platform: 'WEB' as const,
    provider: 'ADSENSE' as const,
    clientConfigured: validClient(client),
    siteApproved,
    liveIds,
    canLoadLiveScript: validClient(client) && siteApproved && liveIds,
  };
}

export default function BuklodWebAdSenseProvider({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    if (typeof document === 'undefined' || !validClient(client)) return;

    let meta = document.getElementById(META_ID) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.id = META_ID;
      meta.name = 'google-adsense-account';
      document.head.appendChild(meta);
    }
    meta.content = client;

    if (!siteApproved || !liveIds || document.getElementById(SCRIPT_ID)) {
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src =
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
      encodeURIComponent(client);
    document.head.appendChild(script);
  }, []);

  return createElement(
    'div',
    {
      'google-side-rail-overlap': 'false',
      'data-buklod-adsense': 'web-only',
      style: {
        display: 'flex',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: '100%',
      },
    } as any,
    children,
  );
}
