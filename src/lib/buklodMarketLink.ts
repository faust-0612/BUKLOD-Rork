/** Small, dependency-free Wall marker contract; keep native image modules off the Wall load path. */
export function marketMarkerId(body: string | null | undefined) {
  return /\[BUKLOD_MARKET:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i.exec(body || '')?.[1] ?? null;
}
export function marketVisiblePostBody(body: string | null | undefined) {
  return (body || '').replace(/\s*\[BUKLOD_MARKET:[0-9a-f-]{36}\]/gi, '').trim();
}
