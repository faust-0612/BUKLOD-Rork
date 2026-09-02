import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  DEFAULT_DASHBOARD_THEME,
  type DashboardTheme,
} from '@/components/BuklodDashboardCustomizer';
import {
  ProfilePressable,
} from '@/components/BuklodProfileMotion';
import {
  PROFILE_SECTION_LABELS,
  type ProfileSectionLayout,
} from '@/lib/buklodProfileLayout';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

const ACCENT_PRESETS = [
  '#15803D',
  '#275D45',
  '#0F766E',
  '#1D4ED8',
  '#7C3AED',
  '#B45309',
  '#BE123C',
];

type Props = {
  visible: boolean;
  layout: ProfileSectionLayout[];
  dashboardTheme: DashboardTheme;
  onClose: () => void;
  onChangeLayout: (
    next: ProfileSectionLayout[]
  ) => void;
  onChangeDashboardTheme: (
    next: DashboardTheme
  ) => void;
  onEditCover?: () => void;
};

export function BuklodProfileCustomizeSheet({
  visible,
  layout,
  dashboardTheme,
  onClose,
  onChangeLayout,
  onChangeDashboardTheme,
  onEditCover,
}: Props) {
  const { theme } = useBuklodTheme();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [draft, setDraft] =
    useState<ProfileSectionLayout[]>(layout);
  const [accent, setAccent] = useState(
    dashboardTheme.accentColor ||
      theme.accent
  );

  useEffect(() => {
    if (visible) {
      setDraft(layout);
      setAccent(
        dashboardTheme.accentColor ||
          theme.accent
      );
    }
  }, [
    dashboardTheme.accentColor,
    layout,
    theme.accent,
    visible,
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: theme.overlay,
        },
        sheet: {
          maxHeight: '88%',
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
        },
        sub: {
          marginTop: 4,
          marginBottom: 14,
          color: theme.textMuted,
          fontSize: 13,
          lineHeight: 18,
        },
        sectionLabel: {
          marginTop: 10,
          marginBottom: 8,
          color: theme.textMuted,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.8,
        },
        row: {
          minHeight: 52,
          marginBottom: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 13,
          backgroundColor: theme.surface,
        },
        rowTitle: {
          flex: 1,
          color: theme.textPrimary,
          fontSize: 14,
          fontWeight: '800',
        },
        iconBtn: {
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          backgroundColor: theme.accentSoft,
        },
        swatchRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 8,
        },
        swatch: {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: theme.border,
        },
        close: {
          marginTop: 10,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        closeText: {
          color: theme.textMuted,
          fontSize: 14,
          fontWeight: '800',
        },
      }),
    [theme]
  );

  const applyLayout = (
    next: ProfileSectionLayout[]
  ) => {
    setDraft(next);
    onChangeLayout(next);
  };

  const move = (
    index: number,
    direction: -1 | 1
  ) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) {
      return;
    }

    const next = draft.slice();
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    applyLayout(next);
  };

  const toggle = (index: number) => {
    const next = draft.map((row, rowIndex) =>
      rowIndex === index
        ? { ...row, visible: !row.visible }
        : row
    );
    applyLayout(next);
  };

  const chooseAccent = (color: string) => {
    setAccent(color);
    onChangeDashboardTheme({
      ...dashboardTheme,
      accentColor: color,
      backgroundColor:
        dashboardTheme.backgroundColor ||
        DEFAULT_DASHBOARD_THEME.backgroundColor,
    });
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
          onPress={(event) =>
            event.stopPropagation()
          }
        >
          <View style={styles.handle} />
          <Text style={styles.title}>
            Customize Profile
          </Text>
          <Text style={styles.sub}>
            Section order and accent preview on this device.
            Cover uses your saved profile background.
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
          >
            {!!onEditCover && (
              <>
                <Text style={styles.sectionLabel}>
                  COVER
                </Text>
                <ProfilePressable
                  onPress={() => {
                    onEditCover();
                    onClose();
                  }}
                  style={styles.row}
                >
                  <View style={styles.iconBtn}>
                    <MaterialCommunityIcons
                      name="image-outline"
                      size={18}
                      color={theme.accent}
                    />
                  </View>
                  <Text style={styles.rowTitle}>
                    Change cover photo
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color={theme.textMuted}
                  />
                </ProfilePressable>
              </>
            )}

            <Text style={styles.sectionLabel}>
              ACCENT
            </Text>
            <View style={styles.swatchRow}>
              {ACCENT_PRESETS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => chooseAccent(color)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: color,
                      borderColor:
                        accent === color
                          ? theme.textPrimary
                          : theme.border,
                    },
                  ]}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>
              SECTIONS
            </Text>
            {draft.map((row, index) => (
              <View
                key={row.id}
                style={styles.row}
              >
                <Pressable
                  onPress={() => toggle(index)}
                  style={styles.iconBtn}
                >
                  <MaterialCommunityIcons
                    name={
                      row.visible
                        ? 'eye-outline'
                        : 'eye-off-outline'
                    }
                    size={18}
                    color={
                      row.visible
                        ? theme.accent
                        : theme.textMuted
                    }
                  />
                </Pressable>
                <Text style={styles.rowTitle}>
                  {PROFILE_SECTION_LABELS[row.id]}
                </Text>
                <Pressable
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                  style={[
                    styles.iconBtn,
                    index === 0 && {
                      opacity: 0.35,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chevron-up"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
                <Pressable
                  disabled={index === draft.length - 1}
                  onPress={() => move(index, 1)}
                  style={[
                    styles.iconBtn,
                    index === draft.length - 1 && {
                      opacity: 0.35,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={styles.close}
          >
            <Text style={styles.closeText}>
              Done
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
