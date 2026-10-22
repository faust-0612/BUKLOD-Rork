const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/lib/buklodCommunityPostMedia.ts'),
  'utf8',
);
const start = source.indexOf('export async function discardIncompleteCommunityPost(');
const end = source.indexOf('\nexport function extractCreatedRecordId(', start);
assert.ok(start >= 0 && end > start, 'exact rollback helper must exist');
const rollbackSource = source.slice(start, end);

function setup({ scopedError = null, deleteError = null, throwDelete = false } = {}) {
  const calls = [];
  const supabase = {
    rpc: async (name) => {
      calls.push(name);
      if (throwDelete && name === 'delete_buklod_community_post_v1') {
        throw Error('timeout after remote commit');
      }
      return { error: name === 'buklod_scope_social_delete_post_v1' ? scopedError : deleteError };
    },
    from: (table) => {
      calls.push('table:' + table);
      return {
        update: () => ({
          eq: async () => {
            calls.push('hide-post');
            return { error: null };
          },
        }),
      };
    },
    storage: {
      from: () => ({
        remove: async () => {
          calls.push('DANGEROUS_STORAGE_DELETE');
          throw Error('client must not delete media after ambiguous RPC');
        },
      }),
    },
  };
  const executable = stripTypeScriptTypes(rollbackSource).replace(/^export\s+/, '');
  const fn = vm.runInNewContext(
    executable + '\ndiscardIncompleteCommunityPost;',
    { supabase },
  );
  return { fn, calls };
}

test('ambiguous post creation (missing id) keeps uploaded photos', async () => {
  const { fn, calls } = setup();
  await fn({ postId: null, mediaPaths: ['owner/photo.jpg'] });
  assert.deepEqual(calls, []);
});

test('post deletion request success cannot cause client-side storage deletion', async () => {
  const { fn, calls } = setup();
  await fn({ postId: 'post-1', mediaPaths: ['owner/photo.jpg'] });
  assert.deepEqual(calls, ['delete_buklod_community_post_v1']);
});

test('post deletion RPC errors keep photos even after fallback hide', async () => {
  const { fn, calls } = setup({ deleteError: Error('DB timeout') });
  await fn({ postId: 'post-2', mediaPaths: ['owner/photo.jpg'] });
  assert.deepEqual(calls, [
    'delete_buklod_community_post_v1',
    'table:community_posts',
    'hide-post',
  ]);
});

test('scoped rollback falling back from failed delete also keeps media', async () => {
  const { fn, calls } = setup({ scopedError: Error('scoped delete unavailable') });
  await fn({
    postId: 'post-3',
    scopeId: 'scope-1',
    mediaPaths: ['owner/photo.jpg'],
  });
  assert.deepEqual(calls, [
    'buklod_scope_social_delete_post_v1',
    'delete_buklod_community_post_v1',
  ]);
});

test('timeout after ambiguous DB commit never triggers storage cleanup', async () => {
  const { fn, calls } = setup({ throwDelete: true });
  await fn({ postId: 'post-4', mediaPaths: ['owner/photo.jpg'] });
  assert.deepEqual(calls, ['delete_buklod_community_post_v1']);
});

test('rollback helper contains no storage or AWS object deletion', () => {
  assert.equal(/\.storage\s*\./.test(rollbackSource), false);
  assert.equal(/deleteAwsWallVideo\s*\(/.test(rollbackSource), false);
});
