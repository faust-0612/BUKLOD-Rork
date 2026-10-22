import React, {
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
  ConnectChatBackgroundPanel,
} from '@/components/connect/ConnectChatBackgroundEditor';
import {
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  type MessagesThemePreferenceId,
} from '@/lib/messagesTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import {
  useChatBackground,
} from '@/providers/ChatBackgroundProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    trigger: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentMuted,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
    },
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
      backgroundColor: theme.pickerSheet,
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
    tabRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    tab: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    tabActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    tabText: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    row: {
      minHeight: 58,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      backgroundColor: theme.surface,
    },
    rowActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.borderSubtle,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    description: {
      marginTop: 2,
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    bgRow: {
      minHeight: 54,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      backgroundColor: theme.surface,
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

type SheetTab = 'theme' | 'background';

type Props = {
  threadId?: string | null;
};

export function ConnectThemeSelectorButton({
  threadId,
}: Props = {}) {
  const {
    theme,
    messagesPreference,
    setMessagesPreference,
    options,
    followingGlobal,
    effectivePaletteId,
  } = useConnectTheme();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const { previewBackground } = useChatBackground();
  const [open, setOpen] =
    useState(false);
  const [tab, setTab] =
    useState<SheetTab>('theme');
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );

  const choose = (
    id: MessagesThemePreferenceId
  ) => {
    setMessagesPreference(id);
  };

  const activeId = messagesPreference;

  return (
    <>
      <ConnectPressable
        accessibilityRole="button"
        accessibilityLabel="Messages appearance"
        onPress={() => {
          setTab('theme');
          setOpen(true);
        }}
        style={styles.trigger}
      >
        <MaterialCommunityIcons
          name="palette-outline"
          size={21}
          color={theme.accent}
        />
      </ConnectPressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => {
          previewBackground(null);
          setOpen(false);
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            previewBackground(null);
            setOpen(false);
          }}
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
              Messages appearance
            </Text>
            <Text style={styles.sub}>
              {tab === 'background'
                ? 'Set a color, pattern, gradient, or photo for the whole Messages dashboard.'
                : followingGlobal
                  ? `Following global BUKLOD theme (${effectivePaletteId}). Override below for Messages only.`
                  : 'Messages override active — other BUKLOD sections keep their global theme.'}
            </Text>

            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setTab('theme')}
                style={[
                  styles.tab,
                  tab === 'theme' && styles.tabActive,
                ]}
              >
                <Text style={styles.tabText}>
                  Theme
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('background')}
                style={[
                  styles.tab,
                  tab === 'background' &&
                    styles.tabActive,
                ]}
              >
                <Text style={styles.tabText}>
                  Background
                </Text>
              </Pressable>
            </View>

            {tab === 'theme' ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {options.map(option => {
                  const active =
                    option.id === activeId;

                  return (
                    <ConnectPressable
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
                    </ConnectPressable>
                  );
                })}
              </ScrollView>
            ) : (
              <ConnectChatBackgroundPanel
                threadId={threadId}
              />
            )}

            <Pressable
              onPress={() => {
                previewBackground(null);
                setOpen(false);
              }}
              style={styles.close}
            >
              <Text style={styles.closeText}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
