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
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { repairMojibakeText } from '@/lib/repairMojibakeText';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { createBuklodAvatarBatchLookup } from '@/lib/buklodAvatarBatch';
import { getBuklodCircleRankArt } from '@/lib/buklodCircleRankArt';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  loadAvatarWeeklyClass,
  peekAvatarWeeklyClass,
  S2_WEEKLY_PERFORMANCE_STAGING_ONLY,
} from '@/lib/season2/buklodWeeklyPerformanceClientR1';
import {
  WEEKLY_CLASS_META, manilaWeekStart, type BuklodWeeklyClass,
} from '@/lib/season2/buklodWeeklyPerformanceRulesR1';
import { isBuklodAvatarOnline, subscribeBuklodAvatarPresence } from '@/lib/buklodAvatarPresence';
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

// Rank and profile avatars share the bounded, deduplicated 32-user batcher.
// This does NOT invent ranks from a null RPC response or write to user points.
const rankLookup = createBuklodAvatarBatchLookup(async (_viewerId, userIds) => {
  const { data, error } = await withBuklodTimeout<any>(
    (supabase as any).rpc('get_member_circle_ranks_v1', { p_user_ids: userIds }),
    6_000,
    'Circle rank badge batch',
  );
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: any) => ({
    user_id: row.user_id, avatar_url: row.rank_name,
  }));
}, { positiveTtlMs: 45_000, negativeTtlMs: 20_000 });

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

    const note = repairMojibakeText(String(data?.quick_note ?? '')).trim();
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
  /** Optional already verified rank from Wall/Connect, display until batch catches up. */
  rankName?: string | null;

  fallbackSource?:
    | number
    | { uri: string }
    | null;
};


/** 2 o'clock: Weekly Performance Class, not Connect Notes or weekly rank. */
export function ProfileAvatarStatusIndicator({
  userId,
  size = 38,
}: {
  userId?: string | null;
  size?: number;
}) {
  const pathname=usePathname();
  const {user}=useAuth();
  const viewerId=user?.id??'';
  const targetId=userId||viewerId;
  const identity=viewerId+':'+targetId+':'+manilaWeekStart();
  const [state,setState]=useState<{identity:string;value:BuklodWeeklyClass|null}>({
    identity:'',value:null,
  });
  useEffect(()=>{
    let active=true;
    if(!S2_WEEKLY_PERFORMANCE_STAGING_ONLY||!viewerId||!targetId){
      setState({identity:'',value:null});
      return ()=>{active=false;};
    }
    setState({identity,value:peekAvatarWeeklyClass(viewerId,targetId)});
    void loadAvatarWeeklyClass(viewerId,targetId)
      .then(value=>{if(active)setState({identity,value});})
      .catch(()=>undefined);
    return ()=>{active=false;};
  },[viewerId,targetId,identity,pathname]);
  const current=state.identity===identity?state.value:null;
  if(!current||current==='unrated'||!S2_WEEKLY_PERFORMANCE_STAGING_ONLY)return null;
  const meta=WEEKLY_CLASS_META[current];
  const px=Math.max(16,Math.min(25,Math.round(size*0.37)));
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={`Weekly performance: ${meta.title}`}
      style={{
        position:'absolute',top:-px*0.22,right:-px*0.22,zIndex:65,
        width:px,height:px,borderRadius:px/2,
        alignItems:'center',justifyContent:'center',
        borderWidth:Math.max(1.5,px*0.08),borderColor:'#FFFFFF',
        backgroundColor:meta.color,
      }}
    >
      <MaterialCommunityIcons name={meta.icon} size={Math.round(px*0.62)} color="#FFFFFF"/>
    </View>
  );
}


/** Readable avatar-adjacent Connect note in Community Wall post headers. */
export function ProfileAvatarNoteChip({ userId }: { userId?: string | null }) {
  const { user } = useAuth();
  const { theme } = useBuklodTheme();
  const viewerId = user?.id ?? '';
  const targetId = String(userId ?? '').trim();
  const [note, setNote] = useState(() =>
    viewerId && targetId ? cachedQuickNote(viewerId, targetId) : ''
  );
  useEffect(() => {
    let active = true;
    if (!viewerId || !targetId) {
      setNote('');
      return () => { active = false; };
    }
    setNote(cachedQuickNote(viewerId, targetId));
    void readQuickNote(viewerId, targetId)
      .then(value => { if (active) setNote(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [viewerId, targetId]);
  if (!note) return null;
  return (
    <View
      accessibilityLabel={`Connect note: ${note}`}
      style={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        marginTop: 4,
        marginBottom: 3,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surfaceElevated,
      }}
    >
      <Text numberOfLines={4} style={{
        color: theme.textPrimary,
        fontSize: 12.5,
        lineHeight: 17,
        fontWeight: '700',
      }}>
        {note}
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
  rankName,
}: ProfileAvatarProps) {
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const rankTargetId = userId || viewerId;
  const [rankCache, setRankCache] = useState<{ targetId: string; rankName: string | null }>({targetId: '', rankName: null});
  const [onlineCache, setOnlineCache] = useState<{ targetId: string; online: boolean }>({targetId: '', online: false});

  useEffect(() => {
    let active = true;
    if (!viewerId || !rankTargetId) {
      setRankCache({ targetId: '', rankName: null });
      return () => { active = false; };
    }
    const warm = rankLookup.peek(viewerId, rankTargetId);
    setRankCache({ targetId: rankTargetId, rankName: warm.found && getBuklodCircleRankArt(warm.value) ? warm.value : null });
    void rankLookup.resolve(viewerId, rankTargetId).then(value => {
      if (active && value !== undefined) {
        setRankCache({ targetId: rankTargetId, rankName: getBuklodCircleRankArt(value) ? value : null });
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [viewerId, rankTargetId]);

  useEffect(() => {
    if (!viewerId || !rankTargetId) {
      setOnlineCache({ targetId: '', online: false });
      return;
    }
    return subscribeBuklodAvatarPresence(viewerId, () => {
      setOnlineCache({ targetId: rankTargetId, online: isBuklodAvatarOnline(viewerId, rankTargetId) });
    });
  }, [viewerId, rankTargetId]);

  // Stale async status from a recycled Wall/Connect cell must not decorate
  // another member's avatar even for a single render or an account switch.
  const verifiedRankName = rankCache.targetId === rankTargetId ? rankCache.rankName : null;
  const online = onlineCache.targetId === rankTargetId && onlineCache.online;
  const rankArt = getBuklodCircleRankArt(verifiedRankName || rankName);
  const rankBorder = rankArt?.borderColor ?? colors.line;
  const badgeSize = size < 32 ? Math.max(11, Math.round(size * 0.52)) : Math.max(18, Math.round(size * 0.52));
  const onlineSize = Math.min(16, Math.max(8, Math.round(size * 0.18)));
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
    borderWidth: rankArt ? (rankArt.levelIndex === 4 ? 2.8 : 2.1) : 1,
    borderColor: rankBorder,
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
        userId={rankTargetId}
        size={size}
      />
      {rankArt ? (
        <View pointerEvents="none" accessible={false} style={{
          position: 'absolute',
          zIndex: 60,
          elevation: 4,
          left: -badgeSize * 0.25,
          top: -badgeSize * 0.10,
          width: badgeSize,
          height: badgeSize,
          overflow: 'hidden',
        }}>
          <ExpoImage
            source={require('../../assets/season2/rank-badges/buklod-circle-ranks-atlas.webp')}
            contentFit="fill"
            style={{
              position: 'absolute',
              width: badgeSize * 5,
              height: badgeSize * 8,
              left: -(rankArt.levelIndex * badgeSize),
              top: -(rankArt.familyIndex * badgeSize),
            }}
          />
        </View>
      ) : null}
      {online ? (
        <View pointerEvents="none" accessible accessibilityLabel="Online" style={{
          position: 'absolute',
          zIndex: 70,
          bottom: -onlineSize * 0.30,
          left: (size - onlineSize) / 2,
          width: onlineSize,
          height: onlineSize,
          borderRadius: onlineSize / 2,
          borderWidth: Math.max(1.5, onlineSize * 0.16),
          borderColor: '#FFFFFF',
          backgroundColor: '#00AAFF',
        }} />
      ) : null}
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
