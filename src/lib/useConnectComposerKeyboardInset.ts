import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  Platform,
  type View,
} from 'react-native';

/** Space reserved under the message list for the composer row. */
export const CONNECT_COMPOSER_RESERVED_HEIGHT = 80;

function resolveComposerLift(
  event: KeyboardEvent,
  containerRef: React.RefObject<View | null>,
  onResolved: (lift: number) => void
) {
  const keyboardTop = event.endCoordinates.screenY;
  const windowHeight = Dimensions.get('window').height;
  const windowLift = Math.max(
    0,
    windowHeight - keyboardTop
  );
  const container = containerRef.current;

  if (!container) {
    onResolved(windowLift);
    return;
  }

  container.measureInWindow(
    (_x, y, _width, height) => {
      const containerBottom = y + height;
      const measuredLift = Math.max(
        0,
        containerBottom - keyboardTop
      );

      onResolved(
        container ? measuredLift : windowLift
      );
    }
  );
}

/**
 * Positions the Connect composer flush on the global nav when closed, and
 * aligned to the real keyboard top (screenY) when open.
 */
export function useConnectComposerKeyboardInset(
  containerRef: React.RefObject<View | null>
) {
  const [composerBottom, setComposerBottom] =
    useState(0);
  const [keyboardOpen, setKeyboardOpen] =
    useState(false);
  const rafRef = useRef<number | null>(null);
  const activeEventRef =
    useRef<KeyboardEvent | null>(null);

  const clearInset = useCallback(() => {
    activeEventRef.current = null;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setComposerBottom(0);
    setKeyboardOpen(false);
  }, []);

  const syncInset = useCallback(
    (event: KeyboardEvent) => {
      activeEventRef.current = event;
      setKeyboardOpen(true);

      if (event.endCoordinates.height <= 0) {
        clearInset();
        return;
      }

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        resolveComposerLift(
          event,
          containerRef,
          lift => {
            setComposerBottom(lift);
          }
        );
      });
    },
    [clearInset, containerRef]
  );

  useEffect(() => {
    const onShow = (event: KeyboardEvent) => {
      syncInset(event);
    };
    const onHide = () => {
      clearInset();
    };
    const onFrame = (event: KeyboardEvent) => {
      if (event.endCoordinates.height > 0) {
        syncInset(event);
      } else {
        clearInset();
      }
    };

    const subs = [
      Keyboard.addListener(
        'keyboardDidShow',
        onShow
      ),
      Keyboard.addListener(
        'keyboardDidHide',
        onHide
      ),
    ];

    if (Platform.OS === 'ios') {
      subs.push(
        Keyboard.addListener(
          'keyboardWillShow',
          onShow
        ),
        Keyboard.addListener(
          'keyboardWillHide',
          onHide
        ),
        Keyboard.addListener(
          'keyboardWillChangeFrame',
          onFrame
        ),
        Keyboard.addListener(
          'keyboardDidChangeFrame',
          onFrame
        )
      );
    }

    return () => {
      subs.forEach(sub => sub.remove());

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [clearInset, syncInset]);

  return {
    composerBottom,
    keyboardVisible: keyboardOpen,
    clearComposerInset: clearInset,
    resyncComposerInset: () => {
      const active = activeEventRef.current;

      if (!active || active.endCoordinates.height <= 0) {
        clearInset();
        return;
      }

      syncInset(active);
    },
  };
}
