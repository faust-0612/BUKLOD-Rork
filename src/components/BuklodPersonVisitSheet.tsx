import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  visitMemberProfile,
} from '@/lib/buklodMemberProfile';
import { withAlpha } from '@/lib/buklodContrast';
import { supabase } from '@/lib/supabase';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import {
  BuklodZoomablePhoto,
} from '@/components/BuklodZoomablePhoto';

type Props = {
  visible: boolean;
  userId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  onClose: () => void;
};

function canonicalPhotoUrl(
  userId?: string | null,
  uri?: string | null,
) {
  const direct = String(uri ?? '').trim();
  if (/^https?:\/\//i.test(direct)) {
    return direct;
  }

  const id = String(userId ?? '').trim();
  if (!id) {
    return null;
  }

  const { data } = supabase.storage
    .from('profile-avatars')
    .getPublicUrl(`${id}/avatar.jpg`);

  return data?.publicUrl ?? null;
}

export default function BuklodPersonVisitSheet({
  visible,
  userId,
  displayName,
  avatarUrl,
  onClose,
}: Props) {
  const { theme } = useBuklodTheme();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [photoOpen, setPhotoOpen] = React.useState(false);

  const id = String(userId ?? '').trim();
  const name = String(displayName ?? '').trim();
  const photoUrl = canonicalPhotoUrl(id, avatarUrl);
  const canViewPhoto = !!photoUrl;

  const closeAll = () => {
    setPhotoOpen(false);
    onClose();
  };

  const handleVisit = () => {
    if (!id) {
      return;
    }

    void Haptics.selectionAsync().catch(() => undefined);
    closeAll();
    visitMemberProfile(id, name);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={closeAll}
      >
        <Pressable
          style={[
            styles.backdrop,
            { backgroundColor: theme.overlay },
          ]}
          onPress={closeAll}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surfaceElevated,
                paddingBottom: drawerBottomInset + 8,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View
              style={[
                styles.handle,
                { backgroundColor: theme.border },
              ]}
            />

            {!!name && (
              <Text
                style={[
                  styles.sheetName,
                  { color: theme.textPrimary },
                ]}
              >
                {name}
              </Text>
            )}

            <Pressable
              disabled={!id}
              onPress={handleVisit}
              style={[
                styles.action,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: id ? 1 : 0.5,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionTitle,
                  { color: theme.textPrimary },
                ]}
              >
                Visit Profile
              </Text>
              <Text
                style={[
                  styles.actionSub,
                  { color: theme.textMuted },
                ]}
              >
                View this member&apos;s BUKLOD profile
              </Text>
            </Pressable>

            {canViewPhoto && (
              <Pressable
                onPress={() => {
                  onClose();
                  setPhotoOpen(true);
                }}
                style={[
                  styles.action,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.actionTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  View Profile Photo
                </Text>
              </Pressable>
            )}

            <Pressable onPress={closeAll} style={styles.cancel}>
              <Text
                style={[
                  styles.cancelText,
                  { color: theme.textMuted },
                ]}
              >
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={photoOpen}
        animationType="fade"
        onRequestClose={() => setPhotoOpen(false)}
      >
        <GestureHandlerRootView
          style={[
            styles.photoBackdrop,
            { backgroundColor: withAlpha(theme.overlay, 0.92) },
          ]}
        >
          {photoUrl ? (
            <BuklodZoomablePhoto uri={photoUrl} />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setPhotoOpen(false)}
            style={styles.photoClose}
          >
            <MaterialCommunityIcons
              name="close"
              size={26}
              color="#FFFFFF"
            />
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: 12,
    borderRadius: 2,
  },
  sheetName: {
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '800',
  },
  action: {
    minHeight: 52,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 13,
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionSub: {
    marginTop: 2,
    fontSize: 12,
  },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  photoBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  photoClose: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
