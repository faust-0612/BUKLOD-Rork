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

export default function Root({
  children,
}: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>BUKLOD Classroom</title>
        <meta name="application-name" content="BUKLOD Classroom" />
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
