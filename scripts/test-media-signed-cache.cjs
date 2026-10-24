const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const assert = require('node:assert/strict');
let source = fs.readFileSync(__dirname + '/../src/lib/buklodMediaUrl.ts', 'utf8');
source = source.replace(/^import .*;\n/gm, '').replace(/export /g, '');
source = stripTypeScriptTypes(source);
let signs = 0;
const context = vm.createContext({setTimeout, clearTimeout, Date, Map, Promise,
 AsyncStorage: {getItem: async () => null, setItem: async () => {}},
 withBuklodTimeout: p => p, runCommunityMediaPrefetch: async () => {},
 supabase: {storage: {from: () => ({createSignedUrls: async paths => {signs++; return {data: paths.map(path => ({path, signedUrl: 'https://host/storage/v1/object/sign/community-media/' + path + '?token=fresh'}))};}})}}});
vm.runInContext(source, context);
(async () => {
 await context.hydrateCommunityMediaUrlCache();
 const stale = 'https://host/storage/v1/object/sign/community-media/video.mp4?token=expired';
 assert.equal(context.peekCommunityMediaUrl('video.mp4', stale), null);
 const urls = await Promise.all([context.resolveCommunityMediaUrl('video.mp4', stale),context.resolveCommunityMediaUrl('video.mp4', stale)]);
 assert.equal(signs, 1); assert.ok(urls.every(u => u.endsWith('token=fresh')));
 assert.equal(await context.resolveCommunityMediaUrl('video.mp4', stale), urls[0]);
 assert.equal(signs, 1);
 assert.equal(context.peekCommunityMediaUrl('aws:wall/a.mp4','https://aws/view?X-Amz-Signature=fresh'),'https://aws/view?X-Amz-Signature=fresh');
 assert.equal(context.peekCommunityMediaUrl(null,'file:///local.mp4'),'file:///local.mp4');
 assert.equal(context.peekCommunityMediaUrl(null,'https://cdn/public.mp4'),'https://cdn/public.mp4');
 assert.equal(context.peekCommunityMediaUrl(null,stale),null);
 console.log('PASS: stale URL rejection, fresh re-sign, concurrent deduplication, cache reuse, AWS/local/public preservation, pathless signed URL rejection');
})().catch(e => {console.error(e);process.exitCode=1;});
