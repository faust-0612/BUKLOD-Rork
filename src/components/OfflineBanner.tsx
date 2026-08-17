import { StyleSheet, Text, View } from 'react-native';
import { useNetwork } from '@/providers/NetworkProvider';

export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetwork();
  const offline = !isConnected || isInternetReachable === false;
  if (!offline) return null;

  return (
    <View pointerEvents="none" style={styles.banner}>
      <Text style={styles.text}>Offline — saved online content may be unavailable. Changes will not be confirmed until connected.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    zIndex: 9999,
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#8A5600',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
});
