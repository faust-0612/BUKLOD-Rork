#!/usr/bin/env node
'use strict';
// Strict release-only isolated branch gate. Does not modify the production app,
// backend, or global Season 2 lock. A failed requirement halts before publish.
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const season2 = require('./buklod-season2-production-embargo.cjs');

const BASE = '0a4f0b2b849f24b46b4a0643a6cc55ae539d5cdf';
const CHANNEL = 'production';
const REF = 'refs/heads/release/mentor-submit-pinned-baseline-20261120';
const EXPECTED_LIVE_ID = '01a1f3f0-11f0-7ba7-a0d2-8dbebdf97ae3';
const EXPECTED_LIVE_BUNDLE = 'unFUenZWw5gY5LAIPwwtyn8dlSV8j_NhAWoXbyCzQII';
const SHA = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();

function run() {
  assert.equal(process.env.GITHUB_REF,REF,'Wrong publish branch');
  assert.equal(process.env.GITHUB_SHA,SHA,'Unpinned workflow checkout');
  assert.equal(process.env.EXPO_PUBLIC_APP_ENV,CHANNEL,'Wrong build environment');
  assert.ok(/^BUKLOD_MENTOR_SUBMIT_ONLY_PROD_20261120:/.test(
    execFileSync('git',['show','-s','--format=%s','HEAD'],{encoding:'utf8'})),
    'No exact release marker');
  const record=JSON.parse(fs.readFileSync('.buklod/releases/mentor-submit-only-prod-20261120.json','utf8'));
  assert.equal(record.verifiedMainSourceSha,BASE);
  assert.equal(record.expectedBaselineUpdateId,EXPECTED_LIVE_ID);
  assert.equal(record.expectedBaselineBundleHash,EXPECTED_LIVE_BUNDLE);
  assert.equal(record.preReleaseSourceSha,
    execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim(),
    'Release marker parent must be the reviewed pre-release source');
  assert.equal(record.expectedRuntimeVersion,'1.3.2');
  assert.equal(record.expectedAndroidPackage,'org.mzbministry.buklod');
  assert.equal(record.expectedChannel,CHANNEL);
  assert.equal(record.productionAuthorized,true);
  assert.equal(record.season2ProductionAuthorized,false);
  assert.equal(record.backendMutationAuthorized,false);
  assert.equal(record.nativeBuildAuthorized,false);
  const violating = season2.runtimeEvidence();
  assert.deepEqual(violating, [], 'Season 2 source not authorized in isolated production');
  const evaluated = season2.evaluateRelease({
    target:CHANNEL,now:new Date(),sourceSha:SHA,season2Files:violating,approval:null
  });
  assert.equal(evaluated.allowed,true,'Season 2 production gate not satisfied');
  assert.equal(evaluated.reason,'INDEPENDENT_NON_SEASON2_FIX_REQUIRES_NORMAL_GATES');
  console.log('ISOLATED MENTOR RELEASE SCOPE PASS',JSON.stringify({
    sha:SHA,ref:REF,baseline:BASE,expectedLiveUpdateId:EXPECTED_LIVE_ID,
    season2Files:violating.length,release:record.releaseId
  }));
}

try{run();}catch(e){console.error('ISOLATED MENTOR RELEASE BLOCKED:',e.message);process.exitCode=1;}
