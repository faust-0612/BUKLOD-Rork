import { Image as ExpoImage } from 'expo-image';
import {
  useEffect,
  useState,
  useRef,
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


import {
  avatarCache, hydrateAvatarCache, normalizeAvatarUrl,
  rememberAvatarUrl, resolveAvatarUrl,
} from '@/lib/buklodAvatarCache';

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

export function ProfileAvatar({
  userId,
  uri,
  name,
  size = 38,
  fallbackSource,
}: ProfileAvatarProps) {
  const [remoteUrl, setRemoteUrl] = useState<string | null>(
    normalizeAvatarUrl(uri) ?? (userId ? avatarCache.get(userId)?.url ?? null : null)
  );
  const [imageFailed, setImageFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  const avatarGeneration = useRef(0);
  const recoveryAttempted = useRef(false);
  useEffect(() => {
    const generation = ++avatarGeneration.current;
    const active = () => generation === avatarGeneration.current;
    recoveryAttempted.current = false;
    setImageFailed(false);
    setImageReady(false);
    const direct = normalizeAvatarUrl(uri);
    setRemoteUrl(direct ?? (userId ? avatarCache.get(userId)?.url ?? null : null));
    if (direct && userId) rememberAvatarUrl(userId, direct);
    if (!direct && userId) {
      void hydrateAvatarCache().then(async () => {
        const cached = avatarCache.get(userId);
        if (active() && cached?.url) setRemoteUrl(cached.url);
        const url = await resolveAvatarUrl(userId);
        if (active()) setRemoteUrl(url);
      }).catch(() => undefined);
    }
    return () => { ++avatarGeneration.current; };
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
            cacheKey: userId ? `avatar:${userId}:${remoteUrl}` : remoteUrl,
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
            if (!userId || recoveryAttempted.current) {
              setImageFailed(true);
              return;
            }
            recoveryAttempted.current = true;
            const generation = avatarGeneration.current;
            void resolveAvatarUrl(userId, true).then(fallback => {
              if (generation !== avatarGeneration.current) return;
              if (fallback && fallback !== remoteUrl) {
                setImageFailed(false);
                setImageReady(false);
                setRemoteUrl(fallback);
              } else setImageFailed(true);
            }).catch(() => {
              if (generation === avatarGeneration.current) setImageFailed(true);
            });
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