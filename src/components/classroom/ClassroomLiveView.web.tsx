import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  classroomId: string;
  sessionId: string;
  classroomName: string;
  onExit: () => void;
};

export default function ClassroomLiveView({ classroomName, onExit }: Props) {
  return (
    <View style={styles.screen}>
      <MaterialCommunityIcons name="video-wireless-outline" size={52} color="#1f7a3f" />
      <Text style={styles.title}>{classroomName}</Text>
      <Text style={styles.text}>
        The full BUKLOD Classroom video room uses the native BUKLOD app for camera, microphone and presentation controls. Classroom discussions, messages, activities and materials remain available on web.
      </Text>
      <Pressable style={styles.primary} onPress={() => Linking.openURL('https://buklod.expo.app')}>
        <Text style={styles.primaryText}>Open BUKLOD</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={onExit}>
        <Text style={styles.secondaryText}>Back to Classroom</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f2', alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { color: '#17311f', fontSize: 24, fontWeight: '900', marginTop: 13, textAlign: 'center' },
  text: { color: '#66736b', lineHeight: 20, textAlign: 'center', maxWidth: 520, marginTop: 8 },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingHorizontal: 17, paddingVertical: 11, marginTop: 17 },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { paddingHorizontal: 17, paddingVertical: 11, marginTop: 7 },
  secondaryText: { color: '#526159', fontWeight: '900' },
});
