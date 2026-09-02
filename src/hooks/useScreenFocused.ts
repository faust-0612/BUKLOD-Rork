import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

/** Screen focus without @react-navigation/native — uses expo-router. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  return focused;
}
