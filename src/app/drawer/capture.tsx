import React, {
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SmartDrawerCapture() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode?: string | string[];
  }>();
  const modeRaw = Array.isArray(params.mode)
    ? params.mode[0]
    : params.mode;
  const mode = modeRaw === 'camera' ? 'camera' : 'scan';

  const [permission, requestPermission] =
    useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<any>(null);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.unsupported}>
        <MaterialCommunityIcons
          name="camera-outline"
          size={42}
          color="#0A6EBD"
        />
        <Text style={styles.unsupportedTitle}>
          Use BUKLOD on your phone for {mode === 'scan' ? 'Scan' : 'Camera'}.
        </Text>
        <Text style={styles.unsupportedText}>
          Web can still use Quick Note, search and browse safely.
        </Text>
        <Pressable
          onPress={() => router.replace('/drawer' as any)}
          style={styles.webButton}
        >
          <Text style={styles.webButtonText}>
            Back to Drawer
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.unsupported}>
        <ActivityIndicator color="#0A6EBD" />
        <Text style={styles.unsupportedText}>
          Checking camera permission…
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.unsupported}>
        <MaterialCommunityIcons
          name="camera-lock-outline"
          size={42}
          color="#0A6EBD"
        />
        <Text style={styles.unsupportedTitle}>
          Camera permission is needed
        </Text>
        <Text style={styles.unsupportedText}>
          Your existing Drawer items are unaffected.
        </Text>
        <Pressable
          onPress={() => void requestPermission()}
          style={styles.webButton}
        >
          <Text style={styles.webButtonText}>
            Allow Camera
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        skipProcessing: false,
      });

      if (!photo?.uri) return;

      router.replace({
        pathname: '/drawer/review',
        params: {
          source: mode,
          uri: photo.uri,
          width: String(photo.width ?? ''),
          height: String(photo.height ?? ''),
        },
      } as any);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.cameraScreen}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      <View
        style={[
          styles.topBar,
          { paddingTop: Math.max(insets.top, 10) },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={styles.cameraIconButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color="#FFFFFF"
          />
        </Pressable>

        <Text style={styles.cameraTitle}>
          {mode === 'scan' ? 'Scan Document' : 'Camera'}
        </Text>

        <View style={styles.cameraIconButton}>
          <MaterialCommunityIcons
            name={
              mode === 'scan'
                ? 'file-document-outline'
                : 'camera-outline'
            }
            size={21}
            color="#FFFFFF"
          />
        </View>
      </View>

      {mode === 'scan' && (
        <View pointerEvents="none" style={styles.scanGuide}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.scanHint}>
            Keep the notice or document inside the frame.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 18) },
        ]}
      >
        <Text style={styles.modeLabel}>
          {mode === 'scan'
            ? 'Document'
            : 'Photo'}
        </Text>

        <Pressable
          disabled={busy}
          onPress={() => void capture()}
          accessibilityRole="button"
          accessibilityLabel="Capture"
          style={styles.shutterOuter}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>

        <View style={{ width: 62 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    minHeight: 70,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.56)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  cameraIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
  },
  scanGuide: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  scanFrame: {
    width: '100%',
    aspectRatio: 0.78,
    maxHeight: '62%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#FFFFFF',
  },
  tl: {
    left: -2,
    top: -2,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: 10,
  },
  tr: {
    right: -2,
    top: -2,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: 10,
  },
  bl: {
    left: -2,
    bottom: -2,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 10,
  },
  br: {
    right: -2,
    bottom: -2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 10,
  },
  scanHint: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 11,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 142,
    backgroundColor: 'rgba(0,0,0,0.76)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
  },
  modeLabel: {
    width: 62,
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  unsupported: {
    flex: 1,
    backgroundColor: '#F5F9FD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  unsupportedTitle: {
    marginTop: 12,
    color: '#173B63',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  unsupportedText: {
    marginTop: 7,
    color: '#6D8397',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  webButton: {
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: '#0A6EBD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  cancelButton: {
    marginTop: 10,
    padding: 10,
  },
  cancelText: {
    color: '#0A6EBD',
    fontWeight: '900',
  },
});
