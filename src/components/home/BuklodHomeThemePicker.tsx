import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  BUKLOD_HOME_THEMES,
  getBuklodHomeTheme,
  type BuklodHomeThemeId,
} from '@/lib/buklodHomeThemes';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function BuklodHomeThemePicker({
  visible,
  selectedThemeId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedThemeId: BuklodHomeThemeId;
  onSelect: (themeId: BuklodHomeThemeId) => void;
  onClose: () => void;
}) {
  const selected = getBuklodHomeTheme(selectedThemeId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: selected.palette.surface }]}> 
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: selected.palette.primary }]}>CUSTOMIZE HOME</Text>
              <Text style={[styles.title, { color: selected.palette.text }]}>Choose your house style</Text>
              <Text style={[styles.subtitle, { color: selected.palette.muted }]}>Same Home, same data and functions. Theme changes appearance only.</Text>
            </View>
            <Pressable onPress={onClose} style={[styles.close, { borderColor: selected.palette.border }]}>
              <MaterialCommunityIcons name="close" size={21} color={selected.palette.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {BUKLOD_HOME_THEMES.map((theme) => {
              const active = theme.id === selectedThemeId;
              return (
                <Pressable
                  key={theme.id}
                  onPress={() => onSelect(theme.id)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: theme.palette.wall,
                      borderColor: active ? theme.palette.primary : theme.palette.border,
                    },
                    active && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.preview, { backgroundColor: theme.palette.wallAlt }]}> 
                    <View style={[styles.previewWall, { backgroundColor: theme.palette.wall }]}>
                      <View style={[styles.previewPicture, { backgroundColor: theme.palette.primarySoft }]} />
                      <View style={[styles.previewLamp, { backgroundColor: theme.palette.glow }]} />
                    </View>
                    <View style={[styles.previewFloor, { backgroundColor: theme.palette.floor }]} />
                    <View style={[styles.previewSofa, { backgroundColor: theme.palette.surfaceStrong }]} />
                    <MaterialCommunityIcons
                      name={theme.icon as IconName}
                      size={20}
                      color={theme.palette.primary}
                      style={styles.previewIcon}
                    />
                  </View>

                  <View style={styles.optionCopy}>
                    <View style={styles.optionTitleRow}>
                      <Text style={[styles.optionTitle, { color: theme.palette.text }]}>{theme.label}</Text>
                      {active ? (
                        <View style={[styles.selectedBadge, { backgroundColor: theme.palette.primary }]}> 
                          <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                          <Text style={styles.selectedText}>ACTIVE</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.optionDescription, { color: theme.palette.muted }]}>{theme.description}</Text>
                    <View style={styles.swatches}>
                      {[theme.palette.primary, theme.palette.secondary, theme.palette.wallAlt, theme.palette.wood].map((color) => (
                        <View key={color} style={[styles.swatch, { backgroundColor: color }]} />
                      ))}
                    </View>
                  </View>
                </Pressable>
              );
            })}

            <View style={[styles.note, { backgroundColor: selected.palette.primarySoft, borderColor: selected.palette.border }]}> 
              <MaterialCommunityIcons name="shield-check-outline" size={19} color={selected.palette.primary} />
              <Text style={[styles.noteText, { color: selected.palette.text }]}>Themes never change Circle Points, Character level, Household data, routes, permissions, timers or saved Drawer items.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(13,22,32,0.48)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 22,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: '#A8B0B8',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 3, fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  close: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  list: { gap: 9, paddingBottom: 8 },
  option: {
    minHeight: 112,
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  optionActive: { borderWidth: 2 },
  pressed: { opacity: 0.8 },
  preview: {
    width: 104,
    height: 88,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  previewWall: { height: 59, padding: 8 },
  previewFloor: { height: 29 },
  previewPicture: { width: 30, height: 19, borderRadius: 5 },
  previewLamp: {
    position: 'absolute',
    right: 12,
    top: 13,
    width: 19,
    height: 19,
    borderRadius: 10,
  },
  previewSofa: {
    position: 'absolute',
    left: 21,
    bottom: 13,
    width: 61,
    height: 24,
    borderRadius: 9,
  },
  previewIcon: { position: 'absolute', left: 6, bottom: 5 },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionTitle: { flex: 1, fontSize: 13, fontWeight: '900' },
  optionDescription: { marginTop: 4, fontSize: 9.5, lineHeight: 13.5, fontWeight: '600' },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  selectedText: { color: '#FFFFFF', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.5 },
  swatches: { flexDirection: 'row', gap: 4, marginTop: 8 },
  swatch: { width: 19, height: 7, borderRadius: 999 },
  note: {
    marginTop: 3,
    borderRadius: 17,
    borderWidth: 1,
    padding: 11,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1, fontSize: 9.5, lineHeight: 14, fontWeight: '700' },
});
