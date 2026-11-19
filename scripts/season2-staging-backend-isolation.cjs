#!/usr/bin/env node
'use strict';

// Season 2 staging URL identity guard. No network, no Supabase writes.
// This gate does NOT prove SQL/RLS readiness or authorize token minting.
const fs = require('node:fs');
const MAIN_PRODUCTION_REF = 'yhanxndaqbmuzbdqlblu';
const RESERVED_APP_REFS = new Set([
  MAIN_PRODUCTION_REF,
  'oppswibwjrruxkrpiwej',
  'cjtehbfspgimyhifnjon',
]);
const REF_PATTERN = /^[a-z0-9]{20}$/;

function block(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}

function readEnvValue(source, name) {
  if (typeof source !== 'string') block('INVALID_ENV_FILE');
  const values = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] !== name) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values.push(value);
  }
  if (values.length !== 1 || !values[0]) block('ENV_URL_MISSING_OR_DUPLICATED');
  return values[0];
}

function canonicalSupabaseRef(raw) {
  if (typeof raw !== 'string') block('INVALID_SUPABASE_URL');
  let parsed;
  try { parsed = new URL(raw); } catch { block('INVALID_SUPABASE_URL'); }
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.port || parsed.search || parsed.hash ||
      (parsed.pathname !== '/' && parsed.pathname !== '') || !match) {
    block('NON_CANONICAL_SUPABASE_URL');
  }
  return match[1];
}

function inspectSeason2Staging({ previewEnv, productionEnv, approvedStagingRef }) {
  const production = canonicalSupabaseRef(
    readEnvValue(productionEnv, 'EXPO_PUBLIC_SUPABASE_URL')
  );
  if (production !== MAIN_PRODUCTION_REF) block('PRODUCTION_IDENTITY_CHANGED');
  const preview = canonicalSupabaseRef(
    readEnvValue(previewEnv, 'EXPO_PUBLIC_SUPABASE_URL')
  );
  if (!REF_PATTERN.test(approvedStagingRef || '') ||
      RESERVED_APP_REFS.has(approvedStagingRef)) block('STAGING_PROJECT_NOT_APPROVED');
  if (preview !== approvedStagingRef || preview === production ||
      RESERVED_APP_REFS.has(preview)) block('STAGING_BACKEND_NOT_ISOLATED');
  return Object.freeze({
    status: 'URL_IDENTITY_CHECKED_ONLY',
    productionModified: false,
    databaseOrRlsVerified: false,
    rewardsAuthorized: false,
  });
}

function runCli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--preview-file', '--production-file', '--approved-ref'].includes(argv[i]) ||
        !argv[i + 1] || Object.hasOwn(args, argv[i])) block('INVALID_GUARD_ARGUMENTS');
    args[argv[i]] = argv[i + 1];
  }
  if (argv.length !== 6 || Object.keys(args).length !== 3) block('INVALID_GUARD_ARGUMENTS');
  return inspectSeason2Staging({
    previewEnv: fs.readFileSync(args['--preview-file'], 'utf8'),
    productionEnv: fs.readFileSync(args['--production-file'], 'utf8'),
    approvedStagingRef: args['--approved-ref'],
  });
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
    console.log('S2_STAGE_URL_IDENTITY_PASS: separate configured URL. No database/RLS or reward activation claim.');
  } catch (error) {
    // Never print environment variables, URLs or credentials in CI logs.
    console.error('S2_STAGE_URL_IDENTITY_BLOCK: ' +
      (error.code && /^[A-Z_]+$/.test(error.code) ? error.code : 'UNVERIFIED'));
    process.exitCode = 1;
  }
}
module.exports = { readEnvValue, canonicalSupabaseRef, inspectSeason2Staging, runCli };
