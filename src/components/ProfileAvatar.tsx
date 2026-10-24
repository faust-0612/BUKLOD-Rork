import { Image as ExpoImage } from 'expo-image';
import {
  useEffect,
  useState,
} from 'react';

import {
  Text,
  View,
} from 'react-native';

import {
  usePathname,
} from 'expo-router';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';


type AvatarCacheRow = {
  url: string | null;
  at: number;
};

const avatarCache =
  new Map<
    string,
    AvatarCacheRow
  >();


type ProfileAvatarProps = {
  userId?:
    | string
    | null;

  uri?:
    | string
    | null;

  name?:
    | string
    | null;

  size?: number;

  fallbackSource?:
    | number
    | { uri: string }
    | null;
};


export function ProfileAvatarStatusIndicator({
  userId,
  size = 38,
}: {
  userId?:
    | string
    | null;

  size?: number;
}) {
  const pathname =
    usePathname();

  const [
    quickNote,
    setQuickNote,
  ] =
    useState('');


  useEffect(() => {
    let active = true;

    void (
      async () => {
        let targetUserId =
          userId ??
          null;

        if (!targetUserId) {
          const {
            data: authData,
            error: authError,
          } =
            await supabase.auth.getUser();

          if (
            !active ||
            authError
          ) {
            return;
          }

          targetUserId =
            authData.user?.id ??
            null;
        }

        if (!targetUserId) {
          if (active) {
            setQuickNote('');
          }

          return;
        }

        const {
          data,
          error,
        } =
          await (
            supabase as any
          )
            .from(
              'buklod_profile_status'
            )
            .select(
              'quick_note'
            )
            .eq(
              'user_id',
              targetUserId
            )
            .maybeSingle();

        if (!active) {
          return;
        }

        if (error) {
          console.warn(
            'Profile Note:',
            error.message
          );

          setQuickNote('');
          return;
        }

        setQuickNote(
          String(
            data?.quick_note ??
            ''
          ).trim()
        );
      }
    )();

    return () => {
      active = false;
    };
  }, [
    userId,
    pathname,
  ]);


  if (!quickNote) {
    return null;
  }


  return (
    <View
      pointerEvents="none"
      style={{
        position:
          'absolute',

        right:
          -4,

        bottom:
          -4,

        zIndex:
          40,

        minWidth:
          Math.max(
            18,
            size * 0.34
          ),

        height:
          Math.max(
            18,
            size * 0.34
          ),

        paddingHorizontal:
          4,

        borderRadius:
          999,

        alignItems:
          'center',

        justifyContent:
          'center',

        borderWidth:
          1.5,

        borderColor:
          '#FFFFFF',

        backgroundColor:
          colors.greenDark,
      }}
    >
      <Text
        style={{
          color:
            '#FFFFFF',

          fontSize:
            Math.max(
              8,
              size * 0.14
            ),

          fontWeight:
            '900',
        }}
      >
        N
      </Text>
    </View>
  );
}

function normalizeAvatarUrl(
  raw: string | null | undefined
) {
  const value = String(raw ?? '').trim();
  if (!value) {
    return null;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const objectPath = value
    .replace(/^\/+/, '')
    .replace(/^profile-avatars\//i, '')
    .split('?')[0];
  if (!objectPath) {
    return null;
  }
  const { data: publicData } = supabase.storage
    .from('profile-avatars')
    .getPublicUrl(objectPath);
  return publicData?.publicUrl ?? null;
}

export function ProfileAvatar({
  userId,
  uri,
  name,
  size = 38,
  fallbackSource,
}: ProfileAvatarProps) {
  const [remoteUrl, setRemoteUrl] = useState<string | null>(
    normalizeAvatarUrl(uri)
  );
  const [imageFailed, setImageFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    let active = true;
    setImageFailed(false);

    const directUri = normalizeAvatarUrl(uri);
    if (directUri) {
      setRemoteUrl(current =>
        current === directUri ? current : directUri
      );
      return () => {
        active = false;
      };
    }

    if (userId) {
      const cached = avatarCache.get(userId);
      if (cached?.url && active) {
        setRemoteUrl(current =>
          current === cached.url ? current : cached.url
        );
      }

      const { data: canonicalData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(`${userId}/avatar.jpg`);
      const canonicalUrl = canonicalData?.publicUrl ?? null;
      if (canonicalUrl && active) {
        avatarCache.set(userId, {
          url: canonicalUrl,
          at: Date.now(),
        });
        setRemoteUrl(current =>
          current === canonicalUrl ? current : canonicalUrl
        );
      }
    } else if (active) {
      setRemoteUrl(null);
    }

    return () => {
      active = false;
    };
  }, [userId, uri]);

  const initial = (name?.trim()?.[0] || 'B').toUpperCase();

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.greenSoft,
  };

  const placeholder = fallbackSource ? (
    <ExpoImage
      source={fallbackSource}
      style={circleStyle}
      contentFit="cover"
      cachePolicy="memory-disk"
    />
  ) : (
    <View
      style={{
        ...circleStyle,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: Math.max(11, size * 0.38),
          fontWeight: '900',
          color: colors.greenDark,
        }}
      >
        {initial}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        width: size,
        height: size,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {placeholder}
      {remoteUrl && !imageFailed ? (
        <ExpoImage
          source={{
            uri: remoteUrl,
            cacheKey: remoteUrl,
          }}
          style={{
            ...circleStyle,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={userId || remoteUrl || undefined}
          transition={0}
          onLoad={() => {
            setImageReady(true);
          }}
          onError={() => {
            void (async () => {
              let fallback = normalizeAvatarUrl(uri);
              if (fallback === remoteUrl) {
                fallback = null;
              }

              if (!fallback && userId) {
                try {
                  const { data: rpcData, error: rpcError } = await (
                    supabase as any
                  ).rpc('get_buklod_profile_avatars_v1', {
                    p_user_ids: [userId],
                  });
                  if (!rpcError) {
                    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
                    fallback = normalizeAvatarUrl(row?.avatar_url);
                  }
                } catch {
                  fallback = null;
                }
              }

              if (!fallback && userId) {
                try {
                  const { data: profileRow, error: profileError } = await (
                    supabase as any
                  )
                    .from('profiles')
                    .select('avatar_url')
                    .eq('id', userId)
                    .maybeSingle();
                  if (!profileError) {
                    fallback = normalizeAvatarUrl(profileRow?.avatar_url);
                  }
                } catch {
                  fallback = null;
                }
              }

              if (fallback && fallback !== remoteUrl) {
                setImageFailed(false);
                setImageReady(false);
                setRemoteUrl(fallback);
                return;
              }

              setImageFailed(true);
            })();
          }}
        />
      ) : null}

      <ProfileAvatarStatusIndicator
        userId={userId}
        size={size}
      />
    </View>
  );
}


export function ConnectConversationAvatar({
  conversationId,
  name,
  size = 40,
}: {
  conversationId?:
    | string
    | null;

  name?:
    | string
    | null;

  size?: number;
}) {

  const [
    otherUserId,
    setOtherUserId,
  ] =
    useState<
      string | null
    >(null);


  useEffect(() => {
    let active = true;

    if (
      !conversationId
    ) {
      setOtherUserId(
        null
      );

      return () => {
        active = false;
      };
    }


    void (
      async () => {
        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'get_connect_conversation_info_v2',
            {
              p_conversation_id:
                conversationId,
            }
          );

        if (
          !active ||
          error
        ) {
          return;
        }

        const row =
          Array.isArray(data)
            ? data[0]
            : data;

        setOtherUserId(
          row?.other_user_id ??
          null
        );
      }
    )();


    return () => {
      active = false;
    };
  }, [
    conversationId,
  ]);


  return (
    <ProfileAvatar
      userId={
        otherUserId
      }
      name={name}
      size={size}
    />
  );
}