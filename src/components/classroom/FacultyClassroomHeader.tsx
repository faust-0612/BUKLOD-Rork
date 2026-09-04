import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { ClassroomDrawer } from '@/components/classroom/ClassroomDrawer';
import type { ClassroomTheme, ClassroomThemeId } from '@/lib/education/classroomTheme';

type Props = {
  classroomId: string;
  classroomName: string;
  kicker: string;
  title: string;
  subtitle: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  theme: ClassroomTheme;
  themeId: ClassroomThemeId;
  onThemeChange: (themeId: ClassroomThemeId) => void;
};

export function FacultyClassroomHeader({
  classroomId,
  classroomName,
  kicker,
  title,
  subtitle,
  icon = 'human-male-board',
  theme,
  themeId,
  onThemeChange,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => setDrawerOpen(true)}
          style={[styles.squareButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
        >
          <MaterialCommunityIcons name="menu" size={22} color={theme.ink} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={[styles.topKicker, { color: theme.muted }]}>FACULTY DESK</Text>
          <Text numberOfLines={1} style={[styles.topName, { color: theme.ink }]}>{classroomName}</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[styles.squareButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={theme.ink} />
        </Pressable>
      </View>

      <LinearGradient colors={[theme.heroStart, theme.heroEnd]} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons name={icon} size={24} color={theme.drawer} />
          </View>
          <View style={[styles.badge, { borderColor: `${theme.drawerInk}44` }]}>
            <View style={[styles.badgeDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.badgeText, { color: theme.drawerInk }]}>FACULTY MODE</Text>
          </View>
        </View>
        <Text style={[styles.kicker, { color: theme.accent }]}>{kicker}</Text>
        <Text style={[styles.title, { color: theme.drawerInk }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: `${theme.drawerInk}C7` }]}>{subtitle}</Text>
      </LinearGradient>

      <ClassroomDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        classroomId={classroomId}
        classroomName={classroomName}
        role="FACULTY"
        theme={theme}
        themeId={themeId}
        onThemeChange={onThemeChange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  topCopy: { flex: 1 },
  topKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  topName: { fontSize: 16, fontWeight: '900', marginTop: 1 },
  squareButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 24, padding: 19, marginBottom: 17, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  heroIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 28, lineHeight: 31, fontWeight: '900', marginTop: 4 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 520 },
});