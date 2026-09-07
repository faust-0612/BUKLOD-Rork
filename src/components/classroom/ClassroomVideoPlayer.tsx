import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

export function ClassroomVideoPlayer({ uri, title, onClose }: { uri: string; title: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = false;
  });

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>Close</Text></Pressable>
      </View>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />
      <Text style={styles.note}>Authorized Classroom stream. Playback is on demand; closing this view stops the visible player.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: '#050806', justifyContent: 'center' },
  header: { position: 'absolute', left: 14, right: 14, top: 44, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: '#fff', fontWeight: '900' },
  close: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  closeText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  note: { color: 'rgba(255,255,255,0.66)', fontSize: 10, lineHeight: 15, marginTop: 10, paddingHorizontal: 18, textAlign: 'center' },
});
