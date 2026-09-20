import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type BuklodCommunityComposerIntent =
  | 'post'
  | 'ask'
  | 'need_help'
  | 'offer';

type GroupRow = {
  id: string;
  name: string;
};

export function BuklodCommunityQuickActions({
  onIntent,
}: {
  onIntent: (intent: BuklodCommunityComposerIntent) => void;
}) {
  const actions: Array<{
    key: BuklodCommunityComposerIntent;
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }> = [
    { key: 'post', label: 'Post', icon: 'pencil-outline' },
    { key: 'ask', label: 'Ask', icon: 'comment-question-outline' },
    { key: 'need_help', label: 'Need Help', icon: 'hand-heart-outline' },
    { key: 'offer', label: 'Offer', icon: 'handshake-outline' },
  ];

  return (
    <View style={s.quickShell}>
      {actions.map(action => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => onIntent(action.key)}
          style={({ pressed }) => [s.quick, pressed && s.pressed]}
        >
          <MaterialCommunityIcons
            name={action.icon}
            size={17}
            color="#1E6B45"
          />
          <Text style={s.quickText}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function BuklodCommunityWallEngagementLayer({
  onIntent,
}: {
  onIntent: (intent: BuklodCommunityComposerIntent) => void;
}) {
  const { user } = useAuth();
  const [unreadKinds, setUnreadKinds] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const timer = setTimeout(() => {
      void (async () => {
        const notificationQuery = (supabase as any)
          .from('notifications')
          .select('kind')
          .eq('user_id', user.id)
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(50);

        const groupQuery = (supabase as any)
          .from('group_members')
          .select('group_id,buklod_groups:group_id(id,name)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(8);

        const [notifications, memberships] = await Promise.allSettled([
          withBuklodTimeout(notificationQuery, 3500, 'Wall unread activity'),
          withBuklodTimeout(groupQuery, 3500, 'Wall Samahang memberships'),
        ]);

        if (!alive) return;

        if (
          notifications.status === 'fulfilled' &&
          !notifications.value?.error
        ) {
          setUnreadKinds(
            (notifications.value?.data ?? [])
              .map((row: any) => String(row?.kind ?? '').trim())
              .filter(Boolean),
          );
        }

        if (
          memberships.status === 'fulfilled' &&
          !memberships.value?.error
        ) {
          const seen = new Set<string>();
          const next: GroupRow[] = [];
          for (const row of memberships.value?.data ?? []) {
            const group = (row as any)?.buklod_groups;
            const id = String(group?.id ?? '').trim();
            const name = String(group?.name ?? '').trim();
            if (!id || !name || seen.has(id)) continue;
            seen.add(id);
            next.push({ id, name });
          }
          setGroups(next.slice(0, 6));
        }
      })();
    }, 450);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [user?.id]);

  const activity = useMemo(() => {
    const count = (needle: string) =>
      unreadKinds.filter(kind => kind.toLowerCase().includes(needle)).length;

    return {
      total: unreadKinds.length,
      mentions: count('mention'),
      replies: count('comment') + count('reply'),
      reactions: count('reaction'),
      groups: count('group'),
    };
  }, [unreadKinds]);

  return (
    <View style={s.utilityShell}>
      {activity.total > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open unread Community activity"
          onPress={() => router.push('/notifications' as any)}
          style={({ pressed }) => [s.activityCard, pressed && s.pressed]}
        >
          <View style={s.titleRow}>
            <MaterialCommunityIcons
              name="history"
              size={18}
              color="#1E6B45"
            />
            <Text style={s.title}>Habang Wala Ka</Text>
            <Text style={s.count}>{activity.total}</Text>
          </View>
          <Text numberOfLines={2} style={s.meta}>
            {[
              activity.reactions ? `${activity.reactions} reaction${activity.reactions === 1 ? '' : 's'}` : '',
              activity.replies ? `${activity.replies} repl${activity.replies === 1 ? 'y' : 'ies'}` : '',
              activity.mentions ? `${activity.mentions} mention${activity.mentions === 1 ? '' : 's'}` : '',
              activity.groups ? `${activity.groups} group update${activity.groups === 1 ? '' : 's'}` : '',
            ].filter(Boolean).join(' · ') || 'May bago sa iyong notifications.'}
          </Text>
        </Pressable>
      ) : null}

      <View style={s.board}>
        <View style={s.titleRow}>
          <MaterialCommunityIcons
            name="view-grid-outline"
            size={18}
            color="#1E6B45"
          />
          <Text style={s.title}>Community Board</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
        >
          <Pressable
            onPress={() => router.push('/church' as any)}
            style={s.chip}
          >
            <Text style={s.chipText}>Announcements</Text>
          </Pressable>
          <Pressable
            onPress={() => onIntent('need_help')}
            style={s.chip}
          >
            <Text style={s.chipText}>Need Help</Text>
          </Pressable>
          <Pressable
            onPress={() => onIntent('offer')}
            style={s.chip}
          >
            <Text style={s.chipText}>Offer / Service</Text>
          </Pressable>
          <Pressable
            onPress={() => onIntent('ask')}
            style={s.chip}
          >
            <Text style={s.chipText}>Recommendations</Text>
          </Pressable>
        </ScrollView>
      </View>

      {groups.length > 0 ? (
        <View style={s.samahang}>
          <View style={s.titleRow}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={18}
              color="#1E6B45"
            />
            <Text style={s.title}>Samahang Binuklod</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            {groups.map(group => (
              <View key={group.id} style={s.groupChip}>
                <Text numberOfLines={1} style={s.groupText}>
                  {group.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  quickShell: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 10,
  },
  quick: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E5DC',
    backgroundColor: '#F8FBF9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  quickText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#264F3C',
  },
  utilityShell: {
    gap: 8,
    marginTop: 9,
    marginBottom: 10,
  },
  activityCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D5E4DB',
    backgroundColor: '#F7FBF8',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  board: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E7E2',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  samahang: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E7E2',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    color: '#183C2C',
  },
  count: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    backgroundColor: '#1E6B45',
  },
  meta: {
    marginTop: 5,
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '700',
    color: '#68776F',
  },
  chips: {
    gap: 7,
    paddingTop: 8,
    paddingRight: 8,
  },
  chip: {
    minHeight: 31,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D5E4DB',
    backgroundColor: '#F8FBF9',
  },
  chipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#28513E',
  },
  groupChip: {
    maxWidth: 170,
    minHeight: 31,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#EDF6F0',
  },
  groupText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#28513E',
  },
  pressed: {
    opacity: 0.72,
  },
});
