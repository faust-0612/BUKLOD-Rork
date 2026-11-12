import test from 'node:test';
import assert from 'node:assert/strict';
import {safeBuklodRoute,resolveBuklodCrashRoute} from '../src/lib/buklodRouteDiagnostics.ts';
import {readFileSync} from 'node:fs';

test('BSOC error routes identify only static trusted screens',()=>{
  assert.equal(safeBuklodRoute('/admin/bsoc-gpt-debug'),'admin/bsoc-gpt-debug');
  assert.equal(safeBuklodRoute('/admin/bsoc-conversations'),'admin/bsoc-conversations');
  assert.equal(safeBuklodRoute('/admin/priority-requests'),'admin/priority-requests');
  assert.equal(safeBuklodRoute('/admin/some-secret-member-id'),'admin/:id');
  assert.equal(safeBuklodRoute('/admin/bsoc-support?case_id=private'),'admin/bsoc-support');
  assert.equal(resolveBuklodCrashRoute('/admin/bsoc-support',['admin','bsoc-support']),'admin/bsoc-support');
});
test('render error recovery preserves safe exit to non-admin area',()=>{
 const layout=readFileSync('src/app/_layout.tsx','utf8');
 assert.match(layout,/pathname\.startsWith\('\/admin\/'\)/);
 assert.match(layout,/\? '\/me'/);
 assert.match(layout,/routeModule = resolveBuklodCrashRoute\(pathname, segments\)/);
 assert.match(layout,/<Text style=\{styles\.errorCode\}>Module: \{routeModule\}<\/Text>/);
});
