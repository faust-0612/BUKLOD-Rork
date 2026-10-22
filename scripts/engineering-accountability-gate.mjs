#!/usr/bin/env node
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const fail = message => { console.error('ACCOUNTABILITY BLOCK:',message); process.exitCode=1; };
const file = process.env.BUKLOD_SCOPE_MANIFEST || '.buklod/work-scope.json';
if (!fs.existsSync(file)) { fail('Missing per-workstream scope manifest '+file); process.exit(); }
let m; try {m=JSON.parse(fs.readFileSync(file,'utf8'));} catch {fail('Invalid manifest JSON');process.exit();}
if (!m.objective || !m.baseRef || !m.productionBaselineEvidence || !Array.isArray(m.allowedPaths) || !m.allowedPaths.length || !Array.isArray(m.acceptanceChecks) || !m.acceptanceChecks.length) {fail('Missing objective, baseRef, production baseline evidence, allowedPaths or acceptanceChecks');process.exit();}
if (m.baseRef==='main' && !m.productionBaselineEvidence.includes('verified:')) {fail('main is not automatically the live baseline');process.exit();}
if (process.env.BUKLOD_PRODUCTION_RELEASE==='true') {fail('Production release requires independent live fingerprint and RC evidence; this PR gate is not sufficient');process.exit();}
const safe = p => typeof p==='string' && p.length && !p.includes('..') && !p.startsWith('/') && !p.includes('\\');
if (!m.allowedPaths.every(safe)) {fail('Unsafe allowedPaths');process.exit();}
let changed=[];try {changed=execFileSync('git',['diff','--name-only','--diff-filter=ACMRD',m.baseRef,'HEAD','--'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);}catch {fail('Base ref missing; no fallback');process.exit();}
const allowed=p=>m.allowedPaths.some(rule=>rule.endsWith('/')?p.startsWith(rule):p===rule);
const blocked=changed.filter(p=>!allowed(p));
if (changed.includes(file) && m.objective.toLowerCase().includes('stability')) fail('Stability work may not self-edit the scope manifest');
if(blocked.length)fail('Unrelated changes: '+blocked.join(', '));
if(changed.length===0)fail('No changes to verify');
if(!process.exitCode)console.log('ACCOUNTABILITY PASS',JSON.stringify({objective:m.objective,baseRef:m.baseRef,changed}));
