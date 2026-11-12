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
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { createBuklodAvatarBatchLookup } from '@/lib/buklodAvatarBatch';
import {
  getBuklodLiveAvatar,
  subscribeBuklodLiveAvatar,
} from '@/lib/buklodAvatarLive';

// A missing avatar is a normal state. Resolve real profile URLs in one
// bounded batch instead of probing guessed /avatar.jpg paths on every tile.
const avatarLookup = createBuklodAvatarBatchLookup(async (_viewerId, userIds) => {
  const { data, error } = await withBuklodTimeout<any>(
    (supabase as any).rpc('get_buklod_profile_avatars_v1', {
      p_user_ids: userIds,
    }),
    6_000,
    'Profile avatar batch',
  );
  if (error) throw error;
  return Array.isArray(data) ? data : [];
});

// Navigation should not issue one status RPC per mounted avatar. The result
// is presentation-only, scoped to the viewer, bounded, and refreshed quietly.
const STATUS_NOTE_TTL_MS = 60_000;
const STATUS_NOTE_MAX = 320;
const quickNoteCache = new Map<string, { note: string; at: number }>();
const quickNoteRequests = new Map<string, Promise<string>>();

function cachedQuickNote(viewerId: string, targetId: string): string {
  return quickNoteCache.get(`${viewerId}:${targetId}`)?.note ?? '';
}

async function readQuickNote(viewerId: string, targetId: string): Promise<string> {
  const key = `${viewerId}:${targetId}`;
  const warm = quickNoteCache.get(key);
  if (warm && Date.now() - warm.at < STATUS_NOTE_TTL_MS) {
    return warm.note;
  }

  const pending = quickNoteRequests.get(key);
  if (pending) return pending;

  const task = (async () => {
    const { data, error } = await (supabase as any)
      .from('buklod_profile_status')
      .select('quick_note')
      .eq('user_id', targetId)
      .maybeSingle();

    if (error) {
      // Weak signal is not proof that the note was removed.
      return warm?.note ?? '';
    }

    const note = String(data?.quick_note ?? '').trim();
    quickNoteCache.delete(key);
    quickNoteCache.set(key, { note, at: Date.now() });
    if (quickNoteCache.size > STATUS_NOTE_MAX) {
      const oldest = quickNoteCache.keys().next().value;
      if (oldest) quickNoteCache.delete(oldest);
    }
    return note;
  })();

  quickNoteRequests.set(key, task);
  try {
    return await task;
  } finally {
    if (quickNoteRequests.get(key) === task) quickNoteRequests.delete(key);
  }
}


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
  shape?: 'circle' | 'rounded';

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


  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const targetId = userId || viewerId;

  useEffect(() => {
    let active = true;
    if (!viewerId || !targetId) {
      setQuickNote('');
      return () => { active = false; };
    }
    setQuickNote(cachedQuickNote(viewerId, targetId));
    void readQuickNote(viewerId, targetId)
      .then(note => { if (active) setQuickNote(note); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [viewerId, targetId, pathname]);

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
  shape = 'circle',
  fallbackSource,
}: ProfileAvatarProps) {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const [remoteUrl, setRemoteUrl] = useState<string | null>(
    getBuklodLiveAvatar(userId) ?? normalizeAvatarUrl(uri)
  );
  const [imageFailed, setImageFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    let active = true;
    setImageFailed(false);
    setImageReady(false);

    const directUri = getBuklodLiveAvatar(userId) ?? normalizeAvatarUrl(uri);
    if (directUri) {
      setRemoteUrl(current =>
        current === directUri ? current : directUri
      );
      return () => {
        active = false;
      };
    }

    if (userId) {
      const warm = avatarLookup.peek(viewerId, userId);
      setRemoteUrl(warm.found ? normalizeAvatarUrl(warm.value) : null);
      void avatarLookup.resolve(viewerId, userId).then(resolved => {
        if (!active) return;
        if (resolved === undefined) {
          // Authentication or lookup may be temporarily unavailable. Keep
          // legacy canonical lookup as a fallback, but do not probe it for
          // users confirmed to have no stored avatar.
          const { data: fallbackData } = supabase.storage
            .from('profile-avatars')
            .getPublicUrl(`${userId}/avatar.jpg`);
          setRemoteUrl(fallbackData?.publicUrl ?? null);
          return;
        }
        setRemoteUrl(normalizeAvatarUrl(resolved));
      }).catch(() => undefined);
    } else if (active) {
      setRemoteUrl(null);
    }

    return () => {
      active = false;
    };
  }, [userId, uri, viewerId]);

  // Refresh every already-mounted avatar on this device immediately after
  // the profile owner saves a new version. Never ask for another network read.
  useEffect(() => {
    const currentId = String(userId ?? '').toLowerCase();
    if (!currentId) return;
    const latest = getBuklodLiveAvatar(currentId);
    if (latest) setRemoteUrl(latest);
    return subscribeBuklodLiveAvatar(change => {
      if (change.userId !== currentId) return;
      setImageFailed(false);
      setImageReady(false);
      setRemoteUrl(change.url);
    });
  }, [userId]);

  const initial = (name?.trim()?.[0] || 'B').toUpperCase();

  const circleStyle = {
    width: size,
    height: size,
    borderRadius: shape === 'rounded' ? Math.round(size * 0.2) : size / 2,
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
            // An identity-only cache key trapped the previous image bytes
            // even after the URL gained a fresh ?v= timestamp.
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
          recyclingKey={remoteUrl || userId || undefined}
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
