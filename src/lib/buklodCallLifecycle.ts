import { Alert } from 'react-native';

import {
  playBusyOrFailureTone,
  stopAllCallAudioCues,
  stopRingback,
} from '@/lib/buklodCallAudioCues';
import { supabase } from '@/lib/supabase';
import type { StreamVideoClient } from '@/lib/streamVideoSdk';

/*
 * BUKLOD CALL LIFECYCLE R1
 *
 * Bridges Stream's real-time call events into BUKLOD server truth so calls
 * have durable ringing/accepted/busy/missed/ended state and duration.
 */

type CallKind = 'PERSONAL' | 'SCOPE';
type CallMode = 'audio' | 'video';

type CallEnvelope = {
  cid: string;
  callKind: CallKind | null;
  threadId: string | null;
  scopeId: string | null;
  mode: CallMode;
  title: string | null;
  createdBy: string | null;
};

const seenAlerts = new Set<string>();

function text(value: unknown) {
  return String(value ?? '').trim();
}

function nullableText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function readCustom(call: any) {
  return (
    call?.custom ??
    call?.data?.custom ??
    {}
  ) as Record<string, any>;
}

function readCallEnvelope(event: any): CallEnvelope {
  const call =
    event?.call ??
    event?.call_data ??
    event?.callData ??
    {};

  const custom = readCustom(call);

  const callType =
    text(call?.type || event?.call_type || 'default') ||
    'default';

  const callId =
    text(call?.id || event?.call_id);

  const cid =
    text(
      call?.cid ||
      event?.call_cid ||
      (callId ? `${callType}:${callId}` : '')
    );

  const threadId =
    nullableText(
      custom?.buklod_thread_id
    );

  const scopeId =
    nullableText(
      custom?.buklod_scope_id
    );

  const scopeMarker =
    text(
      custom?.buklod_call_scope
    ).toUpperCase();

  const callKind: CallKind | null =
    threadId || scopeMarker === 'PERSONAL'
      ? 'PERSONAL'
      : scopeId
        ? 'SCOPE'
        : null;

  const mode: CallMode =
    text(
      custom?.buklod_call_mode
    ).toLowerCase() === 'video' ||
    call?.video === true ||
    event?.video === true
      ? 'video'
      : 'audio';

  return {
    cid,
    callKind,
    threadId,
    scopeId,
    mode,
    title:
      nullableText(
        custom?.buklod_scope_name ||
        custom?.buklod_call_title
      ),
    createdBy:
      nullableText(
        call?.created_by?.id ||
        call?.createdBy?.id ||
        event?.created_by?.id
      ),
  };
}

function eventOccurredAt(event: any) {
  const raw =
    event?.created_at ||
    event?.createdAt ||
    event?.received_at ||
    null;

  if (!raw) {
    return new Date().toISOString();
  }

  const parsed = new Date(raw);

  return Number.isFinite(parsed.getTime())
    ? parsed.toISOString()
    : new Date().toISOString();
}

async function ensureCallLog(
  envelope: CallEnvelope
) {
  if (
    !envelope.cid ||
    !envelope.callKind
  ) {
    return;
  }

  const { error } =
    await (supabase as any).rpc(
      'buklod_call_log_start',
      {
        _stream_call_cid:
          envelope.cid,
        _call_kind:
          envelope.callKind,
        _thread_id:
          envelope.threadId,
        _scope_id:
          envelope.scopeId,
        _mode:
          envelope.mode,
        _title:
          envelope.title,
        _created_by:
          envelope.createdBy,
      }
    );

  if (error) {
    throw error;
  }
}

async function writeCallEvent(
  envelope: CallEnvelope,
  eventName: string,
  event: any,
) {
  if (!envelope.cid) {
    return;
  }

  const eventUserId =
    nullableText(
      event?.user?.id ||
      event?.user_id ||
      event?.member?.user?.id
    );

  const reason =
    nullableText(
      event?.reason
    );

  const { error } =
    await (supabase as any).rpc(
      'buklod_call_log_event',
      {
        _stream_call_cid:
          envelope.cid,
        _event:
          eventName,
        _reason:
          reason,
        _event_user_id:
          eventUserId,
        _event_at:
          eventOccurredAt(event),
      }
    );

  if (error) {
    throw error;
  }
}

async function persistEvent(
  eventName: string,
  event: any,
) {
  const envelope =
    readCallEnvelope(event);

  if (!envelope.cid) {
    return envelope;
  }

  try {
    await ensureCallLog(envelope);
    await writeCallEvent(
      envelope,
      eventName,
      event,
    );
  }
  catch (error: any) {
    console.warn(
      'BUKLOD call lifecycle:',
      eventName,
      error?.message ?? error
    );
  }

  return envelope;
}

function alertOnce(
  key: string,
  title: string,
  message: string,
) {
  if (seenAlerts.has(key)) {
    return;
  }

  seenAlerts.add(key);

  if (seenAlerts.size > 128) {
    seenAlerts.clear();
    seenAlerts.add(key);
  }

  Alert.alert(title, message);
}

function maybeShowCallerOutcome(
  client: StreamVideoClient,
  eventName: string,
  event: any,
  envelope: CallEnvelope,
) {
  const currentUserId =
    nullableText(
      (client as any)?.state
        ?.connectedUser?.id
    );

  const isCaller =
    !!currentUserId &&
    !!envelope.createdBy &&
    currentUserId === envelope.createdBy;

  if (
    isCaller &&
    (eventName === 'call.accepted' ||
      eventName === 'call.session_started' ||
      eventName === 'call.session_ended' ||
      eventName === 'call.ended')
  ) {
    stopAllCallAudioCues();
    return;
  }

  if (
    !isCaller ||
    !envelope.callKind ||
    (eventName !== 'call.rejected' &&
      eventName !== 'call.missed')
  ) {
    return;
  }

  // A group member may reject/miss after another member already answered.
  const session = event?.call?.session;
  if (Object.keys(session?.accepted_by ?? {}).some(id => id !== currentUserId)) {
    return;
  }

  const reason =
    text(event?.reason)
      .toLowerCase();

  // Caller cancelled — stop ringback only, no error beep.
  if (
    reason === 'cancel' ||
    reason === 'cancelled' ||
    reason === 'canceled'
  ) {
    stopRingback();
    return;
  }

  void playBusyOrFailureTone();

  // Keep existing PERSONAL alerts only (do not expand alert UX).
  if (
    envelope.callKind !== 'PERSONAL' ||
    eventName !== 'call.rejected'
  ) {
    return;
  }

  const key =
    `${envelope.cid}:${reason || 'rejected'}`;

  if (reason === 'busy') {
    alertOnce(
      key,
      'Busy',
      'The person you called is currently on another call.'
    );
    return;
  }

  if (
    reason === 'timeout' ||
    reason === 'no_answer'
  ) {
    alertOnce(
      key,
      'No answer',
      'The call was not answered.'
    );
    return;
  }

  if (
    reason === 'rejected' ||
    reason === 'decline' ||
    reason === 'declined'
  ) {
    alertOnce(
      key,
      'Call declined',
      'The person you called declined the call.'
    );
  }
}

export function installBuklodCallLifecycle(
  client: StreamVideoClient
) {
  const eventNames = [
    'call.ring',
    'call.accepted',
    'call.rejected',
    'call.missed',
    'call.session_started',
    'call.session_ended',
    'call.ended',
  ] as const;

  const unsubscribers =
    eventNames.map(
      eventName =>
        (client as any).on(
          eventName,
          (event: any) => {
            // Audio must react immediately, independently of network/database latency.
            maybeShowCallerOutcome(
              client,
              eventName,
              event,
              readCallEnvelope(event),
            );
            if (eventName === 'call.ended') return;
            void persistEvent(
              eventName,
              event,
            );
          }
        )
    );

  return () => {
    stopAllCallAudioCues();
    unsubscribers.forEach(
      unsubscribe => {
        try {
          if (
            typeof unsubscribe ===
            'function'
          ) {
            unsubscribe();
          }
        }
        catch {
          // Best-effort listener cleanup.
        }
      }
    );
  };
}

/**
 * Handles non-ringing Stream pushes (especially call.missed) when Android is
 * backgrounded/killed. The call row is normally created by the caller's
 * call.ring event; this updates the current recipient's outcome server-side.
 */
export async function recordBuklodStreamPushEvent(
  data: Record<string, any> | undefined | null
) {
  const eventName =
    text(
      data?.type ||
      data?.event_type
    );

  const cid =
    text(
      data?.call_cid ||
      data?.callCid
    );

  if (
    !cid ||
    !eventName.startsWith('call.')
  ) {
    return;
  }

  try {
    const { error } =
      await (supabase as any).rpc(
        'buklod_call_log_event',
        {
          _stream_call_cid:
            cid,
          _event:
            eventName,
          _reason:
            nullableText(
              data?.reason
            ),
          _event_user_id:
            null,
          _event_at:
            new Date().toISOString(),
        }
      );

    if (error) {
      throw error;
    }
  }
  catch (error: any) {
    console.warn(
      'BUKLOD Stream push call log:',
      error?.message ?? error
    );
  }
}
