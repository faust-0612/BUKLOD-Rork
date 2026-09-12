const fs = require('node:fs');

const PUBLIC_FILE = 'src/app/(tabs)/buklod.tsx';
const SCOPED_FILE = 'src/components/BuklodExclusiveScopeCommunity.tsx';

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function replaceExactlyOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`[IGPAT R16] ${label}: expected exactly one match, found ${count}`);
  }
  return source.replace(from, to);
}

let publicSource = read(PUBLIC_FILE);

publicSource = replaceExactlyOnce(
  publicSource,
  "   wallVideo:\n    wallVideo186O,\n   communityGif,",
  "   wallVideo:\n    wallVideo186O as {\n     uri:string;\n     mimeType:string;\n     sizeBytes:number;\n     durationSeconds:number;\n    }|null,\n   communityGif:\n    communityGif as BuklodCommunityGifFile|null,",
  'Public guarded media snapshot typing'
);

let scopedSource = read(SCOPED_FILE);

scopedSource = replaceExactlyOnce(
  scopedSource,
  "      const publishingReel =\n        mode === 'reels';",
  "      const publishingReel = false;",
  'Scoped impossible Reel comparison'
);

scopedSource = replaceExactlyOnce(
  scopedSource,
  "        wallVideo,\n        reel,\n        communityGif,\n        cleanBody,\n        publishingReel,",
  "        wallVideo:\n          wallVideo as SelectedVideo | null,\n        reel:\n          reel as SelectedVideo | null,\n        communityGif:\n          communityGif as BuklodCommunityGifFile | null,\n        cleanBody,\n        publishingReel:\n          publishingReel as boolean,",
  'Scoped guarded media snapshot typing'
);

if (!publicSource.includes("Community accepts text and photos only. Post videos through BUKLOD IGPAT.")) {
  throw new Error('[IGPAT R16] Public Community text/photo-only guard disappeared');
}
if (!scopedSource.includes("Community accepts text and photos only. Post videos through BUKLOD IGPAT.")) {
  throw new Error('[IGPAT R16] Scoped Community text/photo-only guard disappeared');
}
if (!scopedSource.includes("router.push('/igpat/create' as any)")) {
  throw new Error('[IGPAT R16] Scoped IGPAT creator route disappeared');
}

fs.writeFileSync(PUBLIC_FILE, publicSource, 'utf8');
fs.writeFileSync(SCOPED_FILE, scopedSource, 'utf8');

console.log('IGPAT R16 minimal TypeScript hardening applied.');
console.log('Only guarded snapshot typing / impossible scoped Reel comparison changed.');
console.log('No historical media rendering/read compatibility removed.');
