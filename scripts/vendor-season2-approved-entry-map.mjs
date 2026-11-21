#!/usr/bin/env node
/** Reconstruct the EXACT owner-approved Season 2 entry map image from four
 * source-owned text chunks. Never generate/repaint/recompress the approved art.
 * SHA-256 and RIFF length must match original Library file byte-for-byte.
 * Offline, reproducible, DEV-only. No new account, backend, subscription or URL.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const parts=[1,2,3,4].map(n=>readFileSync(resolve(root,
  'assets/season2/genesis/world/approved-entry-map-source/part-'+String(n).padStart(3,'0')+'.txt'),'utf8'));
const original=parts.join('').replace(/\s+/g,'');
if(!/^[A-Za-z0-9+/]+={0,2}$/.test(original)||original.length%4!==0)throw Error('Invalid approved map source encoding');
const bytes=Buffer.from(original,'base64');
const expected='a343c70d1c71e849b536570bd92ede7134667d40347f6465003d41710e818b02';
const sha=createHash('sha256').update(bytes).digest('hex');
if(bytes.byteLength!==473226||sha!==expected)throw Error('Original approved entry map checksum mismatch: refused');
if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'
 ||bytes.readUInt32LE(4)+8!==bytes.length||bytes.toString('ascii',12,16)!=='VP8 ')throw Error('Approved map WebP header invalid');
const filename='assets/season2/genesis/world/buklod-approved-entry-map-1672x941.webp';
const absolute=resolve(root,filename);
mkdirSync(resolve(root,'assets/season2/genesis/world'),{recursive:true});
if(existsSync(absolute)&&!readFileSync(absolute).equals(bytes))throw Error('Existing asset differs; no silent replacement');
writeFileSync(absolute,bytes);
const m={source:'BUKLOD_S2_APPROVED_ENTRY_MAP_WEBP_BASE64.txt',ownerApproved:true,
 width:1672,height:941,sizeBytes:bytes.byteLength,sha256:sha,
 sourceParts:parts.length,assetPath:filename,role:'genesis-single-entry-map',
 destinations:['Character Kingdom','Empire Arena','Community Village','Community Hall',
 'Connect Center','Marketplace','Bayanihan Center','My Home','Focus Apps Center',
 'Achievement Hall','Life Center','Knowledge Sanctuary']};
writeFileSync(resolve(root,'assets/season2/genesis/world/approved-entry-map-manifest.json'),JSON.stringify(m,null,2)+'\n');
console.log(JSON.stringify({ok:true,image:filename,sha256:sha,bytes:bytes.byteLength,originalPreserved:true}));
