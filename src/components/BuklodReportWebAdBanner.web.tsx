import React, { useEffect, useRef } from 'react';

const adsenseClient = (process.env.EXPO_PUBLIC_REPORT_ADSENSE_CLIENT || '').trim();
const adsenseSlot = (process.env.EXPO_PUBLIC_REPORT_ADSENSE_SLOT || '').trim();
const adsenseEnabled = (process.env.EXPO_PUBLIC_REPORT_ADSENSE_ENABLED || '').trim().toLowerCase();

const configured =
  ['1', 'true', 'yes', 'on'].includes(adsenseEnabled) &&
  /^ca-pub-\d+$/i.test(adsenseClient) &&
  /^\d+$/.test(adsenseSlot);

const SCRIPT_ID = 'buklod-report-adsense-script';

function ensureAdsenseScript() {
  if (!configured || typeof document === 'undefined') return;
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`;
  document.head.appendChild(script);
}

/**
 * Web-only, configuration-driven banner for the standalone Report dashboard.
 *
 * No publisher/slot is hard-coded. If any required value is missing or invalid,
 * this component renders nothing. The native sibling is a no-op, so this adds
 * no AdMob/native dependency and cannot affect Android packaging.
 */
export default function BuklodReportWebAdBanner() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!configured || typeof window === 'undefined' || typeof document === 'undefined') return;

    ensureAdsenseScript();

    const host = hostRef.current;
    if (!host) return;

    host.replaceChildren();

    const ad = document.createElement('ins');
    ad.className = 'adsbygoogle';
    ad.style.display = 'block';
    ad.style.width = '100%';
    ad.setAttribute('data-ad-client', adsenseClient);
    ad.setAttribute('data-ad-slot', adsenseSlot);
    ad.setAttribute('data-ad-format', 'auto');
    ad.setAttribute('data-full-width-responsive', 'true');
    host.appendChild(ad);

    try {
      const root = window as typeof window & { adsbygoogle?: unknown[] };
      root.adsbygoogle = root.adsbygoogle || [];
      root.adsbygoogle.push({});
    } catch (error) {
      console.warn('[BUKLOD_REPORT_ADS] Banner request could not be initialized.', error);
    }

    return () => {
      host.replaceChildren();
    };
  }, []);

  if (!configured) return null;

  return React.createElement(
    'section',
    {
      'aria-label': 'Sponsored',
      style: {
        width: '100%',
        maxWidth: 1120,
        margin: '8px auto 0',
        padding: '10px 14px 12px',
        borderTop: '1px solid rgba(18, 55, 43, 0.10)',
        boxSizing: 'border-box',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          marginBottom: 6,
          color: '#6B746F',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        },
      },
      'Sponsored',
    ),
    React.createElement('div', {
      ref: hostRef,
      style: {
        width: '100%',
        minHeight: 90,
        overflow: 'hidden',
      },
    }),
  );
}
