import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  View,
} from 'react-native';

/** Space reserved under the message list for the composer row. */
export const CONNECT_COMPOSER_RESERVED_HEIGHT = 80;

/*
 * WEB_CONNECT_COMPOSER_SAFE_KEYBOARD_R1
 *
 * Mobile web needs two things the native Keyboard API cannot reliably provide:
 * 1) a small resting gap above browser/system bottom chrome;
 * 2) visualViewport tracking while the on-screen keyboard resizes the page.
 *
 * This file is web-only, so Android/iOS native continue using the existing
 * useConnectComposerKeyboardInset.ts implementation unchanged.
 */
const WEB_COMPOSER_MIN_GAP = 12;

function readWebSafeAreaBottom(): number {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined'
  ) {
    return WEB_COMPOSER_MIN_GAP;
  }

  try {
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.left = '0';
    probe.style.bottom = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
    document.body.appendChild(probe);

    const value = Number.parseFloat(
      window.getComputedStyle(probe).paddingBottom || '0',
    );

    probe.remove();

    return Math.max(
      WEB_COMPOSER_MIN_GAP,
      Number.isFinite(value) ? value + 6 : 0,
    );
  }
  catch {
    return WEB_COMPOSER_MIN_GAP;
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    target.isContentEditable
  );
}

function visibleViewportBottom(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const viewport = window.visualViewport;
  if (!viewport) {
    return window.innerHeight;
  }

  return viewport.height + viewport.offsetTop;
}

export function useConnectComposerKeyboardInset(
  _containerRef: React.RefObject<View | null>,
) {
  const [composerBottom, setComposerBottom] =
    useState(WEB_COMPOSER_MIN_GAP);
  const safeGapRef = useRef(WEB_COMPOSER_MIN_GAP);
  const restingViewportBottomRef = useRef(0);
  const editableFocusedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const scheduleSync = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;

      const currentBottom = visibleViewportBottom();
      const restingBottom = restingViewportBottomRef.current || currentBottom;

      if (!editableFocusedRef.current) {
        restingViewportBottomRef.current = Math.max(
          restingBottom,
          currentBottom,
        );
        setComposerBottom(safeGapRef.current);
        return;
      }

      const keyboardLift = Math.max(
        0,
        restingBottom - currentBottom,
      );

      setComposerBottom(
        safeGapRef.current + keyboardLift,
      );
    });
  }, []);

  const clearInset = useCallback(() => {
    editableFocusedRef.current = false;
    setComposerBottom(safeGapRef.current);

    if (typeof window !== 'undefined') {
      const currentBottom = visibleViewportBottom();
      if (currentBottom > 0) {
        restingViewportBottomRef.current = Math.max(
          restingViewportBottomRef.current,
          currentBottom,
        );
      }
    }
  }, []);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return;
    }

    safeGapRef.current = readWebSafeAreaBottom();
    restingViewportBottomRef.current = visibleViewportBottom();
    setComposerBottom(safeGapRef.current);

    const viewport = window.visualViewport;

    const onFocusIn = (event: FocusEvent) => {
      if (!isEditableTarget(event.target)) {
        return;
      }

      editableFocusedRef.current = true;
      restingViewportBottomRef.current = Math.max(
        restingViewportBottomRef.current,
        visibleViewportBottom(),
      );
      scheduleSync();
    };

    const onFocusOut = () => {
      editableFocusedRef.current = false;

      window.setTimeout(() => {
        if (!editableFocusedRef.current) {
          setComposerBottom(safeGapRef.current);
          restingViewportBottomRef.current = Math.max(
            restingViewportBottomRef.current,
            visibleViewportBottom(),
          );
        }
      }, 80);
    };

    const onViewportChange = () => {
      scheduleSync();
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    viewport?.addEventListener('resize', onViewportChange);
    viewport?.addEventListener('scroll', onViewportChange);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      viewport?.removeEventListener('resize', onViewportChange);
      viewport?.removeEventListener('scroll', onViewportChange);

      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [scheduleSync]);

  return {
    composerBottom,
    keyboardVisible:
      composerBottom > safeGapRef.current + 1,
    clearComposerInset: clearInset,
    resyncComposerInset: scheduleSync,
  };
}
