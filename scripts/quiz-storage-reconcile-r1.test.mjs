import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileBucket, MigrationStop, contentTypeFor } from './quiz-storage-reconcile-r1.mjs';

// All tests use pure in-memory fake Storage clients.
// No networks, credentials, Supabase project writes or billable CI required.
const ORIGINALS = Array.from({ length: 98 }, (_, i) => [
  'docs/document_' + String(i).padStart(3,'0') + (i % 9 === 0 ? '.docx' : '.pdf'),
  'private-bytes-' + String(i),
]);

function fakeClient(rows, { publicBucket = false } = {}) {
  const files = new Map(rows);
  let uploads = 0;
  const bucket = {
    async list(folder, { limit = 100, offset = 0 } = {}) {
      if (!folder) return { data: [{ name: 'docs', id: null, metadata: null }] };
      const names = [...files.keys()]
        .filter(p => p.startsWith(folder + '/'))
        .map(p => p.slice(folder.length + 1))
        .sort();
      return {
        data: names.slice(offset,offset+limit)
          .map(name => ({ name, id: 'fake', metadata: { size: 64 } })),
      };
    },
    async download(path) {
      if (!files.has(path)) return { error: { statusCode: 404, message: 'not found' } };
      const body = new Blob([files.get(path)]);
      return { data: body };
    },
    async upload(path, data, options) {
      uploads++;
      assert.equal(options.upsert, false, 'never overwrite Storage objects');
      if (files.has(path)) return { error: { statusCode: 409, message: 'conflict' } };
      files.set(path, Buffer.from(data).toString('utf8'));
      return { data: { path } };
    },
  };
  return {
    files,
    bucket,
    storage: {
      getBucket: async () => ({ data: { public: publicBucket } }),
      from: name => {
        assert.equal(name,'buklod-quiz-source-docs');
        return bucket;
      },
    },
    get uploads() { return uploads; },
  };
}

test('dry-run verifies the 12 existing objects without uploading', async () => {
  const source = fakeClient(ORIGINALS);
  const target = fakeClient(ORIGINALS.slice(0,12));
  const result = await reconcileBucket(source,target,{apply:false});
  assert.equal(result.status,'PREVIEW_ONLY');
  assert.equal(result.existingVerified,12);
  assert.equal(result.missing,86);
  assert.equal(target.uploads,0);
  assert.equal(source.files.size,98);
});

test('copy 86 missing documents, SHA-readback all 98, idempotent rerun', async () => {
  const source = fakeClient(ORIGINALS);
  const target = fakeClient(ORIGINALS.slice(0,12));
  const first = await reconcileBucket(source,target,{apply:true});
  assert.equal(first.status,'CONTENT_PARITY_VERIFIED');
  assert.equal(first.contentVerified,98);
  assert.equal(first.copied,86);
  assert.equal(target.files.size,98);
  const repeat = await reconcileBucket(source,target,{apply:true});
  assert.equal(repeat.copied,0);
  assert.equal(repeat.contentVerified,98);
  assert.equal(target.uploads,86);
  for (const [path,bytes] of ORIGINALS) {
    assert.equal(target.files.get(path),bytes);
  }
});

test('different bytes at an existing path stop before any upload', async () => {
  const source = fakeClient(ORIGINALS);
  const target = fakeClient(ORIGINALS.slice(0,12));
  target.files.set(ORIGINALS[0][0],'conflicting-private-bytes');
  await assert.rejects(
    reconcileBucket(source,target,{apply:true}),
    e => e instanceof MigrationStop && e.code==='EXISTING_OBJECT_CONTENT_CONFLICT',
  );
  assert.equal(target.uploads,0);
});

test('source inventory change stops before any upload', async () => {
  const source = fakeClient(ORIGINALS.slice(0,97));
  const target = fakeClient(ORIGINALS.slice(0,12));
  await assert.rejects(
    reconcileBucket(source,target,{apply:true}),
    e => e instanceof MigrationStop && e.code==='SOURCE_INVENTORY_CHANGED',
  );
  assert.equal(target.uploads,0);
});

test('source content mutation mid-copy invalidates completion', async () => {
  const source = fakeClient(ORIGINALS);
  const target = fakeClient(ORIGINALS.slice(0,12));
  const base = target.bucket.upload.bind(target.bucket);
  let changed = false;
  target.bucket.upload = async (...args) => {
    const result = await base(...args);
    if (!changed) {
      changed = true;
      source.files.set(ORIGINALS[20][0],'changed-after-snapshot');
    }
    return result;
  };
  await assert.rejects(
    reconcileBucket(source,target,{apply:true}),
    e => e instanceof MigrationStop && e.code==='SOURCE_BYTES_CHANGED_DURING_COPY',
  );
});

test('public Storage buckets are refused', async () => {
  const source = fakeClient(ORIGINALS);
  const target = fakeClient(ORIGINALS.slice(0,12),{publicBucket:true});
  await assert.rejects(
    reconcileBucket(source,target,{apply:true}),
    e => e instanceof MigrationStop && e.code==='PRIVATE_BUCKET_REQUIRED',
  );
  assert.equal(target.uploads,0);
});

test('traversal paths and unsupported extensions are refused', () => {
  assert.throws(() => contentTypeFor('../private.pdf'),/UNSAFE_STORAGE_PATH/);
  assert.throws(() => contentTypeFor('docs/not-a-doc.exe'),/UNSUPPORTED_DOCUMENT_TYPE/);
  assert.equal(contentTypeFor('docs/ref.PDF'),'application/pdf');
});
