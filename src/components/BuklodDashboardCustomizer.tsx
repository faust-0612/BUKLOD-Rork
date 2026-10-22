import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

export type DashboardTheme = {
  backgroundColor: string;
  backgroundImage?: string | null;
  cardColor: string;
  accentColor: string;
  textColor: string;
};

type Props = {
  theme: DashboardTheme;
  canCustomize: boolean;
  onSave: (theme: DashboardTheme) => Promise<void> | void;
  onEditProfileBackground?: () => void;
};

const COLOR_PRESETS = [
  '#FFFFFF',
  '#F8FAFC',
  '#ECFDF5',
  '#EFF6FF',
  '#FFF7ED',
  '#FDF2F8',
  '#111827',
  '#0F172A',
  '#064E3B',
];

export const DEFAULT_DASHBOARD_THEME: DashboardTheme = {
  backgroundColor: '#F8FAFC',
  backgroundImage: null,
  cardColor: '#FFFFFF',
  accentColor: '#15803D',
  textColor: '#111827',
};

export function BuklodDashboardCustomizer({
  theme,
  canCustomize,
  onSave,
  onEditProfileBackground,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DashboardTheme>(theme);
  const [saving, setSaving] = useState(false);

  if (!canCustomize) return null;

  const save = async () => {
    try {
      setSaving(true);
      await onSave(draft);
      setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        style={styles.threeDots}
        hitSlop={BUKLOD_HIT_SLOP}
      >
        <MaterialCommunityIcons
          name="dots-vertical"
          size={25}
          color="#275D45"
        />
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.menu}>
            {!!onEditProfileBackground && (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  onEditProfileBackground();
                }}
              >
                <MaterialCommunityIcons
                  name="image-outline"
                  size={22}
                  color="#275D45"
                />

                <View>
                  <Text style={styles.menuTitle}>
                    Edit Profile Background
                  </Text>

                  <Text style={styles.menuSubtitle}>
                    Change your profile cover photo
                  </Text>
                </View>
              </Pressable>
            )}
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setDraft(theme);
                setMenuOpen(false);
                setEditorOpen(true);
              }}
            >
              <MaterialCommunityIcons
                  name="palette-outline"
                  size={22}
                  color="#275D45"
                />

              <View>
                <Text style={styles.menuTitle}>
                  Edit / Customize
                </Text>

                <Text style={styles.menuSubtitle}>
                  Background, cards and colors
                </Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={editorOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditorOpen(false)}
      >
        <View style={styles.editorOverlay}>
          <View style={styles.editor}>
            <View style={styles.editorHeader}>
              <View>
                <Text style={styles.editorTitle}>
                  Customize Dashboard
                </Text>

                <Text style={styles.editorSubtitle}>
                  Make this dashboard unique
                </Text>
              </View>

              <Pressable onPress={() => setEditorOpen(false)}>
                <MaterialCommunityIcons
                    name="close"
                    size={22}
                    color="#111827"
                  />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.editorBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionTitle}>
                Dashboard Background
              </Text>

              <View style={styles.colorGrid}>
                {COLOR_PRESETS.map(color => (
                  <Pressable
                    key={`bg-${color}`}
                    style={[
                      styles.colorCircle,
                      {
                        backgroundColor: color,
                        borderWidth:
                          draft.backgroundColor === color ? 3 : 1,
                      },
                    ]}
                    onPress={() =>
                      setDraft(current => ({
                        ...current,
                        backgroundColor: color,
                      }))
                    }
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>
                Custom Background Color
              </Text>

              <TextInput
                value={draft.backgroundColor}
                onChangeText={value =>
                  setDraft(current => ({
                    ...current,
                    backgroundColor: value,
                  }))
                }
                style={styles.input}
                placeholder="#F8FAFC"
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>
                Background Image URL
              </Text>

              <TextInput
                value={draft.backgroundImage ?? ''}
                onChangeText={value =>
                  setDraft(current => ({
                    ...current,
                    backgroundImage: value || null,
                  }))
                }
                style={styles.input}
                placeholder="https://..."
                autoCapitalize="none"
              />

              <Text style={styles.sectionTitle}>
                Card Color
              </Text>

              <View style={styles.colorGrid}>
                {COLOR_PRESETS.map(color => (
                  <Pressable
                    key={`card-${color}`}
                    style={[
                      styles.colorCircle,
                      {
                        backgroundColor: color,
                        borderWidth:
                          draft.cardColor === color ? 3 : 1,
                      },
                    ]}
                    onPress={() =>
                      setDraft(current => ({
                        ...current,
                        cardColor: color,
                      }))
                    }
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>
                Custom Card Color
              </Text>

              <TextInput
                value={draft.cardColor}
                onChangeText={value =>
                  setDraft(current => ({
                    ...current,
                    cardColor: value,
                  }))
                }
                style={styles.input}
                placeholder="#FFFFFF"
              />

              <Text style={styles.sectionTitle}>
                Accent Color
              </Text>

              <View style={styles.colorGrid}>
                {COLOR_PRESETS.map(color => (
                  <Pressable
                    key={`accent-${color}`}
                    style={[
                      styles.colorCircle,
                      {
                        backgroundColor: color,
                        borderWidth:
                          draft.accentColor === color ? 3 : 1,
                      },
                    ]}
                    onPress={() =>
                      setDraft(current => ({
                        ...current,
                        accentColor: color,
                      }))
                    }
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>
                Accent Color
              </Text>

              <TextInput
                value={draft.accentColor}
                onChangeText={value =>
                  setDraft(current => ({
                    ...current,
                    accentColor: value,
                  }))
                }
                style={styles.input}
              />

              <Text style={styles.sectionTitle}>
                Preview
              </Text>

              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor: draft.backgroundColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.previewCard,
                    {
                      backgroundColor: draft.cardColor,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 16,
                      color: draft.textColor,
                    }}
                  >
                    BUKLOD Dashboard
                  </Text>

                  <Text
                    style={{
                      marginTop: 5,
                      color: draft.textColor,
                      opacity: 0.7,
                    }}
                  >
                    This is how your cards will look.
                  </Text>

                  <View
                    style={[
                      styles.previewButton,
                      {
                        backgroundColor: draft.accentColor,
                      },
                    ]}
                  >
                    <Text style={styles.previewButtonText}>
                      Preview Button
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: draft.accentColor,
                  },
                ]}
                disabled={saving}
                onPress={save}
              >
                <Text style={styles.saveButtonText}>
                  {saving
                    ? 'Saving...'
                    : 'Save Dashboard Design'}
                </Text>
              </Pressable>

              <Pressable
                style={styles.resetButton}
                onPress={() =>
                  setDraft(DEFAULT_DASHBOARD_THEME)
                }
              >
                <Text style={styles.resetText}>
                  Reset to Default
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function DashboardBackground({
  theme,
  children,
  style,
}: {
  theme: DashboardTheme;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const content = (
    <View
      style={[
        styles.dashboardContainer,
        {
          backgroundColor: theme.backgroundColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!theme.backgroundImage) {
    return content;
  }

  return (
    <ImageBackground
      source={{ uri: theme.backgroundImage }}
      resizeMode="cover"
      style={styles.imageBackground}
    >
      {content}
    </ImageBackground>
  );
}

export function DashboardCard({
  theme,
  children,
  style,
}: {
  theme: DashboardTheme;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.dashboardCard,
        {
          backgroundColor: theme.cardColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  threeDots: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 21,
  },

  dots: {
    fontSize: 30,
    fontWeight: '900',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 16,
  },

  menu: {
    width: 245,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 7,
    elevation: 10,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 14,
  },

  menuIcon: {
    fontSize: 24,
  },

  menuTitle: {
    fontWeight: '800',
    fontSize: 15,
  },

  menuSubtitle: {
    fontSize: 11,
    marginTop: 2,
    color: '#6B7280',
  },

  editorOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  editor: {
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  editorTitle: {
    fontWeight: '900',
    fontSize: 21,
  },

  editorSubtitle: {
    fontSize: 12,
    marginTop: 3,
    color: '#6B7280',
  },

  close: {
    fontSize: 24,
  },

  editorBody: {
    paddingHorizontal: 0,
    paddingVertical: 6,
    paddingBottom: 50,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 6,
  },

  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  colorCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderColor: '#111827',
  },

  fieldLabel: {
    marginTop: 6,
    marginBottom: 6,
    fontWeight: '700',
    fontSize: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  preview: {
    borderRadius: 0,
    padding: 15,
  },

  previewCard: {
    borderRadius: 0,
    padding: 18,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  previewButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },

  previewButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  saveButton: {
    marginTop: 6,
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },

  resetButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },

  resetText: {
    color: '#DC2626',
    fontWeight: '800',
  },

  dashboardContainer: {
    flex: 1,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },

  imageBackground: {
    flex: 1,
  },

  dashboardCard: {
    borderRadius: 0,
    paddingLeft: 0,
    marginLeft: 0,
    paddingStart: 0,
    marginStart: 0,
  },
});