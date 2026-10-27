/* BUKLOD_CLIENT_VERSION_TELEMETRY_R1
 * Pure, deterministic throttle for client adoption reports. A changed OTA
 * fingerprint reports immediately; unchanged sessions at most every 6h.
 */
export const CLIENT_VERSION_REPORT_TTL_MS = 6 * 60 * 60 * 1000;

export type LastVersionReport = {
  fingerprint: string;
  at: number;
};

export function shouldReportClientVersion(
  previous: LastVersionReport | null,
  fingerprint: string,
  now: number,
): boolean {
  if (!previous || previous.fingerprint !== fingerprint) return true;
  if (!Number.isFinite(previous.at) || previous.at <= 0 || now < previous.at) return true;
  return now - previous.at >= CLIENT_VERSION_REPORT_TTL_MS;
}
