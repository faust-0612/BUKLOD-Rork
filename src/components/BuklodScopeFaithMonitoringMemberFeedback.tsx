import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import {
  fetchScopeFaithMonitoringFeedbackForMember,
  hasFaithMonitoringFeedbackContent,
  type ScopeFaithMonitoringFeedbackItem,
  type ScopeFaithMonitoringFeedbackView,
} from '@/lib/buklodScopeFaithMonitoringFeedback';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type Props = {
  scopeId: string;
};

function FeedbackCard({
  item,
  badge,
}: {
  item: ScopeFaithMonitoringFeedbackItem;
  badge: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <MaterialCommunityIcons
          name="message-star-outline"
          size={18}
          color={colors.greenDark}
        />
        <Text style={styles.badge}>{badge}</Text>
      </View>

      {item.headline?.trim() ? (
        <Text style={styles.headline}>
          {item.headline.trim()}
        </Text>
      ) : null}

      {item.message?.trim() ? (
        <Text style={styles.message}>
          {item.message.trim()}
        </Text>
      ) : null}

      {item.updated_at ? (
        <Text style={styles.meta}>
          Updated{' '}
          {new Date(item.updated_at).toLocaleDateString()}
        </Text>
      ) : null}
    </View>
  );
}

export default function BuklodScopeFaithMonitoringMemberFeedback({
  scopeId,
}: Props) {
  const { user } = useAuth();
  const [feedback, setFeedback] =
    useState<ScopeFaithMonitoringFeedbackView | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const row = await fetchScopeFaithMonitoringFeedbackForMember({
        scopeId,
        userId: user?.id ?? null,
      });
      setFeedback(row);
    } catch (error) {
      console.warn('Faith monitoring member feedback:', error);
      setFeedback(null);
    } finally {
      setLoading(false);
    }
  }, [scopeId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!hasFaithMonitoringFeedbackContent(feedback)) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {feedback?.general ? (
        <FeedbackCard
          item={feedback.general}
          badge="FEEDBACK FOR EVERYONE"
        />
      ) : null}

      {feedback?.personal ? (
        <FeedbackCard
          item={feedback.personal}
          badge="FEEDBACK FOR YOU"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  loadingCard: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#B9D8C8',
    backgroundColor: '#F3FBF7',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  headline: {
    color: '#173B2F',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  message: {
    color: '#2F4A3D',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  meta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
  },
});
