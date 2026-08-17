import { StyleSheet, Text, View } from 'react-native';
import { appEnvironment, isStaging } from '@/lib/environment';

export function EnvironmentBadge() {
  if (!isStaging) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>
        {appEnvironment.toUpperCase()} BUILD • TEST DATA ONLY
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    backgroundColor: '#FFF3D6',
    borderWidth: 1,
    borderColor: '#D99A00',
  },
  text: {
    color: '#7A4D00',
    fontSize: 10,
    fontWeight: '900',
  },
});
