import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  CLASSROOM_THEME_OPTIONS,
  type ClassroomTheme,
  type ClassroomThemeId,
} from '@/lib/education/classroomTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  classroomId: string;
  classroomName: string;
  role: 'FACULTY' | 'STUDENT' | string;
  theme: ClassroomTheme;
  themeId: ClassroomThemeId;
  onThemeChange: (themeId: ClassroomThemeId) => void;
};

type DrawerItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: string;
  roles?: string[];
};

const ITEMS: DrawerItem[] = [
  { key: 'home', label: 'Classroom Home', icon: 'view-dashboard-outline', route: '/profile/buklod-classroom' },
  { key: 'discuss', label: 'Discussions', icon: 'forum-outline', route: '/profile/buklod-classroom-discuss' },
  { key: 'chat', label: 'Class Messages', icon: 'message-text-outline', route: '/profile/buklod-classroom-chat' },
  { key: 'work', label: 'Activities', icon: 'clipboard-text-outline', route: '/profile/buklod-classroom-work' },
  { key: 'materials', label: 'Materials', icon: 'bookshelf', route: '/profile/buklod-classroom-materials' },
  { key: 'attendance', label: 'Attendance', icon: 'calendar-check-outline', route: '/profile/buklod-classroom-attendance', roles: ['STUDENT'] },
  { key: 'grades', label: 'My Grades', icon: 'school-outline', route: '/profile/buklod-classroom-grades', roles: ['STUDENT'] },
  { key: 'student-plus', label: 'Student Plus', icon: 'star-four-points-outline', route: '/profile/buklod-classroom-student-plus', roles: ['STUDENT'] },
  { key: 'monitor', label: 'Class Monitor', icon: 'chart-timeline-variant-shimmer', route: '/profile/buklod-classroom-monitor' },
  { key: 'faculty', label: 'Faculty Command Center', icon: 'human-male-board', route: '/profile/buklod-faculty-class', roles: ['FACULTY'] },
];

export function ClassroomDrawer({
  visible,
  onClose,
  classroomId,
  classroomName,
  role,
  theme,
  themeId,
  onThemeChange,
}: Props) {
  const slide = useRef(new Animated.Value(-360)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(-360);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        damping: 19,
        stiffness: 190,
        mass: 0.9,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, slide, visible]);

  const allowedItems = useMemo(
    () => ITEMS.filter(item => !item.roles || item.roles.includes(role)),
    [role]
  );

  const open = (route: string) => {
    onClose();
    router.push({
      pathname: route as any,
      params: { id: classroomId, classroomId, name: classroomName },
    });
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, StyleSheet.absoluteFill, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: theme.drawer,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={[styles.logo, { backgroundColor: theme.accent }]}>
              <MaterialCommunityIcons name="book-open-page-variant-outline" size={23} color={theme.drawer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: theme.accent }]}>BUKLOD CLASSROOM</Text>
              <Text numberOfLines={2} style={[styles.className, { color: theme.drawerInk }]}>{classroomName}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close}>
              <MaterialCommunityIcons name="close" size={22} color={theme.drawerInk} />
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.muted }]}>MOVE AROUND</Text>
          <View style={styles.menu}>
            {allowedItems.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={() => open(item.route)}
                style={({ pressed }) => [
                  styles.menuItem,
                  index % 3 === 1 && styles.menuItemInset,
                  { borderColor: `${theme.drawerInk}1A` },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${theme.drawerInk}12` }]}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.key === 'student-plus' ? theme.accent : theme.drawerInk} />
                </View>
                <Text style={[styles.menuText, { color: item.key === 'student-plus' ? theme.accent : theme.drawerInk }]}>{item.label}</Text>
                <MaterialCommunityIcons name="arrow-top-right" size={16} color={`${theme.drawerInk}88`} />
              </Pressable>
            ))}
          </View>

          <View style={styles.themeHeader}>
            <View>
              <Text style={[styles.sectionLabel, { color: theme.muted }]}>CLASSROOM LOOK</Text>
              <Text style={[styles.themeName, { color: theme.drawerInk }]}>{theme.name}</Text>
            </View>
            <MaterialCommunityIcons name="palette-outline" size={22} color={theme.accent} />
          </View>

          <View style={styles.themeGrid}>
            {CLASSROOM_THEME_OPTIONS.map(option => {
              const active = option.id === themeId;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => onThemeChange(option.id)}
                  style={[
                    styles.themeCard,
                    { borderColor: active ? option.accent : `${theme.drawerInk}1A` },
                    active && { borderWidth: 2 },
                  ]}
                >
                  <View style={styles.swatches}>
                    <View style={[styles.swatch, { backgroundColor: option.primary }]} />
                    <View style={[styles.swatch, { backgroundColor: option.secondary }]} />
                    <View style={[styles.swatch, { backgroundColor: option.accent }]} />
                  </View>
                  <Text style={[styles.themeCardTitle, { color: theme.drawerInk }]}>{option.name}</Text>
                  <Text numberOfLines={2} style={[styles.themeCaption, { color: theme.muted }]}>{option.caption}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.footer, { borderTopColor: `${theme.drawerInk}18` }]}>
            <MaterialCommunityIcons name="gesture-tap" size={18} color={theme.accent} />
            <Text style={[styles.footerText, { color: theme.muted }]}>Drawer navigation • classroom-only theme • Student Plus never blocks core class access</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.52)' },
  drawer: { width: '86%', maxWidth: 390, height: '100%', paddingTop: 46, paddingHorizontal: 18, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 24 },
  logo: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  className: { fontSize: 18, fontWeight: '900', lineHeight: 21, marginTop: 2 },
  close: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  menu: { marginTop: 8 },
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 7 },
  menuItemInset: { marginLeft: 14 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuText: { flex: 1, fontSize: 13, fontWeight: '800' },
  themeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 9 },
  themeName: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeCard: { width: '48%', borderWidth: 1, borderRadius: 13, padding: 10 },
  swatches: { flexDirection: 'row', gap: 4, marginBottom: 7 },
  swatch: { width: 16, height: 16, borderRadius: 5 },
  themeCardTitle: { fontSize: 11, fontWeight: '900' },
  themeCaption: { fontSize: 8, lineHeight: 11, marginTop: 2 },
  footer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 'auto', paddingTop: 14 },
  footerText: { flex: 1, fontSize: 9, lineHeight: 13 },
});
