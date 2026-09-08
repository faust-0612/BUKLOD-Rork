import {
  applyClassroomInteractionEvent,
  createClassroomLiveAuthorityState,
  desiredStudentMedia,
} from './classroomLiveState';

describe('BUKLOD Classroom live authority reducer', () => {
  const sessionId = 'session-a';

  it('ignores stale, duplicate and cross-session commands', () => {
    const initial = createClassroomLiveAuthorityState(sessionId);
    const called = applyClassroomInteractionEvent(initial, {
      sessionId,
      interactionId: 'i-2',
      version: 2,
      type: 'CALL_STUDENT',
      targetUserId: 'student-1',
      sentAt: new Date().toISOString(),
    });

    const stale = applyClassroomInteractionEvent(called, {
      sessionId,
      interactionId: 'i-1',
      version: 1,
      type: 'RETURN_TO_LISTENING',
      sentAt: new Date().toISOString(),
    });
    const crossSession = applyClassroomInteractionEvent(called, {
      sessionId: 'session-b',
      interactionId: 'i-3',
      version: 3,
      type: 'MUTE_ALL',
      sentAt: new Date().toISOString(),
    });

    expect(stale).toBe(called);
    expect(crossSession).toBe(called);
    expect(called.activeUserIds).toEqual(['student-1']);
  });

  it('latest teacher call switches active student deterministically', () => {
    let state = createClassroomLiveAuthorityState(sessionId);
    state = applyClassroomInteractionEvent(state, {
      sessionId,
      interactionId: 'first',
      version: 1,
      type: 'CALL_STUDENT',
      targetUserId: 'student-1',
      sentAt: new Date().toISOString(),
    });
    state = applyClassroomInteractionEvent(state, {
      sessionId,
      interactionId: 'second',
      version: 2,
      type: 'CALL_STUDENT',
      targetUserId: 'student-2',
      sentAt: new Date().toISOString(),
    });

    expect(state.activeUserIds).toEqual(['student-2']);
    expect(desiredStudentMedia(state, 'student-1')).toEqual({ microphone: false, camera: false, reason: 'ACTIVE_RECITATION' });
    expect(desiredStudentMedia(state, 'student-2')).toEqual({ microphone: true, camera: true, reason: 'ACTIVE_RECITATION' });
  });

  it('mute all and class end always converge to media off', () => {
    let state = createClassroomLiveAuthorityState(sessionId);
    state = applyClassroomInteractionEvent(state, {
      sessionId,
      interactionId: 'call',
      version: 1,
      type: 'CALL_STUDENT',
      targetUserId: 'student-1',
      sentAt: new Date().toISOString(),
    });
    state = applyClassroomInteractionEvent(state, {
      sessionId,
      interactionId: 'mute',
      version: 2,
      type: 'MUTE_ALL',
      sentAt: new Date().toISOString(),
    });
    expect(desiredStudentMedia(state, 'student-1').microphone).toBe(false);
    expect(desiredStudentMedia(state, 'student-1').camera).toBe(false);

    state = applyClassroomInteractionEvent(state, {
      sessionId,
      interactionId: 'end',
      version: 3,
      type: 'CLASS_ENDED',
      sentAt: new Date().toISOString(),
    });
    expect(state.ended).toBe(true);
    expect(state.muteAll).toBe(true);
    expect(state.activeUserIds).toEqual([]);
  });

  it('honors manual mic/camera off while student is active', () => {
    const state = applyClassroomInteractionEvent(createClassroomLiveAuthorityState(sessionId), {
      sessionId,
      interactionId: 'call',
      version: 1,
      type: 'CALL_STUDENT',
      targetUserId: 'student-1',
      sentAt: new Date().toISOString(),
    });

    expect(desiredStudentMedia(state, 'student-1', { micOff: true })).toEqual({
      microphone: false,
      camera: true,
      reason: 'ACTIVE_RECITATION',
    });
    expect(desiredStudentMedia(state, 'student-1', { cameraOff: true })).toEqual({
      microphone: true,
      camera: false,
      reason: 'ACTIVE_RECITATION',
    });
  });
});
