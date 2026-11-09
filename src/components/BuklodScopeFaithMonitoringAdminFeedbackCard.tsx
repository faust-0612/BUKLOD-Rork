import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { BuklodTappableAvatar } from '@/components/BuklodTappableAvatar';
import {
  fetchScopeFaithMonitoringFeedbackAdminList,
  upsertScopeFaithMonitoringFeedback,
  type ScopeFaithMonitoringFeedbackItem,
} from '@/lib/buklodScopeFaithMonitoringFeedback';
import { fetchScopeMembers } from '@/lib/buklodScopeMembers';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { createFaithMonitoringMemberSearch } from '@/lib/buklodFaithMonitoringMemberSearch';
import { colors } from '@/lib/theme';

type Audience = 'all' | 'member';

type Props = {
  scopeId: string;
  scopeName?: string;
};

function audienceLabel(item: ScopeFaithMonitoringFeedbackItem) {
  if (!item.target_user_id) {
    return 'All members';
  }

  return item.target_name?.trim() || 'One member';
}

export default function BuklodScopeFaithMonitoringAdminFeedbackCard({
  scopeId,
  scopeName,
}: Props) {
  const [audience, setAudience] = useState<Audience>('all');
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<
    Awaited<ReturnType<typeof fetchScopeMembers>>
  >([]);
  const [selectedMemberId, setSelectedMemberId] =
    useState<string | null>(null);
  const [published, setPublished] = useState<
    ScopeFaithMonitoringFeedbackItem[]
  >([]);
  const [headline, setHeadline] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [initiallyLoaded, setInitiallyLoaded] = useState(false);
  const feedbackRequestVersion = useRef(0);
  const [saving, setSaving] = useState(false);

  const selectedMember = useMemo(
    () =>
      members.find(
        (member) => member.user_id === selectedMemberId
      ) ?? null,
    [members, selectedMemberId]
  );

  const loadExistingDraft = useCallback(
    (nextAudience: Audience, memberId?: string | null) => {
      const existing = published.find((item) =>
        nextAudience === 'all'
          ? !item.target_user_id
          : item.target_user_id === memberId
      );

      setHeadline(existing?.headline ?? '');
      setMessage(existing?.message ?? '');
    },
    [published]
  );

  // Search must not refresh/unmount the entire form on every keystroke.
  // An older response (or a screen blur/scope change) cannot replace new data.
  const load = useCallback(async () => {
    const requestVersion = ++feedbackRequestVersion.current;
    setLoading(true);
    try {
      const rows = await fetchScopeFaithMonitoringFeedbackAdminList(scopeId);
      if (feedbackRequestVersion.current === requestVersion) {
        setPublished(rows);
      }
    } catch (error) {
      if (feedbackRequestVersion.current === requestVersion) {
        console.warn('Faith monitoring feedback load:', error);
      }
    } finally {
      if (feedbackRequestVersion.current === requestVersion) {
        setLoading(false);
        setInitiallyLoaded(true);
      }
    }
  }, [scopeId]);

  useEffect(() => {
    // Never retain another workspace's feedback or selected member.
    feedbackRequestVersion.current += 1;
    setAudience('all');
    setMemberQuery('');
    setMembers([]);
    setSelectedMemberId(null);
    setPublished([]);
    setHeadline('');
    setMessage('');
    setInitiallyLoaded(false);
  }, [scopeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        feedbackRequestVersion.current += 1;
      };
    }, [load])
  );

  useEffect(() => {
    if (audience !== 'member') {
      setMembers([]);
      return;
    }
    // Debounce search, discard stale responses and preserve TextInput focus.
    const search = createFaithMonitoringMemberSearch(
      (query: string) =>
        fetchScopeMembers({
          scopeId,
          status: 'ACTIVE',
          limit: 80,
          query: query.trim() || undefined,
        }),
      setMembers,
      (error) => console.warn('Faith monitoring member search:', error)
    );
    search.update(memberQuery);
    return () => search.dispose();
  }, [audience, memberQuery, scopeId]);

  useEffect(() => {
    if (!published.length) return;

    if (audience === 'all') {
      loadExistingDraft('all');
      return;
    }

    if (selectedMemberId) {
      loadExistingDraft('member', selectedMemberId);
    }
  }, [audience, loadExistingDraft, published, selectedMemberId]);

  const switchAudience = useCallback(
    (nextAudience: Audience) => {
      setAudience(nextAudience);

      if (nextAudience === 'all') {
        setSelectedMemberId(null);
        loadExistingDraft('all');
        return;
      }

      loadExistingDraft('member', selectedMemberId);
    },
    [loadExistingDraft, selectedMemberId]
  );

  const selectMember = useCallback(
    (memberId: string) => {
      setSelectedMemberId(memberId);
      loadExistingDraft('member', memberId);
    },
    [loadExistingDraft]
  );

  const save = useCallback(async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage && !headline.trim()) {
      Alert.alert(
        'Feedback',
        'Add a headline or message first.'
      );
      return;
    }

    if (audience === 'member' && !selectedMemberId) {
      Alert.alert(
        'Feedback',
        'Choose one member for individual feedback.'
      );
      return;
    }

    setSaving(true);

    try {
      await upsertScopeFaithMonitoringFeedback({
        scopeId,
        targetUserId:
          audience === 'member' ? selectedMemberId : null,
        targetName: selectedMember?.full_name ?? null,
        headline: headline.trim() || null,
        message: trimmedMessage,
      });

      await load();

      Alert.alert(
        'Feedback saved',
        audience === 'all'
          ? 'All members will see this on their Faith Monitoring card.'
          : `${resolvePersonDisplayName(
              selectedMember?.full_name,
              selectedMemberId
            )} will see this on their home only.`
      );
    } catch (error) {
      Alert.alert(
        'Feedback',
        String(
          (error as Error)?.message ??
            'Could not save feedback.'
        )
      );
    } finally {
      setSaving(false);
    }
  }, [
    audience,
    headline,
    load,
    message,
    scopeId,
    selectedMember?.full_name,
    selectedMemberId,
  ]);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name="message-reply-text-outline"
            size={20}
            color={colors.greenDark}
          />
        </View>
        <View style={styles.headCopy}>
          <Text style={styles.title}>MEMBER FEEDBACK</Text>
          <Text style={styles.subtitle}>
            Publish for everyone or for one member in{' '}
            {scopeName ?? 'this workspace'}.
          </Text>
        </View>
      </View>

      <View style={styles.audienceRow}>
        <Pressable
          style={[
            styles.audienceChip,
            audience === 'all' && styles.audienceChipOn,
          ]}
          onPress={() => switchAudience('all')}
        >
          <Text
            style={[
              styles.audienceChipText,
              audience === 'all' && styles.audienceChipTextOn,
            ]}
          >
            All members
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.audienceChip,
            audience === 'member' && styles.audienceChipOn,
          ]}
          onPress={() => switchAudience('member')}
        >
          <Text
            style={[
              styles.audienceChipText,
              audience === 'member' && styles.audienceChipTextOn,
            ]}
          >
            One member
          </Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.green} /> : null}
      {initiallyLoaded ? (
        <>
          {audience === 'member' ? (
            <>
              <Text style={styles.label}>Choose member</Text>
              <TextInput
                value={memberQuery}
                onChangeText={setMemberQuery}
                placeholder="Search member name…"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.memberRow}
              >
                {members.map((member) => {
                  const selected =
                    selectedMemberId === member.user_id;

                  return (
                    <Pressable
                      key={member.user_id}
                      style={[
                        styles.memberChip,
                        selected && styles.memberChipOn,
                      ]}
                      onPress={() =>
                        selectMember(member.user_id)
                      }
                    >
                      <BuklodTappableAvatar
                        userId={member.user_id}
                        uri={member.avatar_url}
                        name={member.full_name}
                        size={34}
                      />
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.memberName,
                          selected && styles.memberNameOn,
                        ]}
                      >
                        {resolvePersonDisplayName(
                          member.full_name,
                          member.user_id
                        )}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.label}>Headline (optional)</Text>
          <TextInput
            value={headline}
            onChangeText={setHeadline}
            placeholder="e.g. Great progress this week!"
            placeholderTextColor={colors.muted}
            style={styles.headlineInput}
            maxLength={120}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Share feedback about Daily Reading, Devotion, or Buklod Lesson progress…"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.messageInput}
            maxLength={600}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>
            {message.length}/600
          </Text>

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            disabled={saving}
            onPress={() => void save()}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving…' : 'Publish feedback'}
            </Text>
          </Pressable>

          {published.length ? (
            <View style={styles.publishedWrap}>
              <Text style={styles.publishedTitle}>
                PUBLISHED FEEDBACK
              </Text>
              {published.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.publishedItem}
                  onPress={() => {
                    if (item.target_user_id) {
                      setAudience('member');
                      setSelectedMemberId(item.target_user_id);
                    } else {
                      setAudience('all');
                      setSelectedMemberId(null);
                    }

                    setHeadline(item.headline ?? '');
                    setMessage(item.message ?? '');
                  }}
                >
                  <Text style={styles.publishedAudience}>
                    {audienceLabel(item)}
                  </Text>
                  {item.headline?.trim() ? (
                    <Text
                      numberOfLines={1}
                      style={styles.publishedHeadline}
                    >
                      {item.headline}
                    </Text>
                  ) : null}
                  {item.message?.trim() ? (
                    <Text
                      numberOfLines={2}
                      style={styles.publishedMessage}
                    >
                      {item.message}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#173B2F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  audienceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  audienceChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAF9',
  },
  audienceChipOn: {
    borderColor: colors.green,
    backgroundColor: '#E8F5EE',
  },
  audienceChipText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  audienceChipTextOn: {
    color: colors.greenDark,
  },
  label: {
    color: '#476055',
    fontSize: 10,
    fontWeight: '800',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#173B2F',
  },
  memberRow: {
    gap: 8,
    paddingVertical: 2,
  },
  memberChip: {
    width: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#F8FAF9',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  memberChipOn: {
    borderColor: colors.green,
    backgroundColor: '#E8F5EE',
  },
  memberName: {
    color: '#173B2F',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  memberNameOn: {
    color: colors.greenDark,
  },
  headlineInput: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '900',
    color: '#173B2F',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 110,
    fontSize: 13,
    lineHeight: 18,
    color: '#173B2F',
  },
  charCount: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'right',
  },
  saveBtn: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  publishedWrap: {
    marginTop: 4,
    gap: 8,
  },
  publishedTitle: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  publishedItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EFEA',
    backgroundColor: '#F8FAF9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  publishedAudience: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '900',
  },
  publishedHeadline: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
  },
  publishedMessage: {
    color: '#476055',
    fontSize: 10,
    lineHeight: 14,
  },
});
