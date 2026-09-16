import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import BuklodCityDashboardR6 from '@/components/BuklodCityDashboardR6.web';

export default function BuklodCityWeb() {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open BUKLOD Home"
          hitSlop={8}
          onPress={() => router.push('/(tabs)/me' as any)}
          style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="home-outline" size={23} color="#245574" />
        </Pressable>
      </View>
      <View style={styles.content}>
        <BuklodCityDashboardR6 />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    minHeight: 46,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4EBF0',
  },
  homeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FA',
    borderWidth: 1,
    borderColor: '#D9E4EC',
  },
  pressed: { opacity: 0.72 },
  content: { flex: 1 },
});
