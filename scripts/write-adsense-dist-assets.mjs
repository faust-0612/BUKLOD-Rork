import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] || 'dist';
const client = String(process.env.EXPO_PUBLIC_ADSENSE_CLIENT_ID ?? '').trim();
const liveIds =
  String(process.env.EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS ?? '').trim().toLowerCase() === 'true';
const approved =
  String(process.env.EXPO_PUBLIC_ADSENSE_SITE_APPROVED ?? '').trim().toLowerCase() === 'true';

function publisherId(value) {
  const match = /^ca-pub-(\d{16})$/.exec(value);
  return match ? `pub-${match[1]}` : null;
}

fs.mkdirSync(outDir, { recursive: true });
const publisher = publisherId(client);
const target = path.join(outDir, 'ads.txt');

if (publisher && liveIds && approved) {
  fs.writeFileSync(
    target,
    `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`,
    'utf8',
  );
  console.log(`AdSense ads.txt READY for ${publisher}.`);
} else {
  fs.writeFileSync(
    target,
    '# BUKLOD AdSense activation pending site approval / production publisher configuration.\n',
    'utf8',
  );
  console.log('AdSense ads.txt readiness placeholder written; live activation remains OFF.');
}
