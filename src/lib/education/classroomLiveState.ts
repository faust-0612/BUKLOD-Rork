export type ClassroomParticipantMode =
  | 'LISTENING'
  | 'CALLED'
  | 'ACTIVE_RECITATION'
  | 'ACTIVE_CONVERSATION'
  | 'GROUP_DISCUSSION'
  | 'NETWORK_POOR'
  | 'RECONNECTING'
  | 'TECHNICAL_FAILURE'
  | 'LEFT_CLASS'
  | 'CLASS_ENDED';

export type ClassroomInteractionType =
  | 'CALL_STUDENT'
  | 'START_CONVERSATION'
  | 'START_GROUP'
  | 'RETURN_TO_LISTENING'
  | 'MUTE_ALL'
  | 'CLEAR_MUTE_ALL'
  | 'NETWORK_POOR'
  | 'RECONNECTING'
  | 'CLASS_ENDED';

export type ClassroomInteractionEvent = {
  sessionId: string;
  interactionId: string;
  version: number;
  type: ClassroomInteractionType;
  targetUserId?: string | null;
  targetUserIds?: string[];
  actorUserId?: string | null;
  sentAt: string;
};

export type ClassroomLiveAuthorityState = {
  sessionId: string;
  version: number;
  interactionId: string | null;
  mode: ClassroomParticipantMode;
  activeUserId: string | null;
  activeUserIds: string[];
  muteAll: boolean;
  ended: boolean;
};

export type ClassroomManualMediaOverride = {
  micOff?: boolean;
  cameraOff?: boolean;
};

export function createClassroomLiveAuthorityState(sessionId: string): ClassroomLiveAuthorityState {
  return {
    sessionId,
    version: 0,
    interactionId: null,
    mode: 'LISTENING',
    activeUserId: null,
    activeUserIds: [],
    muteAll: false,
    ended: false,
  };
}

/**
 * Latest valid teacher/session event wins. Stale, duplicate and cross-session
 * events are ignored. Safety commands always converge to media-off states.
 */
export function applyClassroomInteractionEvent(
  current: ClassroomLiveAuthorityState,
  event: ClassroomInteractionEvent,
): ClassroomLiveAuthorityState {
  if (!event || event.sessionId !== current.sessionId) return current;
  if (!Number.isFinite(event.version) || event.version <= current.version) return current;

  const base: ClassroomLiveAuthorityState = {
    ...current,
    version: event.version,
    interactionId: event.interactionId || current.interactionId,
  };

  if (current.ended || event.type === 'CLASS_ENDED') {
    return {
      ...base,
      mode: 'CLASS_ENDED',
      activeUserId: null,
      activeUserIds: [],
      muteAll: true,
      ended: true,
    };
  }

  if (event.type === 'MUTE_ALL') {
    return {
      ...base,
      mode: 'LISTENING',
      activeUserId: null,
      activeUserIds: [],
      muteAll: true,
    };
  }

  if (event.type === 'CLEAR_MUTE_ALL') {
    return {
      ...base,
      mode: 'LISTENING',
      activeUserId: null,
      activeUserIds: [],
      muteAll: false,
    };
  }

  if (event.type === 'RETURN_TO_LISTENING') {
    return {
      ...base,
      mode: 'LISTENING',
      activeUserId: null,
      activeUserIds: [],
    };
  }

  if (event.type === 'RECONNECTING') {
    return {
      ...base,
      mode: 'RECONNECTING',
      activeUserId: null,
      activeUserIds: [],
    };
  }

  if (event.type === 'NETWORK_POOR') {
    return {
      ...base,
      mode: 'NETWORK_POOR',
      activeUserId: null,
      activeUserIds: [],
    };
  }

  if (event.type === 'START_GROUP') {
    const members = Array.from(new Set((event.targetUserIds ?? []).filter(Boolean)));
    return {
      ...base,
      mode: 'GROUP_DISCUSSION',
      activeUserId: members[0] ?? null,
      activeUserIds: members,
      muteAll: false,
    };
  }

  if (event.type === 'CALL_STUDENT' || event.type === 'START_CONVERSATION') {
    const target = event.targetUserId || null;
    if (!target) return base;
    return {
      ...base,
      mode: event.type === 'CALL_STUDENT' ? 'ACTIVE_RECITATION' : 'ACTIVE_CONVERSATION',
      activeUserId: target,
      activeUserIds: [target],
      muteAll: false,
    };
  }

  return base;
}

export function desiredStudentMedia(
  state: ClassroomLiveAuthorityState,
  userId: string,
  override: ClassroomManualMediaOverride = {},
): { microphone: boolean; camera: boolean; reason: string } {
  if (!userId || state.ended || state.muteAll) {
    return { microphone: false, camera: false, reason: state.ended ? 'CLASS_ENDED' : 'SAFETY_OFF' };
  }

  const active = state.activeUserIds.includes(userId);
  if (!active) return { microphone: false, camera: false, reason: state.mode };

  return {
    microphone: !override.micOff,
    camera: !override.cameraOff,
    reason: state.mode,
  };
}
