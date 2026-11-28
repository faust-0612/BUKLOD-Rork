import { useThemedShared } from '@/components/UI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Headerless admin routes use one reactive palette for canvas, cards and text. */
export function useAdminShared() {
  const shared = useThemedShared();
  const insets = useSafeAreaInsets();
  return {
    ...shared,
    content: {
      ...shared.content,
      paddingTop: insets.top + 6,
      paddingBottom: insets.bottom + 12,
    },
  };
}
