import React, {
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  type BuklodThemePreferenceId,
} from '@/lib/buklodTheme';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

function createSelectorStyles(
  theme: ReturnType<typeof useBuklodTheme>['theme']
) {
  return StyleSheet.create({
    row: {
      minHeight: 56,
      width: '48%',
      flexGrow: 1,
      paddingHorizontal: 9,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 13,
      backgroundColor: theme.surface,
    },
    rowActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    swatch: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.border,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    description: {
      marginTop: 2,
      color: theme.textMuted,
      fontSize: 11,
      lineHeight: 14,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.overlay,
    },
    sheet: {
      paddingTop: 8,
      paddingHorizontal: 16,
      paddingBottom: 24,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: theme.surfaceElevated,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      marginBottom: 12,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 17,
      fontWeight: '900',
      marginBottom: 4,
    },
    sub: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 14,
    },
    close: {
      marginTop: 6,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '800',
    },
  });
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function BuklodGlobalThemeSelectorModal({
  visible,
  onClose,
}: Props) {
  const {
    theme,
    preference,
    setPreference,
    options,
    paletteId,
  } = useBuklodTheme();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const { height: viewportHeight } = useWindowDimensions();
  const styles = useMemo(
    () => createSelectorStyles(theme),
    [theme]
  );

  const choose = (
    id: BuklodThemePreferenceId
  ) => {
    setPreference(id);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: drawerBottomInset + 12 },
          ]}
          onPress={event =>
            event.stopPropagation()
          }
        >
          <View style={styles.handle} />
          <Text style={styles.title}>
            BUKLOD appearance
          </Text>
          <Text style={styles.sub}>
            Global theme for Home, Community, Profile, and navigation.
            {preference === 'system'
              ? ` Currently following device (${paletteId}).`
              : ` Active: ${paletteId}.`}
            {' Messages can still use its own override when set.'}
          </Text>

          <ScrollView style={{ maxHeight: Math.max(180, Math.min(480, viewportHeight * 0.57)) }}
            nestedScrollEnabled keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingBottom: 8 }}>
          {options.map(option => {
            const active =
              option.id === preference;

            return (
              <Pressable
                key={option.id}
                onPress={() =>
                  choose(option.id)
                }
                style={[
                  styles.row,
                  active && styles.rowActive,
                ]}
              >
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor:
                        option.swatch,
                    },
                  ]}
                />
                <View style={styles.copy}>
                  <Text style={styles.label}>
                    {option.label}
                  </Text>
                  <Text
                    style={
                      styles.description
                    }
                  >
                    {option.description}
                  </Text>
                </View>
                {active && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={theme.accent}
                  />
                )}
              </Pressable>
            );
          })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={styles.close}
          >
            <Text style={styles.closeText}>
              Close
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Inline appearance block for Profile → My BUKLOD */
export function BuklodAppearanceSection() {
  const [open, setOpen] =
    useState(false);
  const {
    theme,
    preference,
    options,
    paletteId,
  } = useBuklodTheme();

  const activeLabel =
    options.find(
      option => option.id === preference
    )?.label ?? paletteId;

  const rowStyles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          minHeight: 54,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 7,
          paddingVertical: 7,
          marginVertical: 2,
          borderRadius: 13,
          gap: 6,
          backgroundColor: theme.surface,
        },
        icon: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          backgroundColor: theme.accentSoft,
        },
        title: {
          fontSize: 14.5,
          lineHeight: 18,
          fontWeight: '900',
          color: theme.textPrimary,
        },
        subtitle: {
          marginTop: 1,
          fontSize: 12.5,
          lineHeight: 18,
          color: theme.textMuted,
        },
      }),
    [theme]
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          rowStyles.row,
          pressed && { opacity: 0.72 },
        ]}
      >
        <View style={rowStyles.icon}>
          <MaterialCommunityIcons
            name="palette-outline"
            size={18}
            color={theme.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={rowStyles.title}>
            Appearance / Theme
          </Text>
          <Text style={rowStyles.subtitle}>
            {activeLabel}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.textMuted}
        />
      </Pressable>

      <BuklodGlobalThemeSelectorModal
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
