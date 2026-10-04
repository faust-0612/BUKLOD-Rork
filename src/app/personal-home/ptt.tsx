import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  loadBuklodPttScopes,
  type BuklodPttKind,
  type BuklodPttScope,
} from '@/ptt/buklodPttCore';
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
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import { setBuklodPttArmedKind } from '@/ptt/buklodPttDutyNotification';

function LivePtt({
  runtime,
  mode,
}: {
  runtime: BuklodPttRuntimeState;
  mode: BuklodPttKind;
}) {
  const connection = runtime.connection!;
  const [participants, setParticipants] = useState<any[]>(
    () => connection.call.state.participants ?? [],
  );
  const [callingState, setCallingState] = useState(
    () => String(connection.call.state.callingState ?? 'STANDBY'),
  );

  useEffect(() => {
    setParticipants(connection.call.state.participants ?? []);
    setCallingState(String(connection.call.state.callingState ?? 'STANDBY'));

    const participantSub = connection.call.state.participants$.subscribe(
      (next: any[]) => setParticipants(next ?? []),
    );
    const stateSub = connection.call.state.callingState$.subscribe(
      (next: any) => setCallingState(String(next ?? 'STANDBY')),
    );

    return () => {
      participantSub.unsubscribe();
      stateSub.unsubscribe();
    };
  }, [connection]);

  const remoteSpeaker = useMemo(
    () =>
      participants.find(
        (p: any) =>
          p.userId !== connection.userId &&
          Boolean(p.isSpeaking),
      ) as any,
    [participants, connection.userId],
  );

  const blocked = Boolean(remoteSpeaker) && !runtime.transmitting && mode === 'NORMAL';
  const tx = runtime.transmitting;
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);

  const down = async () => {
    if (blocked) {
      Alert.alert(
        'CHANNEL BUSY',
        `${remoteSpeaker?.name || remoteSpeaker?.user?.name || 'Another member'} is talking. Switch to Priority or SOS if you need to talk over them.`,
      );
      return;
    }

    try {
      await pttDown(mode);
    } catch (error: any) {
      if (!heldRef.current) return;
      Alert.alert('BUKLOD PTT', error?.message || 'Could not transmit.');
    }
  };

  const up = async () => {
    heldRef.current = false;
    setHeld(false);
    await pttUp().catch(() => undefined);
  };

  const grab = () => {
    heldRef.current = true;
    setHeld(true);
    void down();
  };

  const floorState = callingState.toUpperCase();
  const status = tx
    ? runtime.txKind === 'SOS'
      ? 'SOS TX'
      : runtime.txKind === 'PRIORITY'
        ? 'PRIORITY TX'
        : 'TX'
    : remoteSpeaker
      ? runtime.priorityReceiving
        ? 'PRIORITY RX'
        : 'RX'
      : floorState === 'JOINED' || floorState === 'RECONNECTING'
        ? 'LISTENING'
        : floorState;

  return (
    <View style={s.livePanel}>
      <View style={s.statusRow}>
        <View style={[s.lamp, tx ? s.txLamp : remoteSpeaker ? s.rxLamp : null]} />
        <Text style={s.status}>{status}</Text>
        <Text style={s.people}>{participants.length} online</Text>
      </View>

      <Text style={s.talkingName} numberOfLines={1}>
        {tx
          ? 'YOU'
          : remoteSpeaker?.name ||
            remoteSpeaker?.user?.name ||
            'Channel clear'}
      </Text>

      <View style={s.pttWrap}>
        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={grab}
          onResponderRelease={() => void up()}
          onResponderTerminate={() => void up()}
          style={[
            s.ptt,
            tx && s.pttTx,
            blocked && s.pttBusy,
            mode === 'SOS' && s.pttSosArmed,
            held && !blocked && s.pttPressed,
          ]}
        >
          <MaterialCommunityIcons
            name={blocked ? 'radio-off' : mode === 'SOS' ? 'alarm-light' : 'microphone'}
            size={42}
            color="#FFFFFF"
          />
        </View>
        <Text style={s.pttText} numberOfLines={1}>
          {blocked
            ? 'CHANNEL BUSY'
            : tx
              ? 'TRANSMITTING'
              : held
                ? 'CONNECTING'
                : mode === 'NORMAL'
                  ? 'HOLD TO TALK'
                  : `HOLD FOR ${mode}`}
        </Text>
        <Text style={s.pttHint}>
          {blocked ? 'Use Priority or SOS' : 'Release to listen'}
        </Text>
      </View>
    </View>
  );
}

export default function BuklodPttScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scopes, setScopes] = useState<BuklodPttScope[]>([]);
  const [scope, setScope] = useState<BuklodPttScope | null>(null);
  const [channel, setChannel] = useState(1);
  const [mode, setMode] = useState<BuklodPttKind>('NORMAL');
  const [busy, setBusy] = useState(false);
  const [runtime, setRuntime] = useState(getBuklodPttRuntimeState());

  useEffect(() => {
    const unsubscribe = subscribeBuklodPttRuntime(setRuntime);

    void bootstrapBuklodPttRuntime();

    void (async () => {
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
          error?.message || 'Could not load your authorized BUKLOD scopes.',
        );
      }
    })();

    return unsubscribe;
  }, []);

  const connect = async () => {
    if (!scope || busy) return;

    setBusy(true);
    try {
      await connectBuklodPttRuntime(scope, channel);
    } catch (error: any) {
      Alert.alert(
        'CONNECT LIVE',
        error?.message || 'Could not connect to BUKLOD PTT.',
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
      setMode('NORMAL');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const current = runtime.connection;
    if (!current) return;
    setScope(current.scope);
    setChannel(current.channel);
  }, [runtime.connection]);

  const chooseTarget = async (
    nextScope: BuklodPttScope,
    nextChannel: number,
  ) => {
    if (busy) return;

    const live = runtime.connection;
    setScope(nextScope);
    setChannel(nextChannel);

    if (!live) return;
    if (live.scope.id === nextScope.id && live.channel === nextChannel) {
      return;
    }

    setBusy(true);
    try {
      await selectBuklodPttTarget(nextScope, nextChannel);
    } catch (error: any) {
      setScope(live.scope);
      setChannel(live.channel);
      Alert.alert(
        'BUKLOD PTT',
        error?.message || 'Could not switch that channel.',
      );
    } finally {
      setBusy(false);
    }
  };

  const armSos = () => {
    Alert.alert(
      'ARM SOS PTT?',
      'SOS has the highest PTT priority and alerts authorized members in this scope.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'ARM SOS',
          style: 'destructive',
          onPress: () => setMode('SOS'),
        },
      ],
    );
  };

  useEffect(() => {
    setBuklodPttArmedKind(mode);
  }, [mode]);

  const active = runtime.connection;

  return (
    <View style={{ flex: 1 }}>
      {/* BUKLOD_PTT_ADMOB_R1 */}
      <View style={{ flex: 1 }}>
        <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={s.brand}>BUKLOD PTT</Text>
          <Text style={s.subbrand}>Push-to-Talk Communication</Text>
        </View>

        <View style={[s.netDot, active && s.netDotLive]} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Text style={s.sectionLabel}>AUTHORIZED TALK GROUP</Text>

        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          <View style={s.scopeRow}>
            {scopes.map((item) => {
              const selected = item.id === scope?.id;
              return (
                <Pressable
                  key={item.id}
                  disabled={busy}
                  onPress={() => void chooseTarget(item, channel)}
                  style={[s.scopeChip, selected && s.scopeChipOn]}
                >
                  <Text style={[s.scopeType, selected && s.scopeTextOn]}>
                    {item.scope_type}
                  </Text>
                  <Text style={[s.scopeName, selected && s.scopeTextOn]}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Text style={s.sectionLabel}>LOGICAL CHANNEL</Text>

        <View style={s.channels}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((ch) => (
            <Pressable
              key={ch}
              disabled={busy}
              onPress={() => scope && void chooseTarget(scope, ch)}
              style={[s.channel, channel === ch && s.channelOn]}
            >
              <Text style={[s.channelText, channel === ch && s.channelTextOn]}>
                CH{String(ch).padStart(2, '0')}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={s.activeCard}>
          <Text style={s.activeEyebrow}>
            {runtime.priorityReceiving ? 'PRIORITY OVERRIDE ACTIVE' : 'ACTIVE TARGET'}
          </Text>
          <Text style={s.activeTitle}>
            {active?.scope.name || scope?.name || 'No authorized scope'}
          </Text>
          <Text style={s.activeMeta}>
            {active?.scope.scope_type || scope?.scope_type || '—'} · CH
            {String(active?.channel || channel).padStart(2, '0')}
          </Text>
        </View>

        {!active ? (
          <Pressable
            disabled={!scope || busy}
            onPress={() => void connect()}
            style={[s.connect, (!scope || busy) && s.disabled]}
          >
            <MaterialCommunityIcons name="access-point" size={22} color="#071725" />
            <Text style={s.connectText}>
              {busy ? 'CONNECTING…' : 'CONNECT + MONITOR'}
            </Text>
          </Pressable>
        ) : null}

        <View style={s.tools}>
          <Pressable
            onPress={() =>
              Alert.alert(
                'SECURE FLOOR',
                runtime.transmitting
                  ? 'You are talking. Release the button to listen.'
                  : 'Hold the talk button. Only one person can talk at a time.',
              )
            }
            style={[s.tool, runtime.transmitting && s.toolOn]}
          >
            <MaterialCommunityIcons name="shield-lock" size={24} color="#56DCE5" />
            <Text style={s.toolText}>
              {runtime.transmitting ? 'FLOOR ON' : 'SECURE FLOOR'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              Alert.alert(
                'PRIORITY RX',
                runtime.priorityReceiving
                  ? 'A Priority or SOS call moved you here. Pick another channel to stay, or wait to return.'
                  : 'Priority and SOS from your groups switch this phone to their channel, then return you.',
              )
            }
            style={[s.tool, runtime.priorityReceiving && s.toolOn]}
          >
            <MaterialCommunityIcons name="swap-vertical-bold" size={24} color="#56DCE5" />
            <Text style={s.toolText}>
              {runtime.priorityReceiving ? 'RX ON' : 'PRIORITY RX'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              Alert.alert(
                'RADIO BRIDGE',
                'No external radio or Bluetooth handset is connected. Use the on-screen hold button.',
              )
            }
            style={s.tool}
          >
            <MaterialCommunityIcons name="bluetooth-connect" size={24} color="#56DCE5" />
            <Text style={s.toolText}>RADIO BRIDGE</Text>
          </Pressable>
        </View>

        <Text style={s.staged}>
          Habang naka-monitor, may notification na Talk at Stop. Puwede iyon
          habang naka-lock ang screen o nasa ibang app. Force-stopped Android
          apps cannot be guaranteed to auto-play PTT.
        </Text>
      </ScrollView>

      {active ? (
        <View style={s.dock}>
          <View style={s.modeRow}>
            <Pressable
              onPress={() => setMode('NORMAL')}
              style={[s.mode, mode === 'NORMAL' && s.modeOn]}
            >
              <Text style={[s.modeText, mode === 'NORMAL' && s.modeTextOn]}>
                NORMAL
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMode('PRIORITY')}
              style={[s.mode, mode === 'PRIORITY' && s.modePriority]}
            >
              <Text style={[s.modeText, mode === 'PRIORITY' && s.modeTextOn]}>
                PRIORITY
              </Text>
            </Pressable>

            <Pressable
              onPress={armSos}
              style={[s.mode, mode === 'SOS' && s.modeSos]}
            >
              <Text style={[s.modeText, mode === 'SOS' && s.modeTextOn]}>
                SOS
              </Text>
            </Pressable>
          </View>

          <LivePtt
            key={`${active.callType}:${active.callId}`}
            runtime={runtime}
            mode={mode}
          />

          <Pressable onPress={() => void disconnect()} style={s.disconnect}>
            <Text style={s.disconnectText}>DISCONNECT / STOP MONITORING</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
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
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030A10' },
  topbar: {
    minHeight: 68,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#17303C',
    backgroundColor: '#07131D',
  },
  back: { padding: 8 },
  brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  subbrand: { color: '#78909C', fontSize: 11, marginTop: 1 },
  netDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#6B7680' },
  netDotLive: { backgroundColor: '#25D366' },
  content: { padding: 14, paddingBottom: 40 },
  sectionLabel: {
    color: '#708893',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 12,
    marginBottom: 8,
  },
  scopeRow: { flexDirection: 'row', gap: 8 },
  scopeChip: {
    minWidth: 145,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#23414E',
    backgroundColor: '#091722',
    padding: 11,
  },
  scopeChipOn: { borderColor: '#50D8E2', backgroundColor: '#0A2630' },
  scopeType: { color: '#6C8792', fontSize: 9, fontWeight: '900' },
  scopeName: { color: '#D9E5E9', fontSize: 12, fontWeight: '800', marginTop: 3 },
  scopeTextOn: { color: '#FFFFFF' },
  channels: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  channel: {
    flexGrow: 1,
    flexBasis: '17%',
    maxWidth: '19%',
    minWidth: 58,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#0A1822',
    borderWidth: 1,
    borderColor: '#203743',
  },
  channelOn: { backgroundColor: '#0B4B58', borderColor: '#55E0E8' },
  channelText: { color: '#91A7B0', fontSize: 11, fontWeight: '900' },
  channelTextOn: { color: '#FFFFFF' },
  activeCard: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: '#071A27',
    borderWidth: 1,
    borderColor: '#1B4555',
    padding: 15,
  },
  activeEyebrow: {
    color: '#57D9E2',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  activeTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 4 },
  activeMeta: { color: '#8CA2AB', fontSize: 12, marginTop: 3 },
  connect: {
    marginTop: 14,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#55E0E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectText: { color: '#071725', fontWeight: '900', letterSpacing: 0.7 },
  disabled: { opacity: 0.45 },
  dock: {
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: '#17303C',
    backgroundColor: '#07131D',
    paddingBottom: 2,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginHorizontal: 14 },
  mode: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#29404B',
    backgroundColor: '#091722',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOn: { borderColor: '#55E0E8', backgroundColor: '#0A3440' },
  modePriority: { borderColor: '#F1B953', backgroundColor: '#4C3812' },
  modeSos: { borderColor: '#FF6B57', backgroundColor: '#55201B' },
  modeText: { color: '#8FA3AC', fontSize: 10, fontWeight: '900' },
  modeTextOn: { color: '#FFFFFF' },
  livePanel: {
    marginTop: 6,
    marginHorizontal: 14,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#07131D',
    borderWidth: 1,
    borderColor: '#254552',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  lamp: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#64727A' },
  txLamp: { backgroundColor: '#FF5A49' },
  rxLamp: { backgroundColor: '#45E0E8' },
  status: { color: '#FFFFFF', fontWeight: '900', marginLeft: 8 },
  people: { marginLeft: 'auto', color: '#7D939C', fontSize: 11 },
  talkingName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
  },
  pttWrap: { alignItems: 'center', marginTop: 8 },
  ptt: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#0A5C6A',
    borderWidth: 8,
    borderColor: '#133541',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttPressed: { transform: [{ scale: 0.97 }] },
  pttTx: { backgroundColor: '#B83228', borderColor: '#F06B5E' },
  pttBusy: { backgroundColor: '#543338', borderColor: '#8A5158' },
  pttSosArmed: { borderColor: '#FF6B57' },
  pttText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  pttHint: { color: '#B8C6CC', fontSize: 10, marginTop: 2, textAlign: 'center' },
  disconnect: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 },
  disconnectText: { color: '#FF8073', fontWeight: '900' },
  tools: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tool: {
    flex: 1,
    minHeight: 70,
    borderRadius: 14,
    backgroundColor: '#091722',
    borderWidth: 1,
    borderColor: '#203743',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  toolOn: { borderColor: '#55E0E8', backgroundColor: '#0A3440' },
  toolText: { color: '#D4E2E7', fontSize: 9, fontWeight: '900' },
  staged: {
    color: '#6D818A',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 18,
  },
});