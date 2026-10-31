import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUKLOD_CLUSTER_INVITE_ORIGIN,
  buildClusterInviteWebUrl,
  buildClusterInviteUrlForScheme,
  parseClusterInviteLink,
} from '../src/lib/buklodClusterInviteUrl.ts';

const id = '556fb895-0324-431e-853e-bc2810b07bb8';

test('Share, Copy and QR receive an HTTPS link with an exact Cluster route', () => {
  const link = buildClusterInviteWebUrl(id);
  assert.equal(link, `${BUKLOD_CLUSTER_INVITE_ORIGIN}/clusters/${id}?fromInvite=1`);
  assert.equal(parseClusterInviteLink(link), id);
  assert.match(link, /^https:\/\//);
  assert.equal(link.includes('buklod://'), false);
});

test('staging and classroom share targets never silently redirect to main production', () => {
  assert.equal(
    buildClusterInviteUrlForScheme(id, 'buklod-staging'),
    `buklod-staging://clusters/${id}`
  );
  assert.equal(
    buildClusterInviteUrlForScheme(id, 'buklod-classroom'),
    `buklod-classroom://clusters/${id}`
  );
  assert.equal(
    buildClusterInviteUrlForScheme(id, 'buklod'),
    buildClusterInviteWebUrl(id)
  );
});

test('previous app links and Expo Router paths remain valid', () => {
  for (const value of [
    `buklod://clusters/${id}`,
    `buklod-staging://clusters/${id}`,
    `/clusters/${id}`,
    `clusters/${id}`,
    `https://buklod.expo.app/clusters/${id}`,
    `https://buklod.expo.app/clusters/${id}/?fromInvite=1`,
  ]) assert.equal(parseClusterInviteLink(value), id, value);
});

test('URL matching does not treat arbitrary or malicious domains as invites', () => {
  for (const value of [
    `https://buklod.expo.app.evil.example/clusters/${id}`,
    `https://example.com/clusters/${id}`,
    `http://buklod.expo.app/clusters/${id}`,
    `https://buklod.expo.app/not-clusters/${id}`,
    `https://buklod.expo.app/clusters/${id}%2Fextra`,
    `https://buklod.expo.app/clusters/%ZZ`,
    `https://buklod.expo.app/clusters/${id}/other`,
    `https://buklod.expo.app/clusters/${id}?junk=/clusters/another`,
    'https://buklod.expo.app/clusters/',
    'not-a-link',
    '',
  ]) {
    // Query values cannot change the exact destination.
    if (value.endsWith('?junk=/clusters/another')) assert.equal(parseClusterInviteLink(value), id);
    else assert.equal(parseClusterInviteLink(value), null, value);
  }
});
