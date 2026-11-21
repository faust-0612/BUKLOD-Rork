/* BUKLOD_OTA_SILENT_NEXT_LAUNCH_R1
 * Expo checks/downloads on cold start. Long-lived native sessions also
 * check periodically while foregrounded; the next normal cold start applies
 * the OTA without a restart banner, prompt, or disruptive reload.
 */
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { createSilentOtaDownloader, GENESIS_OTA_INITIAL_CHECK_MS } from '@/lib/buklodSilentOtaPolicy';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';

// Singleton survives provider remounts. Never initiate simultaneous downloads.
const ota = createSilentOtaDownloader({
  checkForUpdate: () => Updates.checkForUpdateAsync(),
  fetchUpdate: () => Updates.fetchUpdateAsync(),
  // A missed cold-start request otherwise waits an entire hour. Genesis staging
  // checks once early without an unsafe in-session reload. Production unchanged.
  initialCheckDelayMs: isGenesisPreviewBuild() ? GENESIS_OTA_INITIAL_CHECK_MS : undefined,
});

export default function BuklodOtaFreshnessHost() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const onForeground = () => {
      if (timer || !ota.isDue()) return;
      // Avoid all clients checking simultaneously after an announcement.
      timer = setTimeout(() => {
        timer = null;
        if (AppState.currentState === 'active') {
          void ota.checkIfDue();
        }
      }, 5_000 + Math.floor(Math.random() * 20_000));
    };

    const initial = isGenesisPreviewBuild()
      ? setTimeout(() => {
          if (AppState.currentState === 'active') void ota.checkIfDue();
        }, GENESIS_OTA_INITIAL_CHECK_MS + 1000)
      : null;

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') onForeground();
      else clear();
    });

    return () => {
      clear();
      if (initial) clearTimeout(initial);
      subscription.remove();
    };
  }, []);

  // Deliberately no banner: updates activate on the next regular app launch.
  return null;
}
