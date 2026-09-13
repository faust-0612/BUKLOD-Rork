import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/*
 * BUKLOD_ADSENSE_SITE_VERIFICATION_R1
 *
 * Static Expo Router HTML shell for buklod.expo.app. AdSense requires the
 * publisher loader to be present inside <head> for site ownership verification.
 * The publisher id is public configuration, not a credential or secret.
 */

const ADSENSE_CLIENT =
  'ca-pub-6260135521836249';

/*
 * BUKLOD_WEB_LIVE_ATMOSPHERE_R1
 * BUKLOD_PERF_DELTA_MOBILE_WEB_R1
 *
 * Web-only presentation enhancement. Desktop keeps the subtle ambient motion.
 * Small/mobile web keeps the same visual atmosphere as a static layer so phone
 * browsers do not continuously composite two full-screen fixed animations.
 * Android/native runtimes, business logic, navigation, auth, points, Formation,
 * Classroom, reports, and database behavior remain untouched.
 */
const WEB_LIVE_ATMOSPHERE_CSS = `
  body::before,
  body::after {
    content: '';
    position: fixed;
    pointer-events: none;
    user-select: none;
  }

  body::before {
    inset: -16vh -12vw;
    z-index: 2147483000;
    opacity: 0.72;
    background:
      radial-gradient(circle at 12% 18%, rgba(57, 164, 102, 0.105), transparent 25%),
      radial-gradient(circle at 86% 78%, rgba(51, 152, 187, 0.082), transparent 27%),
      radial-gradient(circle at 62% 8%, rgba(120, 224, 170, 0.045), transparent 20%);
    transform: translate3d(-1.2%, 0.8%, 0) scale(1.01);
    animation: buklod-web-ambient-drift 18s ease-in-out infinite alternate;
  }

  body::after {
    top: -34vh;
    bottom: -34vh;
    left: -24vw;
    width: 15vw;
    z-index: 2147483001;
    opacity: 0.48;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0),
      rgba(255, 255, 255, 0.045),
      rgba(255, 255, 255, 0)
    );
    transform: rotate(-13deg) translate3d(-44vw, 0, 0);
    animation: buklod-web-soft-sweep 15s ease-in-out infinite;
  }

  @keyframes buklod-web-ambient-drift {
    0% {
      transform: translate3d(-1.2%, 0.8%, 0) scale(1.01);
    }
    50% {
      transform: translate3d(1.4%, -1.1%, 0) scale(1.035);
    }
    100% {
      transform: translate3d(-0.2%, 1.3%, 0) scale(1.02);
    }
  }

  @keyframes buklod-web-soft-sweep {
    0%, 20% {
      transform: rotate(-13deg) translate3d(-44vw, 0, 0);
      opacity: 0;
    }
    38% {
      opacity: 0.42;
    }
    72% {
      opacity: 0.18;
    }
    88%, 100% {
      transform: rotate(-13deg) translate3d(148vw, 0, 0);
      opacity: 0;
    }
  }

  /*
   * The app uses <1100px as the mobile/small-web shell boundary. Keep the
   * atmosphere visible there, but static. This removes continuous viewport-size
   * compositing from the phone browser while preserving the design language.
   */
  @media (max-width: 1099px) {
    body::before,
    body::after {
      animation: none !important;
    }

    body::before {
      opacity: 0.34;
      transform: none;
    }

    body::after {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    body::before,
    body::after {
      animation: none !important;
    }

    body::before {
      opacity: 0.28;
      transform: none;
    }

    body::after {
      display: none;
    }
  }
`;

export default function Root({
  children,
}: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          httpEquiv="X-UA-Compatible"
          content="IE=edge"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta
          name="google-adsense-account"
          content={ADSENSE_CLIENT}
        />
        <ScrollViewStyleReset />
        <style>{WEB_LIVE_ATMOSPHERE_CSS}</style>
        <script
          id="buklod-google-adsense-script"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
