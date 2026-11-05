#!/usr/bin/env node
// Fail-closed guard against promoting a stale or divergent staging candidate.
// This gate reports ancestry only; it never merges, resets, rebases, or deploys.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function assessReconciliation({ baseOnly, candidateOnly }) {
  if (!Number.isInteger(baseOnly) || baseOnly < 0 || !Number.isInteger(candidateOnly) || candidateOnly < 0) {
    throw new TypeError('Commit counts must be non-negative integers.');
  }
  if (baseOnly > 0) {
    return {
      status: 'BLOCKED_STALE_OR_DIVERGED',
      baseOnly,
      candidateOnly,
      releaseAllowed: false,
      reason: candidateOnly > 0
        ? 'Candidate has unique commits and is also missing commits from the canonical baseline. Reconcile by forward-porting only approved deltas onto the current baseline.'
        : 'Candidate is behind the canonical baseline. Rebuild/rebase the candidate from the canonical baseline, then reapply only approved deltas.'
    };
  }
  return {
    status: candidateOnly === 0 ? 'IN_SYNC' : 'CANDIDATE_AHEAD',
    baseOnly,
    candidateOnly,
    releaseAllowed: true,
    reason: candidateOnly === 0
      ? 'Candidate and canonical baseline point to the same history.'
      : 'Candidate contains the complete canonical baseline plus candidate-only commits. Those commits still require normal scope, regression, RC and production gates.'
  };
}

function countCommits(baseRef, candidateRef) {
  const output = execFileSync('git', ['rev-list', '--left-right', '--count', baseRef + '...' + candidateRef], { encoding: 'utf8' }).trim();
  const match = output.match(/^(\d+)\s+(\d+)$/);
  if (!match) throw new Error('Unable to parse git rev-list ancestry counts.');
  return { baseOnly: Number(match[1]), candidateOnly: Number(match[2]) };
}

function run() {
  const baseRef = process.argv[2] || 'main';
  const candidateRef = process.argv[3] || process.env.BUKLOD_STAGING_REF;
  if (!candidateRef) {
    console.error('Usage: node scripts/staging-reconciliation-gate.mjs <canonical-base-ref> <staging-candidate-ref>');
    process.exitCode = 2;
    return;
  }
  for (const ref of [baseRef, candidateRef]) {
    if (!/^[A-Za-z0-9._/-]+$/.test(ref) || ref.startsWith('-') || ref.includes('..')) {
      console.error('Invalid Git ref:', ref);
      process.exitCode = 2;
      return;
    }
  }
  try {
    const result = assessReconciliation(countCommits(baseRef, candidateRef));
    console.log(JSON.stringify({ baseRef, candidateRef, ...result }, null, 2));
    if (!result.releaseAllowed) {
      console.error('STAGING RELEASE BLOCKED: reconcile candidate against canonical baseline before promotion.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('STAGING RECONCILIATION BLOCKED: unable to prove ancestry:', error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) run();
