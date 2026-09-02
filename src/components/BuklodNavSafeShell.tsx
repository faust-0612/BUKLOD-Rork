import React, {
  useEffect,
  useState,
} from 'react';

import {
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import BuklodPersistentBottomNav from '@/components/BuklodPersistentBottomNav';
import {
  useBuklodPersistentNavOccupiedHeight,
} from '@/lib/buklodSafeArea';

/**
 * Root shell: shrinks routed content above the global bottom nav so door
 * screens and dashboard pushes never sit underneath the phone nav pane.
 */
export default function BuklodNavSafeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const navOccupied =
    useBuklodPersistentNavOccupiedHeight();
  const [keyboardVisible, setKeyboardVisible] =
    useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios'
        ? 'keyboardWillShow'
        : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios'
        ? 'keyboardWillHide'
        : 'keyboardDidHide';

    const showSub = Keyboard.addListener(
      showEvent,
      () => {
        setKeyboardVisible(true);
      }
    );
    const hideSub = Keyboard.addListener(
      hideEvent,
      () => {
        setKeyboardVisible(false);
      }
    );
    const didShowSub = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const didHideSub = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
      didShowSub.remove();
      didHideSub.remove();
    };
  }, []);

  const contentBottomInset =
    keyboardVisible ? 0 : navOccupied;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.content,
          {
            paddingBottom: contentBottomInset,
          },
        ]}
      >
        {children}
      </View>

      <View
        pointerEvents="box-none"
        style={styles.navOverlay}
      >
        <BuklodPersistentBottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  navOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
