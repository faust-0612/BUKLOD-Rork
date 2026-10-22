import React, { useState } from 'react';

import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import BuklodCharacterStage from '@/components/points/BuklodCharacterStage';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';

type Props = React.ComponentProps<typeof BuklodCharacterStage>;

/** Compact character preview — tap to open an enlarged review overlay. */
export default function BuklodCharacterTappablePreview(props: Props) {
  const { theme } = useBuklodPresentation();
  const { width: screenWidth } = useWindowDimensions();
  const [enlarged, setEnlarged] = useState(false);
  const enlargedWidth = Math.min(screenWidth - 48, 360);

  const close = () => setEnlarged(false);

  return (
    <>
      <Pressable
        onPress={() => setEnlarged(true)}
        accessibilityRole="button"
        accessibilityLabel="View character preview"
        accessibilityHint="Opens enlarged character preview"
        style={({ pressed }) => [pressed && styles.previewPressed]}
      >
        <BuklodCharacterStage {...props} />
        <View
          pointerEvents="none"
          style={[
            styles.expandHint,
            {
              backgroundColor: withAlpha(theme.surface, 0.78),
              borderColor: withAlpha(theme.border, 0.55),
            },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify-plus-outline"
            size={13}
            color={theme.textSecondary}
          />
        </View>
      </Pressable>

      <Modal
        visible={enlarged}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable
          style={[styles.overlay, { backgroundColor: theme.overlay }]}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close character preview"
        >
          <Pressable
            style={styles.enlargedFrame}
            onPress={(event) => event.stopPropagation()}
          >
            <Pressable
              onPress={close}
              hitSlop={BUKLOD_HIT_SLOP}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: withAlpha(theme.surface, 0.9),
                  borderColor: withAlpha(theme.border, 0.6),
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={theme.textMuted}
              />
            </Pressable>

            <BuklodCharacterStage
              {...props}
              compact={false}
              stageWidth={enlargedWidth}
              showStageLabel={props.showStageLabel ?? true}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  previewPressed: {
    opacity: 0.92,
  },
  expandHint: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  enlargedFrame: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
