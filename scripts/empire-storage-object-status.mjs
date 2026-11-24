/** Storage gateway can return HTTP 400 with an explicit legacy 404 JSON body.
 * Only a recognized missing-object response is absence. Never treat generic
 * 400/404, permission denial, missing bucket or malformed bodies as absence. */
export function isMissingObject(status, body) {
 if (status !== 400 && status !== 404) return false;
 if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
 const code = body.code ?? body.error;
 const message = body.message;
 const embeddedStatus = body.statusCode ?? body.status;
 if (embeddedStatus !== undefined && String(embeddedStatus) !== '404') return false;
 if (status === 400 && embeddedStatus === undefined && code !== 'NoSuchKey') return false;
 return code === 'NoSuchKey' || (code === 'not_found' && message === 'Object not found');
}
export async function assertMissingObject(response, label) {
 let body;
 try { body = await response.json(); } catch { body = null; }
 if (!isMissingObject(response.status, body)) throw Error(label+' HTTP '+response.status+'; never overwrite uncertain state');
}
