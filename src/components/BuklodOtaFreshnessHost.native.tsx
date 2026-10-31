/* BUKLOD_OTA_FRESHNESS_R1
 * The built-in launch check handles cold starts. Long-lived Android sessions
 * need an infrequent foreground check, a download, and a user-controlled
 * restart, without interrupting an active call/PTT session.
 */
import * as Updates from 'expo-updates';
import React, { useEffect, useState } from 'react';
import { Alert, AppState, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Check on an hourly foreground return; launch checks still belong to Expo.
// Do not immediately reload during a call, recording, upload, or PTT session.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30 * 60 * 1000;


// The binary's native EAS channel is authoritative. Never enable fast checks
// in the production APK merely because a JS environment variable says staging.
const IS_STAGING_USER = Updates.channel === 'staging-user';
const STAGING_FOREGROUND_INTERVAL_MS = 60 * 1000;
const STAGING_FAILURE_COOLDOWN_MS = 30 * 1000;
const STAGING_MANUAL_COOLDOWN_MS = 8 * 1000;
type StagingCheckResult = 'downloaded' | 'current' | 'failed' | 'throttled';
let stagingNextCheckAt = 0;
let stagingLastManualCheckAt = 0;
let stagingRequest: Promise<StagingCheckResult> | null = null;

async function checkStagingAndDownload(manual: boolean): Promise<StagingCheckResult> {
  // Share one request across manual and foreground checks. No polling loop.
  if (stagingRequest) return stagingRequest;
  const now = Date.now();
  if (manual) {
    if (now - stagingLastManualCheckAt < STAGING_MANUAL_COOLDOWN_MS) return 'throttled';
    stagingLastManualCheckAt = now;
  } else if (now < stagingNextCheckAt) {
    return 'throttled';
  }

  stagingNextCheckAt = now + STAGING_FOREGROUND_INTERVAL_MS;
  stagingRequest = (async () => {
    try {
      const available = await Updates.checkForUpdateAsync();
      if (!available.isAvailable) return 'current';
      const fetched = await Updates.fetchUpdateAsync();
      return fetched.isNew ? 'downloaded' : 'current';
    } catch {
      stagingNextCheckAt = Date.now() + STAGING_FAILURE_COOLDOWN_MS;
      return 'failed';
    }
  })();

  try {
    return await stagingRequest;
  } finally {
    stagingRequest = null;
  }
}

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
  const [stagingBusy, setStagingBusy] = useState(false);
  const [stagingStatus, setStagingStatus] = useState('Ready to check DEV updates');

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || IS_STAGING_USER) return;

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


  // A separate, fast lane for the installable staging-user APK only.
  // Download on first mount and foreground returns; never restart silently.
  useEffect(() => {
    if (!IS_STAGING_USER || __DEV__ || !Updates.isEnabled) return;
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onForeground = () => {
      if (timer) clearTimeout(timer);
      if (downloaded || isUpdatePending || Date.now() < stagingNextCheckAt) return;
      timer = setTimeout(() => {
        timer = null;
        setStagingBusy(true);
        void checkStagingAndDownload(false).then(result => {
          if (!mounted) return;
          setStagingBusy(false);
          if (result === 'downloaded') {
            setDownloaded(true);
            setStagingStatus('Downloaded — restart when safe');
          } else if (result === 'failed') {
            setStagingStatus('Connection failed — tap Check update to retry');
          } else if (result === 'current') {
            setStagingStatus('Staging is up to date');
          }
        });
      }, 1500);
    };
    onForeground();
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
  }, [downloaded, isUpdatePending]);

  const restartStagingSafely = () => {
    Alert.alert(
      'Apply staging update?',
      'Restart only after saving edits and finishing any call, PTT, or upload.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Restart staging',
          onPress: () => {
            setReloading(true);
            void Updates.reloadAsync().catch(() => {
              setReloadError(true);
              setReloading(false);
              setStagingStatus('Restart failed — close and reopen staging');
            });
          },
        },
      ],
    );
  };

  const manuallyCheckStaging = () => {
    if (downloaded || isUpdatePending) {
      restartStagingSafely();
      return;
    }
    if (stagingBusy || reloading || __DEV__ || !Updates.isEnabled) return;
    setStagingBusy(true);
    setStagingStatus('Checking and downloading…');
    void checkStagingAndDownload(true).then(result => {
      setStagingBusy(false);
      if (result === 'downloaded') {
        setDownloaded(true);
        setStagingStatus('Downloaded — restart when safe');
        restartStagingSafely();
      } else if (result === 'current') {
        setStagingStatus('Staging is up to date');
      } else if (result === 'failed') {
        setStagingStatus('Connection failed — try again');
      } else {
        setStagingStatus('Recently checked — try again shortly');
      }
    });
  };

  if (IS_STAGING_USER) {
    const pending = downloaded || isUpdatePending;
    return (
      <View style={[styles.stagingBar, { paddingTop: statusBarInset + 6 }]}>
        <View style={styles.stagingDetails}>
          <Text style={styles.stagingTitle}>BUKLOD STAGING · LIVE DATA · OTA</Text>
          <Text style={styles.stagingMessage}>
            {reloadError ? 'Restart failed — close and reopen staging' : stagingStatus}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pending ? 'Restart staging to apply update' : 'Check and download latest staging update'}
          disabled={stagingBusy || reloading || __DEV__ || !Updates.isEnabled}
          onPress={manuallyCheckStaging}
          style={[styles.stagingAction, (stagingBusy || reloading) && styles.stagingDisabled]}
        >
          <Text style={styles.stagingActionText}>
            {reloading ? 'Restarting…' : stagingBusy ? 'Checking…' : pending ? 'Apply update' : 'Check update'}
          </Text>
        </Pressable>
      </View>
    );
  }

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
  stagingBar: { backgroundColor: '#E9F3FA', paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stagingDetails: { flex: 1, minWidth: 0 },
  stagingTitle: { color: '#154B74', fontSize: 11, fontWeight: '800' },
  stagingMessage: { color: '#25485C', fontSize: 11, flexShrink: 1 },
  stagingAction: { backgroundColor: '#155780', borderRadius: 8, minHeight: 42, paddingHorizontal: 12, justifyContent: 'center' },
  stagingDisabled: { opacity: 0.6 },
  stagingActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
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
