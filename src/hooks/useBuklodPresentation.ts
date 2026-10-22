import {
  useMemo,
} from 'react';

import {
  createBuklodButtonStyles,
  createBuklodSharedStyles,
  mapThemeToLegacyColors,
  type LegacyThemeColors,
} from '@/lib/buklodThemePresentation';
import {
  useBuklodScrollBottomInset,
} from '@/lib/buklodSafeArea';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

export function useBuklodPresentation() {
  const {
    theme,
    preference,
    paletteId,
    ready,
    setPreference,
    options,
  } = useBuklodTheme();

  const scrollBottomInset =
    useBuklodScrollBottomInset({
      extra: 10,
    });

  const colors = useMemo(
    () => mapThemeToLegacyColors(theme),
    [theme]
  );

  const shared = useMemo(
    () => {
      const base =
        createBuklodSharedStyles(theme);

      return {
        ...base,
        content: {
          ...base.content,
          paddingBottom: scrollBottomInset,
        },
      };
    },
    [scrollBottomInset, theme]
  );

  const buttonStyles = useMemo(
    () => createBuklodButtonStyles(theme),
    [theme]
  );

  return {
    theme,
    colors: colors as LegacyThemeColors,
    shared,
    scrollBottomInset,
    buttonStyles,
    preference,
    paletteId,
    ready,
    setPreference,
    options,
  };
}
