import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import { useNetwork } from '@/providers/NetworkProvider';
import {
  loadBuklodPttScopes,
  type BuklodPttKind,
  type BuklodPttScope,
} from '@/ptt/buklodPttCore';
import { setBuklodPttArmedKind } from '@/ptt/buklodPttDutyNotification';
import {
  bootstrapBuklodPttRuntime,
  connectBuklodPttRuntime,
  disconnectBuklodPttRuntime,
  getBuklodPttRuntimeState,
  pttDown,
  pttUp,
  selectBuklodPttTarget,
  subscribeBuklodPttRuntime,
  type BuklodPttRuntimeState,
} from '@/ptt/buklodPttRuntime';
import {
  hasSeenBuklodPttOnboarding,
  loadBuklodPttRouteMode,
  markBuklodPttOnboardingSeen,
  openBluetoothSettings,
  openWifiSettings,
  refreshBuklodPttSetup,
  resolveBuklodPttRoute,
  saveBuklodPttRouteMode,
  type BuklodPttRouteMode,
  type BuklodPttSetupSnapshot,
} from '@/ptt/buklodPttSetup';

type StatusTone = 'ready' | 'warn' | 'bad' | 'info';

type StatusCard = {
  tone: StatusTone;
  title: string;
  detail: string;
};

type NearbyPeer = {
  id: string;
  name: string;
  signal: 'Ready' | 'Weak signal';
};

function toneColor(tone: StatusTone) {
  if (tone === 'ready') return '#22C55E';
  if (tone === 'warn') return '#EAB308';
  if (tone === 'bad') return '#EF4444';
  return '#38BDF8';
}

function channelSubtitle(scope: BuklodPttScope | null) {
  if (!scope) return 'Church / Cluster Channel';
  const kind = String(scope.scope_type || '').toUpperCase();
  if (kind.includes('CHURCH') || kind.includes('ORG')) {
    return `${scope.name} · Church channel`;
  }
  if (kind.includes('CLUSTER')) {
    return `${scope.name} · Cluster channel`;
  }
  return `${scope.name} · Group channel`;
}

function LiveHoldButton({
  runtime,
  talkMode,
  enabled,
  onNeedConnect,
}: {
  runtime: BuklodPttRuntimeState;
  talkMode: BuklodPttKind;
  enabled: boolean;
  onNeedConnect: () => Promise<boolean>;
}) {
  const connection = runtime.connection;
  const [participants, setParticipants] = useState<any[]>(
    () => connection?.call?.state?.participants ?? [],
  );
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);

  useEffect(() => {
    if (!connection) {
      setParticipants([]);
      return;
    }

    setParticipants(connection.call.state.participants ?? []);
    const participantSub = connection.call.state.participants$.subscribe(
      (next: any[]) => setParticipants(next ?? []),
    );
    return () => participantSub.unsubscribe();
  }, [connection]);

  const remoteSpeaker = useMemo(
    () =>
      participants.find(
        (p: any) =>
          p.userId !== connection?.userId && Boolean(p.isSpeaking),
      ) as any,
    [participants, connection?.userId],
  );

  const blocked =
    Boolean(remoteSpeaker) && !runtime.transmitting && talkMode === 'NORMAL';
  const tx = runtime.transmitting;
  const speakerName =
    remoteSpeaker?.name || remoteSpeaker?.user?.name || 'Another member';

  const label = !enabled
    ? 'SETUP NEEDED'
    : tx
      ? 'TRANSMITTING...'
      : held || runtime.requestingFloor
        ? 'REQUESTING CHANNEL...'
        : blocked
          ? 'CHANNEL BUSY'
          : remoteSpeaker
            ? `RECEIVING — ${speakerName}`
            : 'HOLD TO TALK';

  const hint = !enabled
    ? 'Finish setup above, then hold to speak.'
    : blocked
      ? 'Wait for them to finish, or use Priority / SOS.'
      : remoteSpeaker && !tx
        ? 'Release stays listen mode. Hold when the channel is clear.'
        : 'Hold the button while speaking. Release when finished.';

  const down = async () => {
    if (!enabled || blocked) return;
    if (!runtime.connection) {
      const ok = await onNeedConnect();
      if (!ok || !heldRef.current) return;
    }
    try {
      await pttDown(talkMode);
    } catch (error: any) {
      if (!heldRef.current) return;
      Alert.alert(
        'BUKLOD PTT',
        error?.message || 'Could not start talking. Check your connection and try again.',
      );
    }
  };

  const up = async () => {
    heldRef.current = false;
    setHeld(false);
    await pttUp().catch(() => undefined);
  };

  return (
    <View style={styles.pttWrap}>
      <View
        onStartShouldSetResponder={() => enabled && !blocked}
        onMoveShouldSetResponder={() => enabled && !blocked}
        onResponderTerminationRequest={() => false}
        onResponderGrant={() => {
          heldRef.current = true;
          setHeld(true);
          void down();
        }}
        onResponderRelease={() => void up()}
        onResponderTerminate={() => void up()}
        style={[
          styles.ptt,
          tx && styles.pttTx,
          Boolean(remoteSpeaker) && !tx && styles.pttRx,
          blocked && styles.pttBusy,
          talkMode === 'SOS' && styles.pttSos,
          held && !blocked && styles.pttPressed,
          !enabled && styles.pttDisabled,
        ]}
      >
        <MaterialCommunityIcons
          name={
            blocked
              ? 'account-voice-off'
              : remoteSpeaker && !tx
                ? 'ear-hearing'
                : talkMode === 'SOS'
                  ? 'alarm-light'
                  : 'microphone'
          }
          size={46}
          color="#FFFFFF"
        />
      </View>
      <Text style={styles.pttLabel}>{label}</Text>
      <Text style={styles.pttHint}>{hint}</Text>
    </View>
  );
}

export default function BuklodPttScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const network = useNetwork();

  const [scopes, setScopes] = useState<BuklodPttScope[]>([]);
  const [scope, setScope] = useState<BuklodPttScope | null>(null);
  const [channel, setChannel] = useState(1);
  const [showChannels, setShowChannels] = useState(false);
  const [talkMode, setTalkMode] = useState<BuklodPttKind>('NORMAL');
  const [routeMode, setRouteMode] = useState<BuklodPttRouteMode>('AUTO');
  const [busy, setBusy] = useState(false);
  const [setupBusy, setSetupBusy] = useState<string | null>(null);
  const [showSetupDetails, setShowSetupDetails] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [nearbyPeers] = useState<NearbyPeer[]>([]);
  const [nearbySearching, setNearbySearching] = useState(false);
  const [setup, setSetup] = useState<BuklodPttSetupSnapshot | null>(null);
  const [runtime, setRuntime] = useState(getBuklodPttRuntimeState());
  const connectLock = useRef(false);

  const refreshSetup = useCallback(async () => {
    const next = await refreshBuklodPttSetup();
    setSetup(next);
    return next;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeBuklodPttRuntime(setRuntime);
    void bootstrapBuklodPttRuntime();

    void (async () => {
      const [savedMode, seen] = await Promise.all([
        loadBuklodPttRouteMode(),
        hasSeenBuklodPttOnboarding(),
        refreshSetup(),
      ]);
      setRouteMode(savedMode);
      if (!seen) setShowOnboarding(true);

      try {
        const rows = await loadBuklodPttScopes();
        setScopes(rows);
        const current = getBuklodPttRuntimeState().connection;
        if (current) {
          setScope(current.scope);
          setChannel(current.channel);
        } else {
          setScope(rows[0] ?? null);
        }
      } catch (error: any) {
        Alert.alert(
          'BUKLOD PTT',
          error?.message || 'Could not load your talk groups.',
        );
      }
    })();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshSetup();
    });

    return () => {
      unsubscribe();
      appSub.remove();
    };
  }, [refreshSetup]);

  useEffect(() => {
    setBuklodPttArmedKind(talkMode);
  }, [talkMode]);

  useEffect(() => {
    const current = runtime.connection;
    if (!current) return;
    setScope(current.scope);
    setChannel(current.channel);
  }, [runtime.connection]);

  const effectiveRoute = useMemo(
    () =>
      resolveBuklodPttRoute(
        routeMode,
        setup ?? {
          microphone: false,
          notifications: false,
          nearby: false,
          wifiOn: null,
          bluetoothOn: null,
          internet: network.online,
          wifiConnected: network.connectionType === 'wifi',
          connectionType: network.connectionType,
          items: [],
        },
        nearbyPeers.length,
      ),
    [routeMode, setup, network.online, network.connectionType, nearbyPeers.length],
  );

  const internetReady =
    Boolean(setup?.microphone) &&
    (setup?.internet ?? network.online) &&
    Boolean(scope);

  const needsSetupActions = useMemo(() => {
    if (!setup) return [];
    if (effectiveRoute === 'INTERNET') {
      return setup.items.filter(
        (item) =>
          !item.ok &&
          (item.key === 'microphone' ||
            item.key === 'notifications' ||
            (item.key === 'wifi' && !setup.internet)),
      );
    }
    return setup.items.filter((item) => !item.ok && Boolean(item.action));
  }, [setup, effectiveRoute]);

  const statusCard: StatusCard = useMemo(() => {
    if (!setup) {
      return {
        tone: 'info',
        title: 'Checking PTT setup…',
        detail: 'Please wait a moment.',
      };
    }

    if (!setup.microphone) {
      return {
        tone: 'bad',
        title: 'Microphone needed',
        detail: 'Allow microphone access so you can speak on PTT.',
      };
    }

    if (effectiveRoute === 'INTERNET') {
      if (!setup.internet) {
        return {
          tone: 'bad',
          title: 'No internet connection',
          detail: 'Turn on mobile data or Wi-Fi internet to use Internet PTT.',
        };
      }
      if (runtime.connection) {
        return {
          tone: 'ready',
          title: 'Internet PTT Ready',
          detail: `${runtime.connection.scope.name} · Channel ${runtime.connection.channel}`,
        };
      }
      if (busy) {
        return {
          tone: 'warn',
          title: 'Connecting…',
          detail: 'Joining your channel now.',
        };
      }
      return {
        tone: 'warn',
        title: 'Internet PTT available',
        detail: 'Ready to join your channel. Hold to talk will connect you.',
      };
    }

    // NEARBY path
    if (setup.wifiOn === false) {
      return {
        tone: 'bad',
        title: 'Wi-Fi is off',
        detail: 'Turn on Wi-Fi for Offline Nearby PTT.',
      };
    }
    if (!setup.nearby) {
      return {
        tone: 'bad',
        title: 'Nearby devices permission needed',
        detail: 'Allow nearby devices so BUKLOD can find members around you.',
      };
    }
    if (nearbySearching) {
      return {
        tone: 'warn',
        title: 'Searching for nearby users…',
        detail: 'Keep Wi-Fi and Bluetooth on while we look around you.',
      };
    }
    if (nearbyPeers.length > 0) {
      return {
        tone: 'ready',
        title: 'Nearby PTT Ready',
        detail: `${nearbyPeers.length} nearby BUKLOD users found`,
      };
    }
    return {
      tone: 'warn',
      title: 'No nearby users found',
      detail: 'You can switch to Internet PTT to talk over data or Wi-Fi internet.',
    };
  }, [
    setup,
    effectiveRoute,
    runtime.connection,
    busy,
    nearbySearching,
    nearbyPeers.length,
  ]);

  const chooseRoute = async (next: BuklodPttRouteMode) => {
    setRouteMode(next);
    await saveBuklodPttRouteMode(next);
    if (next === 'NEARBY' || (next === 'AUTO' && !network.online)) {
      setNearbySearching(true);
      setTimeout(() => setNearbySearching(false), 2200);
    }
  };

  const connectInternet = useCallback(async () => {
    if (!scope || connectLock.current) return false;
    const latest = setup ?? (await refreshSetup());
    if (!latest.microphone) {
      Alert.alert('Microphone needed', 'Allow microphone access first.');
      return false;
    }
    if (!latest.internet && !network.online) {
      Alert.alert(
        'No internet connection',
        'Turn on mobile data or Wi-Fi internet, then try again.',
      );
      return false;
    }

    connectLock.current = true;
    setBusy(true);
    try {
      await connectBuklodPttRuntime(scope, channel);
      return true;
    } catch (error: any) {
      Alert.alert(
        'Could not connect',
        error?.message ||
          'Check your internet connection and try again. Stay on Auto or Internet mode.',
      );
      return false;
    } finally {
      setBusy(false);
      connectLock.current = false;
    }
  }, [scope, channel, setup, refreshSetup, network.online]);

  // Auto-join Internet when ready so the user only holds to talk.
  useEffect(() => {
    if (effectiveRoute !== 'INTERNET') return;
    if (!internetReady) return;
    if (runtime.connection || busy || connectLock.current) return;
    void connectInternet();
  }, [
    effectiveRoute,
    internetReady,
    runtime.connection,
    busy,
    connectInternet,
  ]);

  const chooseTarget = async (
    nextScope: BuklodPttScope,
    nextChannel: number,
  ) => {
    if (busy) return;
    const live = runtime.connection;
    setScope(nextScope);
    setChannel(nextChannel);
    setShowChannels(false);

    if (!live) return;
    if (live.scope.id === nextScope.id && live.channel === nextChannel) return;

    setBusy(true);
    try {
      await selectBuklodPttTarget(nextScope, nextChannel);
    } catch (error: any) {
      setScope(live.scope);
      setChannel(live.channel);
      Alert.alert(
        'BUKLOD PTT',
        error?.message || 'Could not change channel. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await disconnectBuklodPttRuntime();
      setTalkMode('NORMAL');
    } finally {
      setBusy(false);
    }
  };

  const runSetupAction = async (key: string, action: (() => Promise<void>) | null) => {
    if (!action) return;
    setSetupBusy(key);
    try {
      await action();
      await refreshSetup();
    } finally {
      setSetupBusy(null);
    }
  };

  const armSos = () => {
    Alert.alert(
      'Use SOS talk?',
      'SOS is for urgent alerts. It can interrupt the channel for authorized members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use SOS',
          style: 'destructive',
          onPress: () => setTalkMode('SOS'),
        },
      ],
    );
  };

  const holdEnabled =
    effectiveRoute === 'INTERNET'
      ? Boolean(setup?.microphone) && (setup?.internet ?? network.online) && Boolean(scope)
      : nearbyPeers.length > 0 && Boolean(setup?.microphone);

  const showNearbyFallback =
    effectiveRoute === 'NEARBY' &&
    !nearbySearching &&
    nearbyPeers.length === 0 &&
    Boolean(setup);

  return (
    <View style={{ flex: 1, backgroundColor: '#030A10' }}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>BUKLOD PTT</Text>
            <Text style={styles.subbrand}>Hold to talk with your group</Text>
          </View>
          <Pressable
            onPress={() => {
              setShowSetupDetails((v) => !v);
              void refreshSetup();
            }}
            style={styles.setupChip}
            accessibilityLabel="Check PTT setup"
          >
            <MaterialCommunityIcons name="shield-check-outline" size={16} color="#56DCE5" />
            <Text style={styles.setupChipText}>Setup</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* 1. Status */}
          <View style={[styles.statusCard, { borderColor: toneColor(statusCard.tone) + '66' }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: toneColor(statusCard.tone) }]} />
              <Text style={styles.statusTitle}>{statusCard.title}</Text>
              {busy ? <ActivityIndicator color="#56DCE5" style={{ marginLeft: 'auto' }} /> : null}
            </View>
            <Text style={styles.statusDetail}>{statusCard.detail}</Text>
          </View>

          {/* Setup action buttons */}
          {needsSetupActions.length > 0 || effectiveRoute === 'NEARBY' ? (
            <View style={styles.setupActions}>
              {needsSetupActions.slice(0, 4).map((item) =>
                item.actionLabel && item.action ? (
                  <Pressable
                    key={item.key}
                    disabled={setupBusy === item.key}
                    onPress={() => void runSetupAction(item.key, item.action)}
                    style={styles.setupBtn}
                  >
                    <Text style={styles.setupBtnText}>
                      {setupBusy === item.key ? 'OPENING…' : item.actionLabel}
                    </Text>
                  </Pressable>
                ) : null,
              )}
              {effectiveRoute === 'NEARBY' ? (
                <>
                  <Pressable
                    onPress={() => void runSetupAction('wifi-open', openWifiSettings)}
                    style={styles.setupBtnSecondary}
                  >
                    <Text style={styles.setupBtnSecondaryText}>TURN ON WI-FI</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void runSetupAction('bt-open', openBluetoothSettings)}
                    style={styles.setupBtnSecondary}
                  >
                    <Text style={styles.setupBtnSecondaryText}>TURN ON BLUETOOTH</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          {showSetupDetails && setup ? (
            <View style={styles.setupList}>
              <Text style={styles.sectionLabel}>PTT SETUP CHECK</Text>
              {setup.items.map((item) => (
                <View key={item.key} style={styles.setupItem}>
                  <Text style={styles.setupItemLabel}>
                    {item.ok ? '✅' : '⬜'} {item.label}
                  </Text>
                  {item.actionLabel && item.action ? (
                    <Pressable onPress={() => void runSetupAction(item.key, item.action)}>
                      <Text style={styles.setupItemAction}>{item.actionLabel}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* 2. Mode */}
          <Text style={styles.sectionLabel}>CONNECTION MODE</Text>
          <View style={styles.modeRow}>
            {(
              [
                ['AUTO', 'AUTO'],
                ['INTERNET', 'INTERNET'],
                ['NEARBY', 'OFFLINE NEARBY'],
              ] as const
            ).map(([value, label]) => {
              const on = routeMode === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => void chooseRoute(value)}
                  style={[styles.modeChip, on && styles.modeChipOn]}
                >
                  <Text style={[styles.modeChipText, on && styles.modeChipTextOn]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.autoExplain}>
            AUTO chooses the best available connection: Nearby when possible,
            Internet when needed.
          </Text>

          {/* 3. Channel */}
          <Text style={styles.sectionLabel}>CHANNEL</Text>
          <View style={styles.channelCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>CHANNEL {channel}</Text>
              <Text style={styles.channelSub}>{channelSubtitle(scope)}</Text>
            </View>
            <Pressable
              onPress={() => setShowChannels((v) => !v)}
              style={styles.changeChannelBtn}
            >
              <Text style={styles.changeChannelText}>
                {showChannels ? 'HIDE' : 'CHANGE CHANNEL'}
              </Text>
            </Pressable>
          </View>

          {showChannels ? (
            <View style={styles.channelGrid}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((ch) => (
                <Pressable
                  key={ch}
                  disabled={busy || !scope}
                  onPress={() => scope && void chooseTarget(scope, ch)}
                  style={[styles.channelCell, channel === ch && styles.channelCellOn]}
                >
                  <Text
                    style={[
                      styles.channelCellText,
                      channel === ch && styles.channelCellTextOn,
                    ]}
                  >
                    {ch}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {scopes.length > 1 ? (
            <>
              <Text style={styles.sectionLabel}>TALK GROUP</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.scopeRow}>
                  {scopes.map((item) => {
                    const selected = item.id === scope?.id;
                    return (
                      <Pressable
                        key={item.id}
                        disabled={busy}
                        onPress={() => void chooseTarget(item, channel)}
                        style={[styles.scopeChip, selected && styles.scopeChipOn]}
                      >
                        <Text style={[styles.scopeName, selected && styles.scopeTextOn]}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          ) : null}

          {/* Nearby indicator */}
          {effectiveRoute === 'NEARBY' ? (
            <View style={styles.nearbyCard}>
              <Text style={styles.nearbyTitle}>
                {nearbySearching
                  ? 'Searching for nearby BUKLOD users…'
                  : `${nearbyPeers.length} nearby BUKLOD users found`}
              </Text>
              {nearbyPeers.map((peer) => (
                <Text key={peer.id} style={styles.nearbyPeer}>
                  · {peer.name} — {peer.signal}
                </Text>
              ))}
              {!nearbySearching && nearbyPeers.length === 0 ? (
                <Text style={styles.nearbyPeer}>
                  No one nearby right now. Keep Wi-Fi and Bluetooth on, or use Internet.
                </Text>
              ) : null}
            </View>
          ) : null}

          {showNearbyFallback ? (
            <View style={styles.fallbackCard}>
              <Text style={styles.fallbackText}>
                No nearby users found. Switch to Internet PTT?
              </Text>
              <Pressable
                onPress={() => void chooseRoute('INTERNET')}
                style={styles.fallbackBtn}
              >
                <Text style={styles.fallbackBtnText}>USE INTERNET</Text>
              </Pressable>
            </View>
          ) : null}

          {/* 4. Big PTT */}
          <View style={styles.talkCard}>
            <LiveHoldButton
              runtime={runtime}
              talkMode={talkMode}
              enabled={holdEnabled}
              onNeedConnect={connectInternet}
            />

            <Text style={styles.sectionLabel}>TALK PRIORITY</Text>
            <View style={styles.talkModeRow}>
              <Pressable
                onPress={() => setTalkMode('NORMAL')}
                style={[styles.talkMode, talkMode === 'NORMAL' && styles.talkModeOn]}
              >
                <Text style={[styles.talkModeText, talkMode === 'NORMAL' && styles.talkModeTextOn]}>
                  Normal
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTalkMode('PRIORITY')}
                style={[styles.talkMode, talkMode === 'PRIORITY' && styles.talkModePriority]}
              >
                <Text style={[styles.talkModeText, talkMode === 'PRIORITY' && styles.talkModeTextOn]}>
                  Priority
                </Text>
              </Pressable>
              <Pressable
                onPress={armSos}
                style={[styles.talkMode, talkMode === 'SOS' && styles.talkModeSos]}
              >
                <Text style={[styles.talkModeText, talkMode === 'SOS' && styles.talkModeTextOn]}>
                  SOS
                </Text>
              </Pressable>
            </View>

            {runtime.connection ? (
              <Pressable onPress={() => void disconnect()} style={styles.stopBtn}>
                <Text style={styles.stopBtnText}>Stop listening</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <View
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8E4',
          paddingBottom: insets.bottom,
        }}
      >
        <BuklodAdMobBanner
          placement="content"
          placementId="ptt_banner"
          format="adaptive"
          requireViewport={false}
          showLabel
        />
      </View>

      <Modal visible={showOnboarding} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>How BUKLOD PTT works</Text>
            <Text style={styles.modalStep}>1. Choose or stay on Auto</Text>
            <Text style={styles.modalStep}>2. Select a channel</Text>
            <Text style={styles.modalStep}>3. Hold PTT to speak</Text>
            <Text style={styles.modalStep}>4. Release to listen</Text>
            <Text style={styles.modalNote}>
              Offline Nearby needs Wi-Fi/Bluetooth. Internet PTT needs data or Wi-Fi
              internet.
            </Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => {
                setShowOnboarding(false);
                void markBuklodPttOnboardingSeen();
              }}
            >
              <Text style={styles.modalBtnText}>GOT IT</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030A10' },
  topbar: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#17303C',
    backgroundColor: '#07131D',
  },
  back: { padding: 8 },
  brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  subbrand: { color: '#78909C', fontSize: 11, marginTop: 1 },
  setupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#24505A',
    backgroundColor: '#0A1C26',
  },
  setupChipText: { color: '#56DCE5', fontSize: 11, fontWeight: '900' },
  content: { padding: 14, paddingBottom: 36, gap: 4 },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#071A27',
    padding: 14,
    marginBottom: 8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', flexShrink: 1 },
  statusDetail: { color: '#9BB0B8', fontSize: 12, lineHeight: 17, marginTop: 6 },
  setupActions: { gap: 8, marginBottom: 8 },
  setupBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#55E0E8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  setupBtnText: { color: '#071725', fontWeight: '900', letterSpacing: 0.4 },
  setupBtnSecondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#55E0E8',
    backgroundColor: '#0A2630',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  setupBtnSecondaryText: { color: '#55E0E8', fontWeight: '900', letterSpacing: 0.4 },
  setupList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1B4555',
    backgroundColor: '#091722',
    padding: 12,
    marginBottom: 8,
  },
  setupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  setupItemLabel: { color: '#D9E5E9', fontSize: 13, fontWeight: '700' },
  setupItemAction: { color: '#56DCE5', fontSize: 11, fontWeight: '900' },
  sectionLabel: {
    color: '#708893',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 12,
    marginBottom: 8,
  },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#29404B',
    backgroundColor: '#091722',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  modeChipOn: { borderColor: '#55E0E8', backgroundColor: '#0A3440' },
  modeChipText: {
    color: '#8FA3AC',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  modeChipTextOn: { color: '#FFFFFF' },
  autoExplain: {
    color: '#7D939C',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
  },
  channelCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1B4555',
    backgroundColor: '#071A27',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  channelTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  channelSub: { color: '#8CA2AB', fontSize: 12, marginTop: 3 },
  changeChannelBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#55E0E8',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  changeChannelText: { color: '#55E0E8', fontSize: 10, fontWeight: '900' },
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  channelCell: {
    width: '17%',
    minWidth: 54,
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#203743',
    backgroundColor: '#0A1822',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelCellOn: { backgroundColor: '#0B4B58', borderColor: '#55E0E8' },
  channelCellText: { color: '#91A7B0', fontSize: 14, fontWeight: '900' },
  channelCellTextOn: { color: '#FFFFFF' },
  scopeRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  scopeChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#23414E',
    backgroundColor: '#091722',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scopeChipOn: { borderColor: '#50D8E2', backgroundColor: '#0A2630' },
  scopeName: { color: '#D9E5E9', fontSize: 12, fontWeight: '800' },
  scopeTextOn: { color: '#FFFFFF' },
  nearbyCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#23414E',
    backgroundColor: '#091722',
    padding: 12,
  },
  nearbyTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  nearbyPeer: { color: '#9BB0B8', fontSize: 12, marginTop: 6 },
  fallbackCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAB30866',
    backgroundColor: '#2A2208',
    padding: 12,
    gap: 10,
  },
  fallbackText: { color: '#F6E7A5', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  fallbackBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#55E0E8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fallbackBtnText: { color: '#071725', fontWeight: '900' },
  talkCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#254552',
    backgroundColor: '#07131D',
    padding: 14,
  },
  pttWrap: { alignItems: 'center', marginTop: 4, marginBottom: 8 },
  ptt: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: '#0A5C6A',
    borderWidth: 10,
    borderColor: '#133541',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttPressed: { transform: [{ scale: 0.97 }] },
  pttTx: { backgroundColor: '#B83228', borderColor: '#F06B5E' },
  pttRx: { backgroundColor: '#0B4B58', borderColor: '#55E0E8' },
  pttBusy: { backgroundColor: '#543338', borderColor: '#8A5158' },
  pttSos: { borderColor: '#FF6B57' },
  pttDisabled: { opacity: 0.45 },
  pttLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  pttHint: {
    color: '#B8C6CC',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  talkModeRow: { flexDirection: 'row', gap: 8 },
  talkMode: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#29404B',
    backgroundColor: '#091722',
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkModeOn: { borderColor: '#55E0E8', backgroundColor: '#0A3440' },
  talkModePriority: { borderColor: '#F1B953', backgroundColor: '#4C3812' },
  talkModeSos: { borderColor: '#FF6B57', backgroundColor: '#55201B' },
  talkModeText: { color: '#8FA3AC', fontSize: 11, fontWeight: '900' },
  talkModeTextOn: { color: '#FFFFFF' },
  stopBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  stopBtnText: { color: '#FF8073', fontWeight: '900' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    backgroundColor: '#0B1822',
    borderWidth: 1,
    borderColor: '#24505A',
    padding: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },
  modalStep: { color: '#D9E5E9', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  modalNote: {
    color: '#8CA2AB',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 16,
  },
  modalBtn: {
    backgroundColor: '#55E0E8',
    borderRadius: 12,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { color: '#071725', fontWeight: '900' },
});
