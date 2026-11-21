/**
 * Google Drive API transport for a USER-authorized access token.
 *
 * No OAuth credentials, tokens, document contents or recovery keys are sent to
 * BUKLOD servers. This is a transport layer only: callers must first obtain an
 * access token via Google's supported native authorization SDK and the
 * drive.file scope. Never call from an unauthenticated/unconsented background job.
 */
export const SMART_DRAWER_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const SMART_DRAWER_BACKUP_MIME = 'application/octet-stream';
export const SMART_DRAWER_BACKUP_NAME = 'BUKLOD-Smart-Drawer.buklodbackup';

export type DriveBackupFile = {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
  appProperties?: Record<string, string>;
};

type Fetcher = typeof fetch;
type AccessTokenProvider = () => Promise<string>;

function validateToken(value: string) {
  if (!value || !value.trim()) throw new Error('Connect your personal Google Drive before syncing.');
  return value.trim();
}

async function requestDrive(
  getToken: AccessTokenProvider,
  url: string,
  init: RequestInit,
  fetcher: Fetcher,
) {
  const token = validateToken(await getToken());
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 20000);
  try {
    const response = await fetcher(url, {
      ...init,
      signal: abort.signal,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: 'Bearer ' + token,
      },
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error('Google Drive authorization expired or permission denied. Reconnect your Drive.');
    }
    if (response.status === 429) throw new Error('Google Drive quota reached. Retry later; local notes are safe.');
    if (!response.ok) throw new Error('Google Drive request failed (HTTP ' + response.status + ').');
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function listSmartDrawerDriveBackups(
  getToken: AccessTokenProvider,
  fetcher: Fetcher = fetch,
): Promise<DriveBackupFile[]> {
  const params = new URLSearchParams({
    q: "name = '" + SMART_DRAWER_BACKUP_NAME + "' and trashed = false",
    spaces: 'drive',
    pageSize: '100',
    fields: 'nextPageToken,files(id,name,modifiedTime,size,appProperties)',
  });
  const items: DriveBackupFile[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    if (pageToken) params.set('pageToken', pageToken);
    else params.delete('pageToken');
    const response = await requestDrive(
      getToken,
      'https://www.googleapis.com/drive/v3/files?' + params.toString(),
      { method: 'GET' },
      fetcher,
    );
    const json = await response.json() as {
      files?: DriveBackupFile[];
      nextPageToken?: string;
    };
    items.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) return items;
  }
  throw new Error('Google Drive file list is incomplete; no upload was attempted.');
}

/** Upload an ALREADY ENCRYPTED archive. Does not accept plaintext notes. */
export async function uploadEncryptedSmartDrawerBackup(
  getToken: AccessTokenProvider,
  encryptedArchive: string,
  getExistingFileId?: string,
  fetcher: Fetcher = fetch,
): Promise<{ id: string }> {
  if (!encryptedArchive || encryptedArchive.length > 28 * 1024 * 1024) {
    throw new Error('Invalid or oversized encrypted archive.');
  }
  let parsed: { format?: string };
  try { parsed = JSON.parse(encryptedArchive) as { format?: string }; }
  catch { throw new Error('Backup is not encrypted JSON.'); }
  if (parsed.format !== 'buklod.drawer.encrypted.v1') {
    throw new Error('Refusing to upload unencrypted Drawer contents.');
  }
  const metadata = {
    name: SMART_DRAWER_BACKUP_NAME,
    mimeType: SMART_DRAWER_BACKUP_MIME,
    appProperties: { buklodDrawer: 'encrypted-v1' },
  };
  const boundary = 'buklod_' + Math.random().toString(36).slice(2);
  const body = [
    '--' + boundary,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    '--' + boundary,
    'Content-Type: ' + SMART_DRAWER_BACKUP_MIME,
    '',
    encryptedArchive,
    '--' + boundary + '--',
    '',
  ].join('\r\n');

  // PATCH existing revision avoids needless copies when the caller knows the
  // exact file ID; create is only used for the first backup.
  const existingId = getExistingFileId;
  if (existingId && !/^[a-zA-Z0-9_-]{10,}$/.test(existingId)) {
    throw new Error('Invalid Google Drive file ID.');
  }
  const endpoint = existingId
    ? 'https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(existingId) + '?uploadType=multipart&fields=id'
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  const response = await requestDrive(getToken, endpoint, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
    body,
  }, fetcher);
  const json = await response.json() as { id?: string };
  if (!json.id) throw new Error('Google Drive upload returned no file ID.');
  return { id: json.id };
}

export async function downloadEncryptedSmartDrawerBackup(
  getToken: AccessTokenProvider,
  fileId: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) throw new Error('Invalid Google Drive file ID.');
  const response = await requestDrive(
    getToken,
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media',
    { method: 'GET' },
    fetcher,
  );
  const text = await response.text();
  if (text.length > 28 * 1024 * 1024) throw new Error('Encrypted backup exceeds import size limit.');
  let decoded: { format?: string };
  try { decoded = JSON.parse(text) as { format?: string }; }
  catch { throw new Error('Google Drive returned an invalid backup file.'); }
  if (decoded.format !== 'buklod.drawer.encrypted.v1') {
    throw new Error('Google Drive file is not an encrypted BUKLOD backup.');
  }
  return text;
}
