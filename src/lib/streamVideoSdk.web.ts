import React, {
  Fragment,
  createContext,
  createElement,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  CallingState,
  StreamVideoClient,
  type Call,
} from '@stream-io/video-client';

import {
  getCachedBuklodStreamVideoClient,
  subscribeBuklodStreamVideoClient,
} from '@/lib/buklodStreamVideoClient';

export * from '@stream-io/video-client';
export { CallingState, StreamVideoClient };

/* BUKLOD_WEB_CALLING_R1
 * A small compatibility layer keeps shared Connect code platform-neutral while
 * the browser uses @stream-io/video-client directly.
 */

export function useStreamVideoClient(): StreamVideoClient | undefined {
  const [client, setClient] = useState<StreamVideoClient | undefined>(
    () => getCachedBuklodStreamVideoClient() ?? undefined
  );

  useEffect(() =>
    subscribeBuklodStreamVideoClient(
      next => setClient(next ?? undefined)
    ), []
  );

  return client;
}

export function useCalls(): Call[] {
  const client = useStreamVideoClient();
  const [calls, setCalls] = useState<Call[]>(
    () => client?.state.calls ?? []
  );

  useEffect(() => {
    if (!client) {
      setCalls([]);
      return;
    }

    setCalls(client.state.calls ?? []);
    const subscription = client.state.calls$.subscribe(
      next => setCalls(next ?? [])
    );

    return () => subscription.unsubscribe();
  }, [client]);

  return calls;
}

const CallContext = createContext<Call | undefined>(undefined);

export function StreamCall({
  call,
  children,
}: PropsWithChildren<{ call?: Call }>) {
  return createElement(
    CallContext.Provider,
    { value: call },
    children
  );
}

export function useCall(): Call | undefined {
  return useContext(CallContext);
}

export function StreamVideo({
  children,
}: PropsWithChildren<{ client?: StreamVideoClient }>) {
  return createElement(Fragment, null, children);
}

function useCallCallingState() {
  const call = useCall();
  const [state, setState] = useState<any>(
    () => call?.state.callingState ?? CallingState.IDLE
  );

  useEffect(() => {
    if (!call) {
      setState(CallingState.IDLE);
      return;
    }

    setState(call.state.callingState);
    const subscription = call.state.callingState$.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [call]);

  return state;
}

function useParticipants() {
  const call = useCall();
  const [participants, setParticipants] = useState<any[]>(
    () => call?.state.participants ?? []
  );

  useEffect(() => {
    if (!call) {
      setParticipants([]);
      return;
    }

    setParticipants(call.state.participants ?? []);
    const subscription = call.state.participants$.subscribe(
      next => setParticipants(next ?? [])
    );
    return () => subscription.unsubscribe();
  }, [call]);

  return participants;
}

function useCallSession() {
  const call = useCall();
  const [session, setSession] = useState<any>(
    () => call?.state.session ?? null
  );

  useEffect(() => {
    if (!call) {
      setSession(null);
      return;
    }

    setSession(call.state.session ?? null);
    const subscription = call.state.session$.subscribe(setSession);
    return () => subscription.unsubscribe();
  }, [call]);

  return session;
}

function useHasPermissions(_capability: unknown) {
  return false;
}

export function useCallStateHooks() {
  return {
    useCallCallingState,
    useParticipants,
    useCallSession,
    useHasPermissions,
  };
}

/* Shared files that are native-only have platform-specific web replacements.
 * Keep these lightweight exports so any incidental import remains build-safe.
 */
export function CallContent() { return null; }
export function CallControls() { return null; }
export function ScreenShareToggleButton() { return null; }
export function RingingCallContent() { return null; }
export const OwnCapability = {} as any;
export const StreamVideoRN = {} as any;
