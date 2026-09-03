import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  classroomId: string;
  sessionId: string;
  classroomName: string;
  onExit: () => void;
};

export default function ClassroomLiveView({ classroomName, onExit }: Props) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{classroomName}</Text>
      <Text style={styles.text}>Live Classroom is available on the supported BUKLOD native app.</Text>
      <Pressable style={styles.button} onPress={onExit}><Text style={styles.buttonText}>Back to Classroom</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f2', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#17311f', fontWeight: '900', fontSize: 22 },
  text: { color: '#68746c', textAlign: 'center', marginTop: 8 },
  button: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11, marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '900' },
});
