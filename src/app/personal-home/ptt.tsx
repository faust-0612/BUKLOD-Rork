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
import BuklodPttConversation from '@/components/BuklodPttConversation';
import { useNetwork } from '@/providers/NetworkProvider';
import {
  loadBuklodPttScopes,
  supabase,
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
  loadBuklodPttUserSettings,
  markBuklodPttOnboardingSeen,
  openBluetoothSettings,
  openWifiSettings,
  refreshBuklodPttSetup,
  resolveBuklodPttRoute,
  saveBuklodPttUserSettings,
  type BuklodPttUserSettings,
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
  targetMatched,
  disabledLabel,
  onNeedConnect,
}: {
  runtime: BuklodPttRuntimeState;
  talkMode: BuklodPttKind;
  enabled: boolean;
  targetMatched: boolean;
  disabledLabel: string;
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
    ? disabledLabel
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
    ? 'Select Start listening or finish the requirements above.'
    : blocked
      ? 'Wait for them to finish, or use Priority / SOS.'
      : remoteSpeaker && !tx
        ? 'Release stays listen mode. Hold when the channel is clear.'
        : 'Hold the button while speaking. Release when finished.';

  const down = async () => {
    if (!enabled || blocked) return;
    if (!runtime.connection || !targetMatched) {
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
  const [userId, setUserId] = useState('');
  const [preferences, setPreferences] = useState<BuklodPttUserSettings | null>(null);
  const [saving, setSaving] = useState(false);
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
  const nearbySearching = false;
  const [setup, setSetup] = useState<BuklodPttSetupSnapshot | null>(null);
  const [runtime, setRuntime] = useState(getBuklodPttRuntimeState());
  const [chatOpen, setChatOpen] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const chatOffsetRef = useRef(0);
  const connectLock = useRef(false);
  const connectPromiseRef = useRef<Promise<boolean> | null>(null);
  const autoJoinKeyRef = useRef('');
  const targetMatched = Boolean(runtime.connection && scope &&
    runtime.connection.scope.id === scope.id && runtime.connection.channel === channel);
  const persistPreferences = useCallback(async (next: BuklodPttUserSettings) => {
    if (!userId) throw new Error('PTT settings are not loaded.');
    setSaving(true);
    try {
      await saveBuklodPttUserSettings(userId, next);
      setPreferences(next);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const refreshSetup = useCallback(async () => {
    const next = await refreshBuklodPttSetup();
    setSetup(next);
    return next;
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeBuklodPttRuntime(setRuntime);
    void bootstrapBuklodPttRuntime().catch(() => undefined);
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) throw new Error('Sign in to restore PTT settings.');
        const [saved, rows, seen] = await Promise.all([
          loadBuklodPttUserSettings(session.user.id),
          loadBuklodPttScopes(),
          hasSeenBuklodPttOnboarding(),
          refreshSetup(),
        ]);
        if (!mounted) return;
        const live = getBuklodPttRuntimeState();
        const selected = rows.find(s => s.id === saved.scopeId) ||
          (!live.priorityReceiving ? rows.find(s => s.id === live.connection?.scope.id) : null) ||
          rows[0] || null;
        setUserId(session.user.id);
        setScopes(rows);
        setScope(selected);
        setChannel(selected?.id === saved.scopeId ? saved.channel : (live.connection?.channel || 1));
        setRouteMode(saved.routeMode);
        setTalkMode(saved.talkMode);
        setPreferences({ ...saved, scopeId: selected?.id ?? '',
          channel: selected?.id === saved.scopeId ? saved.channel : (live.connection?.channel || 1) });
        if (!seen) setShowOnboarding(true);
      } catch (error: any) {
        if (mounted) Alert.alert('BUKLOD PTT', error?.message || 'Could not restore PTT settings.');
      }
    })();
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshSetup();
    });
    return () => {
      mounted = false;
      setBuklodPttArmedKind('NORMAL'); // emergency is never left armed on navigation.
      unsubscribe();
      appSub.remove();
    };
  }, [refreshSetup]);

  useEffect(() => {
    setBuklodPttArmedKind(talkMode);
  }, [talkMode]);

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
    Boolean(preferences?.listening) &&
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
    if (!setup || !preferences) {
      return {
        tone: 'info',
        title: 'Restoring PTT settings…',
        detail: 'Please wait a moment.',
      };
    }

    if (!preferences.listening && !runtime.priorityReceiving) {
      return { tone: 'info', title: 'PTT listening paused', detail: 'Your selected channel is saved. Tap Start listening to resume.' };
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
      if (targetMatched) {
        return {
          tone: 'ready',
          title: 'Internet PTT connected',
          detail: `${runtime.connection!.scope.name} · Channel ${runtime.connection!.channel} · Listening`,
        };
      }
      if (runtime.connection) {
        return {
          tone: 'warn',
          title: 'Different channel connected',
          detail: `Active: ${runtime.connection.scope.name} CH${runtime.connection.channel}. Saved: ${scope?.name || 'No group'} CH${channel}.`,
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

    // A Nearby preference is not proof of a working device-to-device call.
    return {
      tone: 'warn',
      title: 'Offline Nearby unavailable',
      detail: 'Saved as a preference only. This build has no verified nearby voice transport. Choose Internet or Auto.',
    };
  }, [
    setup, preferences, effectiveRoute, runtime.connection, targetMatched,
    scope, channel, busy,
  ]);

  const chooseRoute = async (next: BuklodPttRouteMode) => {
    if (!preferences || saving || next === routeMode) return;
    if (next === 'NEARBY') {
      Alert.alert('Offline Nearby unavailable', 'Nearby device-to-device PTT is not working in this build. Choose Auto or Internet.');
      return;
    }
    try {
      await persistPreferences({ ...preferences, routeMode: next });
      setRouteMode(next);
    } catch (error: any) {
      Alert.alert('Mode not saved', error?.message || 'Previous selection remains.');
    }
  };

  const connectInternet = useCallback((): Promise<boolean> => {
    // Auto-join can already be running when the member presses PTT.
    // Reuse that promise so a held button starts talking once join succeeds.
    if (connectPromiseRef.current) return connectPromiseRef.current;
    if (!scope || !preferences?.listening) return Promise.resolve(false);

    const attempt = (async () => {
      try {
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
        await bootstrapBuklodPttRuntime();
        if (getBuklodPttRuntimeState().priorityReceiving) return false;
        const current = getBuklodPttRuntimeState().connection;
        if (current?.scope.id !== scope.id || current?.channel !== channel) {
          await connectBuklodPttRuntime(scope, channel);
        }
        const applied = getBuklodPttRuntimeState().connection;
        return applied?.scope.id === scope.id && applied?.channel === channel;
      } catch (error: any) {
        Alert.alert(
          'Could not connect',
          error?.message ||
            'Check your internet connection and try again. Stay on Auto or Internet mode.',
        );
        return false;
      } finally {
        connectLock.current = false;
        setBusy(false);
      }
    })();

    connectPromiseRef.current = attempt;
    void attempt.then(
      () => {
        if (connectPromiseRef.current === attempt) connectPromiseRef.current = null;
      },
      () => {
        if (connectPromiseRef.current === attempt) connectPromiseRef.current = null;
      },
    );
    return attempt;
  }, [scope, channel, preferences?.listening, setup, refreshSetup, network.online]);

  // Explicit Stop persists, including across app restarts. Automatic joins are
  // attempted once per saved target, not retried endlessly on each render.
  useEffect(() => {
    if (!preferences?.listening) {
      autoJoinKeyRef.current = '';
      return;
    }
    if (effectiveRoute !== 'INTERNET' || !internetReady || !scope) return;
    if (targetMatched || runtime.priorityReceiving || busy || connectLock.current) return;
    const key = `${scope.id}:${channel}:${routeMode}`;
    if (autoJoinKeyRef.current === key) return;
    autoJoinKeyRef.current = key;
    void connectInternet();
  }, [preferences?.listening, effectiveRoute, internetReady, scope, channel, routeMode,
    targetMatched, runtime.priorityReceiving, busy, connectInternet]);

  const chooseTarget = async (nextScope: BuklodPttScope, nextChannel: number) => {
    if (!preferences || busy || saving) return;
    if (runtime.priorityReceiving) {
      Alert.alert('Incoming priority PTT', 'Wait until the priority or SOS call ends before switching channels.');
      return;
    }
    if (scope?.id === nextScope.id && channel === nextChannel) {
      setShowChannels(false);
      return;
    }
    const next = { ...preferences, scopeId: nextScope.id, channel: nextChannel };
    setShowChannels(false);
    if (runtime.connection) {
      setBusy(true);
      try {
        await selectBuklodPttTarget(nextScope, nextChannel);
        const applied = getBuklodPttRuntimeState().connection;
        if (applied?.scope.id !== nextScope.id || applied?.channel !== nextChannel) {
          throw new Error('New channel was not connected.');
        }
        try {
          await persistPreferences(next);
        } catch (error: any) {
          // Runtime switched successfully, so reflect it, but never say Saved.
          setPreferences(next);
          throw new Error('Now connected, but the channel was NOT saved for next time: ' +
            (error?.message || 'storage failure'));
        }
        setScope(nextScope);
        setChannel(nextChannel);
      } catch (error: any) {
        Alert.alert('PTT channel change', error?.message || 'The selected channel was not applied.');
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      await persistPreferences(next);
      setScope(nextScope);
      setChannel(nextChannel);
    } catch (error: any) {
      Alert.alert('Channel not saved', error?.message || 'Previous choice remains.');
    }
  };

  const disconnect = async () => {
    if (!preferences || busy || saving) return;
    try {
      await persistPreferences({ ...preferences, listening: false });
      setBusy(true);
      await disconnectBuklodPttRuntime();
      if (talkMode === 'SOS') setTalkMode(preferences.talkMode);
    } catch (error: any) {
      Alert.alert('PTT stop failed', error?.message || 'Please retry.');
    } finally {
      setBusy(false);
    }
  };

  const startListening = async () => {
    if (!preferences || busy || saving) return;
    try {
      await persistPreferences({ ...preferences, listening: true });
    } catch (error: any) {
      Alert.alert('PTT start failed', error?.message || 'Your setting was not saved.');
    }
  };

  const chooseTalkMode = async (next: 'NORMAL' | 'PRIORITY') => {
    if (!preferences || busy || saving) return;
    try {
      await persistPreferences({ ...preferences, talkMode: next });
      setTalkMode(next);
    } catch (error: any) {
      Alert.alert('Talk mode not saved', error?.message || 'Previous mode remains.');
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
    Boolean(preferences?.listening) &&
    effectiveRoute === 'INTERNET' &&
    Boolean(setup?.microphone) &&
    (setup?.internet ?? network.online) &&
    Boolean(scope);

  const showNearbyFallback = effectiveRoute === 'NEARBY' && Boolean(setup);

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
            onPress={() => setChatOpen((open) => !open)}
            style={styles.setupChip}
            accessibilityLabel={chatOpen ? "Close PTT conversation" : "Open PTT conversation"}
          >
            <MaterialCommunityIcons name="message-text-outline" size={18} color="#56DCE5" />
            <Text style={styles.setupChipText}>{chatOpen ? 'Hide chat' : 'Chat'}</Text>
          </Pressable>
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
          ref={chatScrollRef}
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
          <Text style={styles.sectionLabel}>CONNECTION MODE · SAVED PREFERENCE</Text>
          <View style={styles.modeRow}>
            {(
              [
                ['AUTO', 'AUTO'],
                ['INTERNET', 'INTERNET'],
                ['NEARBY', 'OFFLINE NEARBY'],
              ] as const
            ).map(([value, label]) => {
              const on = Boolean(preferences) && routeMode === value;
              return (
                <Pressable
                  key={value}
                  disabled={!preferences || saving}
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
            This is your saved preference, not a live connection. Only the green
            Connected status confirms an active channel. Auto uses Internet; Offline
            Nearby is not yet functional in this build.
          </Text>

          {/* 3. Channel */}
          <Text style={styles.sectionLabel}>CHANNEL</Text>
          <View style={styles.channelCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>CHANNEL {channel} · {targetMatched ? 'LIVE' : 'SAVED / NOT CONNECTED'}</Text>
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
                  disabled={busy || saving || !scope}
                  onPress={() => scope && void chooseTarget(scope, ch)}
                  style={[styles.channelCell, targetMatched && channel === ch && styles.channelCellOn]}
                >
                  <Text
                    style={[
                      styles.channelCellText,
                      targetMatched && channel === ch && styles.channelCellTextOn,
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
                    const selected = targetMatched && item.id === scope?.id;
                    return (
                      <Pressable
                        key={item.id}
                        disabled={busy || saving}
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
                  : 'Offline Nearby transport is unavailable in this build'}
              </Text>
              {nearbyPeers.map((peer) => (
                <Text key={peer.id} style={styles.nearbyPeer}>
                  · {peer.name} — {peer.signal}
                </Text>
              ))}
              {!nearbySearching && nearbyPeers.length === 0 ? (
                <Text style={styles.nearbyPeer}>
                  A saved Offline Nearby preference does not mean a voice connection.
                </Text>
              ) : null}
            </View>
          ) : null}

          {showNearbyFallback ? (
            <View style={styles.fallbackCard}>
              <Text style={styles.fallbackText}>
                Offline Nearby is not connected. Use Internet instead.
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
              targetMatched={targetMatched}
              disabledLabel={!preferences?.listening ? 'START LISTENING' : effectiveRoute === 'NEARBY' ? 'NEARBY UNAVAILABLE' : 'SETUP NEEDED'}
              onNeedConnect={connectInternet}
            />

            <Text style={styles.sectionLabel}>TALK PRIORITY</Text>
            <View style={styles.talkModeRow}>
              <Pressable
                disabled={!preferences || saving}
                onPress={() => void chooseTalkMode('NORMAL')}
                style={[styles.talkMode, talkMode === 'NORMAL' && styles.talkModeOn]}
              >
                <Text style={[styles.talkModeText, talkMode === 'NORMAL' && styles.talkModeTextOn]}>
                  Normal
                </Text>
              </Pressable>
              <Pressable
                disabled={!preferences || saving}
                onPress={() => void chooseTalkMode('PRIORITY')}
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

            {preferences ? (
              <Pressable
                disabled={busy || saving}
                onPress={() => void (preferences.listening ? disconnect() : startListening())}
                style={styles.stopBtn}
              >
                <Text style={styles.stopBtnText}>
                  {preferences.listening ? 'Stop listening' : 'Start listening'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {scope && chatOpen ? (
            <View onLayout={e => {
              chatOffsetRef.current = e.nativeEvent.layout.y;
              // No history load, Realtime socket or nested scroll until Chat opens.
              chatScrollRef.current?.scrollTo({ y: chatOffsetRef.current, animated: true });
            }}>
            <BuklodPttConversation
              scopeId={scope.id}
              channel={channel}
              connection={runtime.connection}
            />
            </View>
          ) : null}
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
              PTT remembers your last channel, listening switch and ordinary talk mode.
              Offline Nearby direct-device voice is not active in this build.
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
