/**
 * Background-only EAS OTA download policy.
 * Expo activates downloaded updates on the next cold start.
 * Never reload the app during calls, PTT, drafts, or offline submissions.
 */
export const OTA_CHECK_INTERVAL_MS = 60 * 60 * 1000;
export const OTA_FAILURE_COOLDOWN_MS = 30 * 60 * 1000;

type CheckResult = { isAvailable: boolean };
type FetchResult = { isNew: boolean };

export function createSilentOtaDownloader({
  now = Date.now,
  checkForUpdate,
  fetchUpdate,
  checkIntervalMs = OTA_CHECK_INTERVAL_MS,
  failureCooldownMs = OTA_FAILURE_COOLDOWN_MS,
}: {
  now?: () => number;
  checkForUpdate: () => Promise<CheckResult>;
  fetchUpdate: () => Promise<FetchResult>;
  checkIntervalMs?: number;
  failureCooldownMs?: number;
}) {
  // Expo performs the initial cold-launch check. Do not duplicate that request.
  let nextCheckAt = now() + checkIntervalMs;
  let inFlight: Promise<boolean> | null = null;
  let pendingNextLaunch = false;

  return {
    isDue: () => !pendingNextLaunch && now() >= nextCheckAt,
    checkIfDue: (): Promise<boolean> => {
      if (inFlight) return inFlight;
      if (pendingNextLaunch || now() < nextCheckAt) return Promise.resolve(false);
      nextCheckAt = now() + checkIntervalMs;
      inFlight = (async () => {
        try {
          const result = await checkForUpdate();
          if (!result.isAvailable) return false;
          const downloaded = await fetchUpdate();
          if (downloaded.isNew) pendingNextLaunch = true;
          return downloaded.isNew;
        } catch {
          // Offline and transient server failures back off without UI interruption.
          nextCheckAt = now() + failureCooldownMs;
          return false;
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    },
  };
}
