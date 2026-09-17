/* BUKLOD_SHARE_TARGET_187A */
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useIncomingShare } from '@/lib/buklodIncomingShare';

function hasIncomingVideo(incoming: any) {
  const resolved = incoming?.resolvedSharedPayloads ?? [];
  if (
    resolved.some(
      (row: any) =>
        row?.contentType === 'video' ||
        String(row?.contentMimeType ?? '').toLowerCase().startsWith('video/')
    )
  ) {
    return true;
  }

  const raw = incoming?.sharedPayloads ?? [];
  return raw.some(
    (row: any) =>
      row?.shareType === 'video' ||
      String(row?.mimeType ?? '').toLowerCase().startsWith('video/')
  );
}

export default function BuklodIncomingShareHandoff() {
  /* BUKLOD_WEB_SHARE_HANDOFF_R18B */
  useEffect(() => {
    if (Platform.OS === 'web') {
      router.replace('/(tabs)/buklod' as any);
    }
  }, []);

  const incoming = useIncomingShare();

  useEffect(() => {
    const hasPayload =
      (incoming.sharedPayloads?.length ?? 0) > 0 ||
      (incoming.resolvedSharedPayloads?.length ?? 0) > 0;

    if (!hasPayload) return;

    // Community Wall is text/photo-only. Shared video goes straight to the
    // canonical IGPAT creator while keeping the OS payload alive so IGPAT can
    // import the exact shared file, inspect duration/size, and let the user
    // review caption/audience before publishing.
    if (hasIncomingVideo(incoming)) {
      router.replace('/igpat/create?incomingShare=1' as any);
      return;
    }

    router.replace('/(tabs)/buklod' as any);
  }, [
    incoming.sharedPayloads,
    incoming.resolvedSharedPayloads,
  ]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" />
      <Text style={styles.title}>Opening Share to BUKLOD...</Text>
      <Text style={styles.copy}>
        Photos and text open in Community. Videos open in BUKLOD IGPAT. Nothing is published until you review and confirm it.
      </Text>

      {!!incoming.error && (
        <>
          <Text style={styles.error}>
            {String(incoming.error)}
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => incoming.refreshSharePayloads()}
          >
            <Text style={styles.buttonText}>TRY AGAIN</Text>
          </Pressable>
        </>
      )}

      <Pressable
        style={styles.cancel}
        onPress={() => {
          incoming.clearSharedPayloads();
          router.replace('/(tabs)/home' as any);
        }}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FAF7',
  },
  title: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '900',
    color: '#173D2B',
    textAlign: 'center',
  },
  copy: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#66756D',
    textAlign: 'center',
  },
  error: {
    marginTop: 16,
    fontSize: 12,
    color: '#8A2D2D',
    textAlign: 'center',
  },
  button: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#275D45',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  cancel: {
    marginTop: 16,
    padding: 10,
  },
  cancelText: {
    color: '#52655C',
    fontWeight: '800',
  },
});
