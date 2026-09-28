import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';

type Props = {
  placementId: string;
};

/**
 * BUKLOD_SUBMISSION_MONETIZATION_R1
 *
 * A normal layout ad before a completion/submission action. It disappears
 * while the keyboard is open to avoid layout shifts and accidental clicks.
 * Submission never depends on ad load, view, click, or completion.
 */
export default function BuklodSubmissionAdSlot({
  placementId,
}: Props) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardVisible) {
    return null;
  }

  return (
    <View style={styles.shell}>
      <BuklodAdMobBanner
        placement="submission"
        placementId={placementId}
        compact
        format="adaptive"
        requireViewport
        showLabel
      />
      <View pointerEvents="none" style={styles.safeGap} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginTop: 14,
    marginBottom: 8,
  },
  safeGap: {
    height: 18,
  },
});
