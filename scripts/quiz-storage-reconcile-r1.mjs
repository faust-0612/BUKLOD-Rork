'use strict';

/**
 * BUKLOD Quiz private Storage cross-project migration, immutable source.
 *
 * PREVIEW (no uploads): node scripts/quiz-storage-reconcile-r1.mjs
 * APPLY (missing files only): node scripts/quiz-storage-reconcile-r1.mjs --apply
 *
 * Credentials come ONLY from the caller's environment or GitHub encrypted
 * secrets. Never commit or paste them into ChatGPT. Requires two service-role
 * / secret Storage API keys with least practical scoped use.
 *
 * This utility never deletes or overwrites objects, changes RLS, or changes
 * PostgreSQL storage metadata directly. It verifies every copied file by
 * SHA-256 after readback through the official Storage API.
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SOURCE_URL = 'https://cjtehbfspgimyhifnjon.supabase.co';
export const MAIN_URL = 'https://yhanxndaqbmuzbdqlblu.supabase.co';
export const BUCKET = 'buklod-quiz-source-docs';
export const EXPECTED_SOURCE_OBJECTS = 98;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_SOURCE_SNAPSHOT_MEMORY = 128 * 1024 * 1024;
const MAX_LIST_OBJECTS = 1024;
const LIST_PAGE_SIZE = 100;
const MAX_RETRIES = 3;
const SUPPORTED_CONTENT_TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
]);

export class MigrationStop extends Error {
  constructor(code) {
    super(code);
    this.name = 'MigrationStop';
    this.code = code;
  }
}

function safePath(value) {
  if (!value || value.startsWith('/') || value.includes('\\') ||
      value.split('/').some(s => !s || s === '.' || s === '..') ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new MigrationStop('UNSAFE_STORAGE_PATH');
  }
  return value;
}
export function contentTypeFor(path) {
  safePath(path);
  const ext = /\.[^.\/]+$/.exec(path)?.[0].toLowerCase();
  const type = SUPPORTED_CONTENT_TYPES.get(ext);
  if (!type) throw new MigrationStop('UNSUPPORTED_DOCUMENT_TYPE');
  return type;
}
export async function sha256OfBlob(blob) {
  if (!blob || typeof blob.arrayBuffer !== 'function' || blob.size > MAX_FILE_SIZE) {
    throw new MigrationStop('INVALID_DOCUMENT_BLOB');
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (bytes.length > MAX_FILE_SIZE) throw new MigrationStop('DOCUMENT_SIZE_LIMIT');
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}
function transient(error) {
  const code = Number(error?.statusCode ?? error?.status ?? 0);
  return code === 408 || code === 429 || code >= 500 ||
    /temporar|timeout|network|fetch failed|ECONNRESET/i.test(String(error?.message ?? ''));
}
async function retry(operation) {
  for (let n = 0; n < MAX_RETRIES; n++) {
    try { return await operation(); }
    catch (error) {
      if (n === MAX_RETRIES - 1 || !transient(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (2 ** n)));
    }
  }
  throw new MigrationStop('EXHAUSTED_RETRIES');
}
async function storageCall(operation, code) {
  return retry(async () => {
    const { data, error } = await operation();
    if (error) {
      const wrapped = new Error(String(error?.message ?? 'Storage request failed'));
      wrapped.statusCode = Number(error?.statusCode ?? error?.status ?? 0);
      throw wrapped;
    }
    if (data == null) throw new MigrationStop(code);
    return data;
  });
}

export async function listAllDocuments(bucketStorage) {
  const files = new Map();
  const visitedFolders = new Set();
  async function visit(prefix = '', depth = 0) {
    if (depth > 16 || visitedFolders.has(prefix)) {
      throw new MigrationStop('STORAGE_LIST_DEPTH_OR_DUPLICATE');
    }
    visitedFolders.add(prefix);
    let offset = 0;
    for (let page = 0; page < 50; page++) {
      const data = await storageCall(
        () => bucketStorage.list(prefix, {
          limit: LIST_PAGE_SIZE, offset,
          sortBy: { column: 'name', order: 'asc' },
        }),
        'STORAGE_LIST_EMPTY',
      );
      if (!Array.isArray(data)) throw new MigrationStop('INVALID_STORAGE_LIST');
      for (const item of data) {
        const leaf = String(item?.name ?? '');
        const full = safePath(prefix ? prefix + '/' + leaf : leaf);
        if (!item?.id && !item?.metadata) {
          await visit(full, depth + 1);
        } else {
          contentTypeFor(full);
          if (files.has(full)) throw new MigrationStop('DUPLICATE_STORAGE_ENTRY');
          files.set(full, item);
          if (files.size > MAX_LIST_OBJECTS) throw new MigrationStop('STORAGE_LIST_EXCEEDED');
        }
      }
      offset += data.length;
      if (data.length < LIST_PAGE_SIZE) return;
    }
    throw new MigrationStop('STORAGE_PAGINATION_EXCEEDED');
  }
  await visit();
  return files;
}
async function download(storage, path) {
  const blob = await storageCall(() => storage.download(path), 'DOCUMENT_DOWNLOAD_EMPTY');
  return sha256OfBlob(blob);
}
async function getPrivateBucket(client) {
  const bucket = await storageCall(() => client.storage.getBucket(BUCKET), 'BUCKET_UNAVAILABLE');
  if (bucket.public !== false) throw new MigrationStop('PRIVATE_BUCKET_REQUIRED');
  return client.storage.from(BUCKET);
}

export async function reconcileBucket(sourceClient, mainClient, options = {}) {
  const apply = options.apply === true;
  const log = options.log ?? (() => {});
  const source = await getPrivateBucket(sourceClient);
  const main = await getPrivateBucket(mainClient);
  const [srcFiles, mainFiles] = await Promise.all([
    listAllDocuments(source),
    listAllDocuments(main),
  ]);
  if (srcFiles.size !== EXPECTED_SOURCE_OBJECTS) {
    // A different source count may indicate new documents since snapshot.
    throw new MigrationStop('SOURCE_INVENTORY_CHANGED');
  }
  const originalNames = [...srcFiles.keys()].sort();
  const present = originalNames.filter(p => mainFiles.has(p));
  const missing = originalNames.filter(p => !mainFiles.has(p));
  log({ step: 'inventory', source: originalNames.length, existing: present.length, missing: missing.length });

  // Prehash the entire *source* before writing anything to the destination.
  // Otherwise, a source edit between inventory and a later upload can slip
  // past the final re-read. Cache bytes in memory only, with a bounded cap.
  const sourceSnapshots = new Map();
  let snapshotBytes = 0;
  for (const path of originalNames) {
    const snapshot = await download(source, path);
    snapshotBytes += snapshot.bytes.length;
    if (snapshotBytes > MAX_SOURCE_SNAPSHOT_MEMORY) {
      throw new MigrationStop('SOURCE_SNAPSHOT_MEMORY_CAP');
    }
    sourceSnapshots.set(path, snapshot);
  }
  log({ step: 'source_snapshot_hashed', objects: sourceSnapshots.size, bytes: snapshotBytes });

  let contentVerified = 0;
  let bytesVerified = 0;
  const originalDigests = new Map();
  // Verify all existing paths BEFORE the first upload: any collision stops
  // without modifying an existing file.
  for (const path of present) {
    const src = sourceSnapshots.get(path);
    const dest = await download(main, path);
    if (src.sha256 !== dest.sha256 || src.bytes.length !== dest.bytes.length) {
      throw new MigrationStop('EXISTING_OBJECT_CONTENT_CONFLICT');
    }
    bytesVerified += src.bytes.length;
    originalDigests.set(path, src.sha256);
    contentVerified++;
  }
  log({ step: 'existing_verified', count: contentVerified });

  if (!apply) {
    return {
      status: 'PREVIEW_ONLY', sourceCount: originalNames.length,
      existingVerified: contentVerified, missing: missing.length,
      copied: 0, bytesVerified,
    };
  }

  // Sequential bounded copy protects Storage from request bursts. A stopped
  // run is safely resumable: existing files are verified on the next run.
  let copied = 0;
  for (const path of missing) {
    const src = sourceSnapshots.get(path);
    const contentType = contentTypeFor(path);
    try {
      await storageCall(() => main.upload(path, src.bytes, {
        contentType,
        upsert: false,
      }), 'UPLOAD_EMPTY');
    } catch {
      // Only accept an already-present object with identical bytes.
      const obj = await download(main, path).catch(() => null);
      if (!obj || obj.sha256 !== src.sha256) {
        throw new MigrationStop('UPLOAD_REJECTED_NO_OVERWRITE');
      }
    }
    const verify = await download(main, path);
    if (verify.sha256 !== src.sha256 || verify.bytes.length !== src.bytes.length) {
      throw new MigrationStop('UPLOADED_OBJECT_SHA256_MISMATCH');
    }
    bytesVerified += src.bytes.length;
    originalDigests.set(path, src.sha256);
    contentVerified++;
    copied++;
    if (copied % 10 === 0) {
      log({ step: 'copy_progress', copied, verified: contentVerified });
    }
  }
  if (contentVerified !== originalNames.length) {
    throw new MigrationStop('INCOMPLETE_SHA256_VERIFICATION');
  }
  // Recheck source listing AND content against pre-copy digests so uploads
  // cannot be declared complete if source changed mid-transfer.
  const finalInventory = await listAllDocuments(source);
  if (finalInventory.size !== originalNames.length ||
      originalNames.some(p => !finalInventory.has(p))) {
    throw new MigrationStop('SOURCE_INVENTORY_CHANGED_DURING_COPY');
  }
  for (const path of originalNames) {
    const finalSource = await download(source, path);
    if (finalSource.sha256 !== originalDigests.get(path)) {
      throw new MigrationStop('SOURCE_BYTES_CHANGED_DURING_COPY');
    }
  }
  return {
    status: 'CONTENT_PARITY_VERIFIED', sourceCount: originalNames.length,
    existingVerified: present.length, copied, missing: 0,
    bytesVerified, contentVerified,
    warning: 'Object owner IDs and end-user RLS access still require separate RC verification.',
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--apply') || args.length > 1) {
    throw new MigrationStop('INVALID_ARGUMENTS');
  }
  const apply = args.includes('--apply');
  const sourceKey = process.env.BUKLOD_QUIZ_SOURCE_STORAGE_ADMIN_KEY ?? '';
  const mainKey = process.env.BUKLOD_QUIZ_MAIN_STORAGE_ADMIN_KEY ?? '';
  if (!sourceKey || !mainKey ||
      /^sb_publishable_/i.test(sourceKey) || /^sb_publishable_/i.test(mainKey)) {
    throw new MigrationStop('PRIVATE_STORAGE_ADMIN_KEYS_NOT_CONFIGURED');
  }
  const { createClient } = await import('@supabase/supabase-js');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const source = createClient(SOURCE_URL, sourceKey, options);
  const main = createClient(MAIN_URL, mainKey, options);
  const result = await reconcileBucket(source, main, {
    apply,
    log: x => console.log(JSON.stringify(x)),
  });
  console.log(JSON.stringify(result));
  if (!apply) console.log('PREVIEW ONLY: no objects were uploaded.');
  else console.log('Content copied and SHA-256 readback verified; RLS owner/access and DB source-delta gates remain pending.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('BLOCKER:', error instanceof MigrationStop ? error.code : 'STORAGE_UNEXPECTED_FAILURE');
    console.error('No source object was deleted; existing destination objects were never overwritten.');
    process.exitCode = 1;
  });
}
