import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

export default function BuklodClassroomSettingsScreen() {
  const { signOut } = useAuth();

  const logout = async () => {
    await signOut();
    router.replace('/(auth)/login' as any);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>BUKLOD Classroom</Text>
      </Pressable>

      <Text style={styles.eyebrow}>APP & ACCOUNT</Text>
      <Text style={styles.title}>Classroom Settings</Text>
      <Text style={styles.subtitle}>Classroom-specific entry points for the shared BUKLOD account and privacy controls.</Text>

      <View style={styles.group}>
        <SettingRow icon="shield-account-outline" title="Account Security" subtitle="Password, recovery and account protection" onPress={() => router.push('/account/security' as any)} />
        <SettingRow icon="lock-outline" title="Privacy" subtitle="Review privacy information and consent" onPress={() => router.push('/privacy' as any)} />
        <SettingRow icon="delete-outline" title="Delete Account" subtitle="Open the shared BUKLOD account deletion flow" onPress={() => router.push('/delete-account' as any)} />
        <SettingRow icon="information-outline" title="About BUKLOD Classroom" subtitle="Application identity and purpose" onPress={() => router.push('/profile/buklod-classroom-about' as any)} />
      </View>

      <Pressable style={styles.logout} onPress={() => void logout()}>
        <MaterialCommunityIcons name="logout" size={20} color="#8a3131" />
        <Text style={styles.logoutText}>Sign out of BUKLOD Classroom</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingRow({ icon, title, subtitle, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={22} color="#1f7a3f" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#7b887f" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f6f1' },
  content: { padding: 20, paddingTop: 44, paddingBottom: 60 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#17311f', fontSize: 29, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#68736b', lineHeight: 19, marginTop: 5, marginBottom: 18 },
  group: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e4e9e5' },
  iconWrap: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: '#24362b', fontWeight: '900' },
  rowSubtitle: { color: '#6b776f', fontSize: 12, marginTop: 3 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 13, borderRadius: 14, backgroundColor: '#f7e9e9' },
  logoutText: { color: '#8a3131', fontWeight: '900' },
  pressed: { opacity: 0.82 },
});
