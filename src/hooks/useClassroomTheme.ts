import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CLASSROOM_THEMES,
  DEFAULT_CLASSROOM_THEME_ID,
  isClassroomThemeId,
  type ClassroomThemeId,
} from '@/lib/education/classroomTheme';

const STORAGE_KEY = '@buklod/classroom-theme-v1';

export function useClassroomTheme() {
  const [themeId, setThemeIdState] = useState<ClassroomThemeId>(DEFAULT_CLASSROOM_THEME_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (alive && isClassroomThemeId(value)) setThemeIdState(value);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setThemeId = useCallback((next: ClassroomThemeId) => {
    setThemeIdState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const theme = useMemo(() => CLASSROOM_THEMES[themeId], [themeId]);

  return { theme, themeId, setThemeId, ready };
}
