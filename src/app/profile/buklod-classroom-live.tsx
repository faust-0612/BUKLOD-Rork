import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import ClassroomLiveView from '@/components/classroom/ClassroomLiveView';

export default function BuklodClassroomLiveScreen() {
  const params = useLocalSearchParams<{ id?: string; sessionId?: string; name?: string }>();
  const classroomId = String(params.id ?? '');
  const sessionId = String(params.sessionId ?? '');
  const classroomName = String(params.name ?? 'BUKLOD Classroom');

  const exit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/profile/buklod-classroom' as any, params: { id: classroomId, name: classroomName } });
  }, [classroomId, classroomName]);

  return (
    <ClassroomLiveView
      classroomId={classroomId}
      sessionId={sessionId}
      classroomName={classroomName}
      onExit={exit}
    />
  );
}
