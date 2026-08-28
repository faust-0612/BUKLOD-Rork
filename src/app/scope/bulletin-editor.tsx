import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import * as ImagePicker
  from 'expo-image-picker';

import * as FileSystem
  from 'expo-file-system/legacy';

import {
  decode,
} from 'base64-arraybuffer';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import BuklodBulletinVideo
  from '@/components/BuklodBulletinVideo';

type ScopeRow = {
  scope_id: string;
  scope_type:
    | 'CLUSTER'
    | 'CHURCH'
    | string;
  name: string;
  is_admin?: boolean;
};

type PickedMedia = {
  uri: string;
  type:
    | 'image'
    | 'video';
  mimeType: string;
  fileName: string;
};

function extensionFor(
  fileName: string,
  mimeType: string,
  type: 'image' | 'video'
) {
  const name =
    fileName
      .split('?')[0]
      .trim();

  const ext =
    name.includes('.')
      ? name
          .split('.')
          .pop()
          ?.toLowerCase()
      : null;

  if (
    ext &&
    /^[a-z0-9]{2,5}$/.test(
      ext
    )
  ) {
    return ext;
  }

  if (
    mimeType ===
    'video/quicktime'
  ) {
    return 'mov';
  }

  if (
    mimeType.includes(
      'webm'
    )
  ) {
    return 'webm';
  }

  if (
    type ===
    'video'
  ) {
    return 'mp4';
  }

  if (
    mimeType.includes(
      'png'
    )
  ) {
    return 'png';
  }

  if (
    mimeType.includes(
      'webp'
    )
  ) {
    return 'webp';
  }

  return 'jpg';
}

export default function
ScopeBulletinEditor() {
  const params =
    useLocalSearchParams<{
      scopeId?:
        | string
        | string[];
    }>();

  const scopeId =
    Array.isArray(
      params.scopeId
    )
      ? params.scopeId[0]
      : params.scopeId;

  const [
    scope,
    setScope,
  ] =
    useState<
      ScopeRow | null
    >(null);

  const [
    bulletinId,
    setBulletinId,
  ] =
    useState<
      string | null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState('');

  const [
    body,
    setBody,
  ] =
    useState('');

  const [
    pinned,
    setPinned,
  ] =
    useState(false);

  const [
    existingMediaPath,
    setExistingMediaPath,
  ] =
    useState<
      string | null
    >(null);

  const [
    existingMediaKind,
    setExistingMediaKind,
  ] =
    useState<
      'image' |
      'video' |
      null
    >(null);

  const [
    existingMediaUrl,
    setExistingMediaUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    picked,
    setPicked,
  ] =
    useState<
      PickedMedia | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const previewType =
    picked?.type ??
    existingMediaKind;

  const previewUri =
    picked?.uri ??
    existingMediaUrl;

  const heading =
    useMemo(
      () =>
        scope
          ?.scope_type ===
        'CHURCH'
          ? 'Church Bulletin'
          : 'Cluster Bulletin',
      [
        scope
          ?.scope_type,
      ]
    );

  useEffect(() => {
    let active =
      true;

    const load =
      async () => {
        try {
          if (!scopeId) {
            throw new Error(
              'Missing scope.'
            );
          }

          const {
            data:
              scopeRows,
            error:
              scopeError,
          } =
            await (
              supabase as any
            ).rpc(
              'buklod_my_scopes'
            );

          if (scopeError) {
            throw scopeError;
          }

          const selected =
            (
              scopeRows ??
              []
            ).find(
              (
                item: ScopeRow
              ) =>
                item.scope_id ===
                scopeId
            ) as
              | ScopeRow
              | undefined;

          if (
            !selected ||
            ![
              'CLUSTER',
              'CHURCH',
            ].includes(
              selected.scope_type
            )
          ) {
            throw new Error(
              'This bulletin is available only to Cluster or Church communities.'
            );
          }

          if (
            !selected.is_admin
          ) {
            throw new Error(
              'Only the community admin can edit this bulletin.'
            );
          }

          if (!active) {
            return;
          }

          setScope(
            selected
          );

          const {
            data:
              rows,
            error:
              bulletinError,
          } =
            await supabase
              .from(
                'buklod_scope_bulletins'
              )
              .select(
                'id,title,body,is_pinned,media_path,media_kind'
              )
              .eq(
                'scope_id',
                scopeId
              )
              .order(
                'updated_at',
                {
                  ascending:
                    false,
                }
              )
              .limit(1);

          if (
            bulletinError
          ) {
            throw bulletinError;
          }

          const item =
            rows?.[0] ??
            null;

          if (
            item &&
            active
          ) {
            setBulletinId(
              item.id
            );
            setTitle(
              item.title ??
              ''
            );
            setBody(
              item.body ??
              ''
            );
            setPinned(
              Boolean(
                item.is_pinned
              )
            );
            setExistingMediaPath(
              item.media_path ??
              null
            );
            setExistingMediaKind(
              item.media_kind ??
              null
            );

            if (
              item.media_path
            ) {
              const {
                data:
                  signed,
              } =
                await supabase
                  .storage
                  .from(
                    'scope-bulletin-media'
                  )
                  .createSignedUrl(
                    item.media_path,
                    3600
                  );

              if (active) {
                setExistingMediaUrl(
                  signed
                    ?.signedUrl ??
                  null
                );
              }
            }
          }
        } catch (
          error
        ) {
          Alert.alert(
            'Bulletin',
            String(
              (
                error as any
              )?.message ??
              error
            ),
            [
              {
                text: 'OK',
                onPress: () =>
                  router.back(),
              },
            ]
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    void load();

    return () => {
      active =
        false;
    };
  }, [scopeId]);

  const pickMedia =
    async () => {
      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'Media',
          'Please allow photo and video access first.'
        );
        return;
      }

      const result =
        await ImagePicker
          .launchImageLibraryAsync({
            mediaTypes:
              [
                'images',
                'videos',
              ] as any,
            allowsMultipleSelection:
              false,
            quality: 0.88,
            videoMaxDuration:
              180,
          });

      if (
        result.canceled ||
        !result.assets?.[0]
      ) {
        return;
      }

      const asset =
        result.assets[0];

      const type:
        | 'image'
        | 'video' =
          asset.type ===
          'video'
            ? 'video'
            : 'image';

      setPicked({
        uri: asset.uri,
        type,
        mimeType:
          asset.mimeType ??
          (
            type ===
            'video'
              ? 'video/mp4'
              : 'image/jpeg'
          ),
        fileName:
          asset.fileName ??
          (
            type ===
            'video'
              ? 'bulletin.mp4'
              : 'bulletin.jpg'
          ),
      });
    };

  const save =
    async () => {
      if (
        !scopeId ||
        !scope ||
        !scope.is_admin
      ) {
        return;
      }

      const cleanTitle =
        title.trim();

      const cleanBody =
        body.trim();

      if (
        !cleanTitle ||
        !cleanBody
      ) {
        Alert.alert(
          'Bulletin',
          'Title and message are required.'
        );
        return;
      }

      setSaving(true);

      try {
        const {
          data:
            authData,
          error:
            authError,
        } =
          await supabase
            .auth
            .getUser();

        if (
          authError ||
          !authData.user
        ) {
          throw (
            authError ??
            new Error(
              'Please sign in again.'
            )
          );
        }

        let mediaPath =
          existingMediaPath;

        let mediaKind =
          existingMediaKind;

        if (picked) {
          const base64 =
            await FileSystem
              .readAsStringAsync(
                picked.uri,
                {
                  encoding:
                    FileSystem
                      .EncodingType
                      .Base64,
                }
              );

          const extension =
            extensionFor(
              picked.fileName,
              picked.mimeType,
              picked.type
            );

          mediaPath =
            `${scopeId}/${Date.now()}-${authData.user.id}.${extension}`;

          mediaKind =
            picked.type;

          const {
            error:
              uploadError,
          } =
            await supabase
              .storage
              .from(
                'scope-bulletin-media'
              )
              .upload(
                mediaPath,
                decode(base64),
                {
                  contentType:
                    picked.mimeType,
                  upsert: false,
                }
              );

          if (
            uploadError
          ) {
            throw uploadError;
          }
        }

        const payload = {
          scope_id:
            scopeId,
          title:
            cleanTitle,
          body:
            cleanBody,
          is_pinned:
            pinned,
          media_path:
            mediaPath,
          media_kind:
            mediaKind,
          is_published:
            true,
          starts_at:
            new Date()
              .toISOString(),
          expires_at:
            null,
        };

        if (
          bulletinId
        ) {
          const {
            error,
          } =
            await supabase
              .from(
                'buklod_scope_bulletins'
              )
              .update(
                payload
              )
              .eq(
                'id',
                bulletinId
              );

          if (error) {
            throw error;
          }
        } else {
          const {
            error,
          } =
            await supabase
              .from(
                'buklod_scope_bulletins'
              )
              .insert({
                ...payload,
                created_by:
                  authData
                    .user.id,
              });

          if (error) {
            throw error;
          }
        }

        Alert.alert(
          'Bulletin',
          'Bulletin published.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.back(),
            },
          ]
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Bulletin',
          String(
            (
              error as any
            )?.message ??
            error
          )
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <View
        style={
          styles.loading
        }
      >
        <ActivityIndicator
          color={
            colors.green
          }
        />
      </View>
    );
  }

  if (
    !scope ||
    !scopeId
  ) {
    return null;
  }

  return (
    <BuklodScopedWorkspaceScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={
        styles.content
      }
    >
      <Text
        style={
          styles.eyebrow
        }
      >
        {scope.scope_type}
      </Text>

      <Text
        style={
          styles.title
        }
      >
        {heading}
      </Text>

      <Text
        style={
          styles.scopeName
        }
      >
        {scope.name}
      </Text>

      <TextInput
        value={title}
        onChangeText={
          setTitle
        }
        placeholder="Bulletin title"
        style={
          styles.input
        }
      />

      <TextInput
        value={body}
        onChangeText={
          setBody
        }
        placeholder="Write the bulletin..."
        multiline
        style={[
          styles.input,
          styles.bodyInput,
        ]}
      />

      <Pressable
        onPress={() =>
          setPinned(
            value =>
              !value
          )
        }
        style={[
          styles.toggle,
          pinned &&
            styles.toggleOn,
        ]}
      >
        <MaterialCommunityIcons
          name={
            pinned
              ? 'pin'
              : 'pin-outline'
          }
          size={20}
          color={
            colors.greenDark
          }
        />

        <Text
          style={
            styles.toggleText
          }
        >
          {pinned
            ? 'Pinned bulletin'
            : 'Pin this bulletin'}
        </Text>
      </Pressable>

      <Pressable
        onPress={
          pickMedia
        }
        style={
          styles.mediaButton
        }
      >
        <MaterialCommunityIcons
          name="image-multiple-outline"
          size={22}
          color={
            colors.greenDark
          }
        />

        <Text
          style={
            styles.mediaButtonText
          }
        >
          ADD / CHANGE IMAGE OR VIDEO
        </Text>
      </Pressable>

      {!!previewUri &&
        previewType ===
          'image' && (
        <Image
          source={{
            uri:
              previewUri,
          }}
          resizeMode="cover"
          style={
            styles.preview
          }
        />
      )}

      {!!previewUri &&
        previewType ===
          'video' && (
        <BuklodBulletinVideo
          uri={previewUri}
        />
      )}

      <Pressable
        disabled={
          saving
        }
        onPress={
          save
        }
        style={[
          styles.publish,
          saving && {
            opacity: 0.5,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator
            color={
              colors.white
            }
          />
        ) : (
          <Text
            style={
              styles.publishText
            }
          >
            PUBLISH BULLETIN
          </Text>
        )}
      </Pressable>
    </BuklodScopedWorkspaceScrollView>
  );
}

const styles =
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.background,
    },

    content: {
      padding: 20,
      paddingBottom: 40,
      backgroundColor:
        colors.background,
      minHeight: '100%',
    },

    eyebrow: {
      color:
        colors.green,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.9,
    },

    title: {
      marginTop: 4,
      color:
        colors.greenDark,
      fontSize: 26,
      fontWeight: '900',
    },

    scopeName: {
      marginTop: 4,
      marginBottom: 18,
      color:
        colors.muted,
      fontSize: 13,
      fontWeight: '800',
    },

    input: {
      minHeight: 48,
      paddingHorizontal: 13,
      paddingVertical: 11,
      marginBottom: 10,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 14,
      backgroundColor:
        colors.white,
      color:
        colors.text,
      fontSize: 14,
    },

    bodyInput: {
      minHeight: 150,
      textAlignVertical:
        'top',
    },

    toggle: {
      minHeight: 48,
      paddingHorizontal: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 14,
      backgroundColor:
        colors.white,
    },

    toggleOn: {
      borderColor:
        colors.green,
      backgroundColor:
        colors.greenSoft,
    },

    toggleText: {
      color:
        colors.text,
      fontWeight: '800',
    },

    mediaButton: {
      minHeight: 50,
      paddingHorizontal: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor:
        colors.green,
      borderRadius: 14,
      backgroundColor:
        colors.white,
    },

    mediaButtonText: {
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.3,
    },

    preview: {
      width: '100%',
      aspectRatio:
        16 / 9,
      borderRadius: 14,
      marginBottom: 12,
      backgroundColor:
        '#EEF1EF',
    },

    publish: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent:
        'center',
      borderRadius: 14,
      backgroundColor:
        colors.greenDark,
    },

    publishText: {
      color:
        colors.white,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
  });
