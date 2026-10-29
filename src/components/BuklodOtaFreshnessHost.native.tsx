/* BUKLOD_OTA_FRESHNESS_R1
 * The built-in launch check handles cold starts. Long-lived Android sessions
 * need an infrequent foreground check, a download, and a user-controlled
 * restart, without interrupting an active call/PTT session.
 */
import * as Updates from 'expo-updates';
import React, { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30 * 60 * 1000;

// Shared across remounts. Suppress duplicate cold-launch checks (Expo already
// performs that check) and bound repeated foreground/network-failure requests.
let nextCheckAt = Date.now() + CHECK_INTERVAL_MS;
let checking: Promise<boolean> | null = null;

async function checkAndDownload(): Promise<boolean> {
  if (checking) return checking;
  if (Date.now() < nextCheckAt) return false;

  nextCheckAt = Date.now() + CHECK_INTERVAL_MS;
  checking = (async () => {
    try {
      const latest = await Updates.checkForUpdateAsync();
      if (!latest.isAvailable) return false;
      const downloaded = await Updates.fetchUpdateAsync();
      return downloaded.isNew;
    } catch {
      nextCheckAt = Date.now() + FAILURE_COOLDOWN_MS;
      return false;
    }
  })();

  try {
    return await checking;
  } finally {
    checking = null;
  }
}

export default function BuklodOtaFreshnessHost() {
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  // Edge-to-edge Android draws this root banner under the system status bar.
  // Fallback to the platform status-bar height if safe-area metrics are zero.
  const statusBarInset = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
    : insets.top;
  const [downloaded, setDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onForeground = () => {
      if (timer) clearTimeout(timer);
      if (Date.now() < nextCheckAt) return;
      // Stagger return-to-app checks after outages or public announcements.
      timer = setTimeout(() => {
        timer = null;
        void checkAndDownload().then(ready => {
          if (mounted && ready) {
            setDownloaded(true);
            setDismissed(false);
          }
        });
      }, 5_000 + Math.floor(Math.random() * 20_000));
    };

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') onForeground();
      else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (__DEV__ || !Updates.isEnabled || dismissed || (!downloaded && !isUpdatePending)) {
    return null;
  }

  return (
    <View
      style={[styles.banner, { paddingTop: statusBarInset + 8 }]}
      accessibilityRole="alert"
    >
      <Text style={styles.message}>
        {reloadError
          ? 'Hindi ma-restart ngayon. Isara at buksan muli ang BUKLOD kapag maaari.'
          : 'May na-download na BUKLOD update. I-restart kapag walang tawag o PTT.'}
      </Text>
      <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Restart BUKLOD to apply update"
        disabled={reloading}
        onPress={() => {
          setReloading(true);
          void Updates.reloadAsync().catch(() => {
            setReloadError(true);
            setReloading(false);
          });
        }}
        style={styles.action}
      >
        <Text style={styles.actionText}>{reloading ? 'Sandali…' : 'I-restart'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apply update next time"
        onPress={() => setDismissed(true)}
        style={styles.later}
      >
        <Text style={styles.laterText}>Mamaya</Text>
      </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // BUKLOD_OTA_RESTART_SAFE_AREA_R1:
  // Two rows keep both buttons reachable on narrow phones and larger fonts.
  banner: {
    backgroundColor: '#E8F3EA',
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  message: { color: '#17422A', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  action: { backgroundColor: '#176A3F', borderRadius: 8, minWidth: 100, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  later: { minHeight: 44, minWidth: 70, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  laterText: { color: '#345A42', fontSize: 12, fontWeight: '700' },
});
