import React from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { useBuklodReduceMotion } from '@/components/HomeMotion';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export type BuklodNavigationContextAction = {
  id: string;
  title: string;
  icon: Icon;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  title: string;
  visible: boolean;
  actions: readonly BuklodNavigationContextAction[];
  onClose: () => void;
};

/** One reusable accessible contextual bottom sheet, never the only way to act. */
export default function BuklodNavigationContextSheet({
  title, visible, actions, onClose,
}: Props) {
  const { theme } = useBuklodTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useBuklodReduceMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss options"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, {
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: theme.surface,
            borderColor: theme.border,
          }]}
        >
          <View style={styles.header}>
            <Text allowFontScaling style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close options"
              onPress={onClose}
              style={styles.close}
            >
              <MaterialCommunityIcons name="close" size={23} color={theme.textMuted}/>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {actions.map(action => (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                style={({pressed}) => [
                  styles.action,
                  { backgroundColor: pressed ? theme.accentSoft : theme.surface },
                ]}
              >
                <MaterialCommunityIcons
                  name={action.icon}
                  size={21}
                  color={action.destructive ? '#AC3434' : theme.accent}
                />
                <Text
                  allowFontScaling
                  style={[styles.label, { color: action.destructive ? '#AC3434' : theme.textPrimary }]}
                >
                  {action.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.34)' },
  sheet: {
    maxHeight: '72%', paddingTop: 7, paddingHorizontal: 12,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1,
  },
  header: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, gap: 10,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  close: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 5, gap: 4 },
  action: {
    minHeight: 54, flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, gap: 12,
  },
  label: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: '700' },
});
