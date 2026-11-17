import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const wall=readFileSync(new URL('../src/app/(tabs)/buklod.tsx',import.meta.url),'utf8');
const feedback=readFileSync(new URL('../src/lib/buklodUserFeedback.ts',import.meta.url),'utf8');
const banner=readFileSync(new URL('../src/components/OfflineBanner.tsx',import.meta.url),'utf8');
const start=wall.indexOf('const reportCommunityFailure=');
const reporter=wall.slice(start,wall.indexOf('const {\n  openReport',start));
const loaderStart=wall.indexOf('const loadComments=');
const loader=wall.slice(loaderStart,wall.indexOf('const openComments=',loaderStart));
const builder=feedback.indexOf('export function buildBuklodUserFeedback');
const timeout=feedback.slice(feedback.indexOf("if (category === 'TIMEOUT_ERROR')",builder),feedback.indexOf("if (category === 'NETWORK_ERROR')",builder));
const network=feedback.slice(feedback.indexOf("if (category === 'NETWORK_ERROR')",builder),feedback.indexOf("if (category === 'AUTH_ERROR'",builder));
test('offline/degraded uses only the compact banner on Wall request failure',()=>{
 assert.match(banner,/status === 'offline'/);
 assert.match(banner,/if \(status !== 'offline' && status !== 'degraded'\)/);
 assert.match(banner,/status === 'offline' \? styles\.offline : styles\.degraded/);
 assert.match(banner,/Limited connection •/);
 assert.match(reporter,/wallNetworkStatus==='offline'\|\|wallNetworkStatus==='degraded'\)return/);
 assert.match(reporter,/base.category==='NETWORK_ERROR'/);
 assert.match(reporter,/base.category==='TIMEOUT_ERROR'/);
});
test('network timeouts and disconnections show quiet, temporary information',()=>{
 for(const block of [timeout,network]){
  assert.match(block,/tone: 'info'/);
  assert.match(block,/supportCode: null/);
  assert.match(block,/needsSupport: false/);
  assert.match(block,/nextStep: null/);
 }
 assert.match(reporter,/tone:'info',[\s\S]*?supportCode:null,[\s\S]*?needsSupport:false/);
 assert.match(reporter,/autoHideMs:4500/);
 assert.match(reporter,/tone:'error' as const/);
});
test('comment contents, retry and true-error support stay available',()=>{
 assert.match(loader,/setComments\(hydratedRows\.map/);
 assert.match(loader,/No internet connection\. Check your signal and tap Retry/);
 assert.match(loader,/Limited connection\. Tap Retry when your signal improves/);
 assert.match(loader,/Comments are taking longer than usual\. Tap Retry/);
 assert.match(loader,/reportCommunityFailure\(/);
 assert.match(wall,/setCommentLoadError\(null\)/);
 assert.match(wall,/commentLoadSeqRef\.current/);
 assert.match(wall,/BuklodCommunityInlineAd/);
 assert.match(reporter,/needsSupport:true/);
});
