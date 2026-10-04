import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CallingState,
  type Call,
} from '@stream-io/video-client';

import {
  StreamCall,
  useCalls,
} from '@/lib/streamVideoSdk';
import BuklodAcceptedCallContent from '@/components/BuklodAcceptedCallContent';

/* BUKLOD_WEB_CALLING_R1 */

function useCallingState(call: Call) {
  const [state, setState] = useState<any>(
    () => call.state.callingState
  );

  useEffect(() => {
    setState(call.state.callingState);
    const subscription = call.state.callingState$.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [call]);

  return state;
}

function BrowserCallSurface({ call }: { call: Call }) {
  const callingState = useCallingState(call);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incoming = call.isCreatedByMe === false;
  const mode = String(
    call.state.custom?.buklod_call_mode ?? 'audio'
  ).toLowerCase() === 'video'
    ? 'video'
    : 'audio';

  const callTitle = String(
    call.state.custom?.buklod_scope_name ??
    call.state.custom?.buklod_call_title ??
    call.state.createdBy?.name ??
    'BUKLOD Call'
  ).trim() || 'BUKLOD Call';

  const joined =
    callingState === CallingState.JOINED ||
    callingState === CallingState.RECONNECTING ||
    String(callingState).toLowerCase().includes('reconnect');

  const run = async (action: () => Promise<any>) => {
    if (working) {
      return;
    }

    setWorking(true);
    setError(null);
    try {
      await action();
    } catch (actionError: any) {
      setError(
        String(actionError?.message ?? 'Call action failed.')
      );
    } finally {
      setWorking(false);
    }
  };

  const accept = async () => {
    await call.microphone.enable();
    if (mode === 'video') {
      await call.camera.enable();
    } else {
      await call.camera.disable();
    }
    await call.join();
  };

  const reject = async () => {
    await call.leave({
      reject: true,
      reason: incoming ? 'decline' : 'cancel',
    });
  };

  if (joined) {
    return (
      <StreamCall call={call}>
        <BuklodAcceptedCallContent />
      </StreamCall>
    );
  }

  return (
    <View style={styles.ringPanel}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons
          name={mode === 'video' ? 'video' : 'phone'}
          size={38}
          color="#FFFFFF"
        />
      </View>

      <Text style={styles.callKind}>
        {incoming ? 'Incoming' : 'Outgoing'} {mode === 'video' ? 'video' : 'audio'} call
      </Text>
      <Text numberOfLines={2} style={styles.callTitle}>
        {callTitle}
      </Text>
      <Text style={styles.statusText}>
        {callingState === CallingState.JOINING
          ? 'Connecting...'
          : incoming
            ? 'BUKLOD is calling you'
            : 'Ringing...'}
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        {incoming ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Accept call"
            disabled={working}
            onPress={() => void run(accept)}
            style={[styles.actionButton, styles.acceptButton, working && styles.disabled]}
          >
            {working ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons
                name={mode === 'video' ? 'video' : 'phone'}
                size={24}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.actionText}>Accept</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={incoming ? 'Decline call' : 'Cancel call'}
          disabled={working}
          onPress={() => void run(reject)}
          style={[styles.actionButton, styles.rejectButton, working && styles.disabled]}
        >
          <MaterialCommunityIcons
            name="phone-hangup"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.actionText}>
            {incoming ? 'Decline' : 'Cancel'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.permissionHint}>
        Browser camera/microphone permission is requested when you accept the call.
      </Text>
    </View>
  );
}

function isVisibleCall(call: Call) {
  if (call.type === 'buklod_ptt') return false;

  const state = call.state.callingState;
  const text = String(state ?? '').toLowerCase();

  return (
    state === CallingState.RINGING ||
    state === CallingState.JOINING ||
    state === CallingState.JOINED ||
    state === CallingState.RECONNECTING ||
    text.includes('ring') ||
    text.includes('join') ||
    text.includes('reconnect')
  );
}

export function RingingCalls() {
  const calls = useCalls();

  const activeCall = useMemo(
    () => calls.find(isVisibleCall) ?? null,
    [calls]
  );

  const [, forceTick] = useState(0);

  useEffect(() => {
    const subscriptions = calls.map(call =>
      call.state.callingState$.subscribe(() => {
        forceTick(value => value + 1);
      })
    );

    return () => {
      subscriptions.forEach(subscription => subscription.unsubscribe());
    };
  }, [calls]);

  const current = calls.find(isVisibleCall) ?? activeCall;

  if (!current) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <BrowserCallSurface call={current} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100000,
    elevation: 100000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(3,10,8,0.86)',
  },
  ringPanel: {
    width: '100%',
    maxWidth: 520,
    minHeight: 410,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D211A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B865D',
  },
  callKind: {
    marginTop: 22,
    color: '#A9C4B7',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  callTitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
  },
  statusText: {
    marginTop: 9,
    color: '#C9D9D1',
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  actionButton: {
    minWidth: 112,
    minHeight: 74,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  acceptButton: {
    backgroundColor: '#2A9B68',
  },
  rejectButton: {
    backgroundColor: '#B33535',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 12,
    color: '#FFB3B3',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionHint: {
    marginTop: 22,
    maxWidth: 360,
    textAlign: 'center',
    color: '#829B8F',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.55,
  },
});
