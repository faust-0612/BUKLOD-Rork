import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { openAttendanceWorkspaceForAccount } from '@/lib/buklodScopeManage';
import {
  loadBuklodPointsDashboard,
  type BuklodPointsDashboard,
} from '@/lib/buklodRewards';
import { supabase } from '@/lib/supabase';

function SummaryTile({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryTile,
        emphasized && styles.summaryTilePrimary,
      ]}
    >
      <Text
        style={[
          styles.summaryValue,
          emphasized && styles.summaryValuePrimary,
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.summaryLabel,
          emphasized && styles.summaryLabelPrimary,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function DoorwayRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.doorwayRow}>
      <View style={styles.doorwayIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color="#275D45"
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.doorwayTitle}>{title}</Text>
        <Text style={styles.doorwaySubtitle}>{subtitle}</Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color="#77837C"
      />
    </Pressable>
  );
}

export default function BayanihanScreen() {
  const { profile } = useAuth();
  const { scopes, activeScope, selectScope } = useBuklodScope();
  const profileId = (profile as { id?: string } | null)?.id;

  const [points, setPoints] =
    useState<BuklodPointsDashboard | null>(null);
  const [circleRank, setCircleRank] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(async () => {
    const [pointsResult, rankResult] =
      await Promise.all([
        loadBuklodPointsDashboard().catch(() => null),

        profileId
          ? (supabase as any).rpc(
              'get_member_circle_ranks_v1',
              { p_user_ids: [profileId] },
            )
          : Promise.resolve({ data: null, error: null }),
      ]);

    setPoints(pointsResult);

    if (!rankResult.error) {
      const rows = Array.isArray(rankResult.data)
        ? rankResult.data
        : rankResult.data
          ? [rankResult.data]
          : [];

      const row =
        rows.find(
          (item: { user_id?: string }) =>
            item?.user_id === profileId,
        ) ?? rows[0];

      setCircleRank(row?.rank_name ?? null);
    } else {
      setCircleRank(null);
    }

    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const lifetimePoints = Number(
    points?.lifetime_points ?? 0,
  );
  const availablePoints = Number(
    points?.available_points ?? 0,
  );
  const pendingPoints = Number(
    points?.pending_claimable_points ?? 0,
  );

  return (
    <BuklodPortalScrollView
      style={shared.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
        />
      }
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            BUKLOD BAYANIHAN
          </Text>

          <Text style={styles.title}>
            BUKLOD Bayanihan
          </Text>

          <Text style={styles.subtitle}>
            Participation • Growth • Community
          </Text>
        </View>

        <View style={styles.heroIcon}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={30}
            color="#275D45"
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>
            Loading your participation summary...
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.rankCard}>
            <Text style={styles.rankEyebrow}>
              HOW ASSISTANCE WORKS
            </Text>
            <Text style={styles.rankName}>
              Request · Review · Receive
            </Text>
            <Text style={styles.rankNote}>
              Bayanihan ₱ is separate from BUKLOD Points. Qualification,
              required documents, and approval follow the posted policy.
              Participation and contribution conditions are set by System Admin
              configuration, not by converting points into cash.
            </Text>
          </View>

          <View style={styles.rankCard}>
            <Text style={styles.rankEyebrow}>
              CIRCLE RANK
            </Text>
            <Text style={styles.rankName}>
              {circleRank ?? 'Circle Starter V'}
            </Text>
            <Text style={styles.rankNote}>
              Based on lifetime BUKLOD Points from
              approved participation.
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryTile
              label="Lifetime Points"
              value={lifetimePoints.toLocaleString('en-PH')}
              emphasized
            />
            <SummaryTile
              label="Available Points"
              value={availablePoints.toLocaleString('en-PH')}
            />
            <SummaryTile
              label="Pending Claimable"
              value={pendingPoints.toLocaleString('en-PH')}
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>
              DOORWAYS
            </Text>
            <Text style={styles.sectionTitle}>
              Continue Your Journey
            </Text>
          </View>

          <DoorwayRow
            icon="star-circle-outline"
            title="BUKLOD Points"
            subtitle="View rank progress, claim rewards, and activity history"
            onPress={() => router.push('/points' as any)}
          />

          <DoorwayRow
            icon="school-outline"
            title="Learning Progress"
            subtitle="Formation lessons, mentoring, and verification"
            onPress={() => router.push('/learn' as any)}
          />

          <DoorwayRow
            icon="book-open-page-variant-outline"
            title="Daily Bible & Devotion"
            subtitle="Daily reading, reflection, and spiritual formation"
            onPress={() => router.push('/bible' as any)}
          />

          <DoorwayRow
            icon="calendar-check-outline"
            title="BUKLOD Attendance"
            subtitle="Participation records across your scopes"
            onPress={() => {
              void openAttendanceWorkspaceForAccount(selectScope, scopes, {
                activeScope,
              }).catch((error: any) => {
                Alert.alert(
                  'BUKLOD Attendance',
                  String(error?.message ?? 'Open an Organization or Cluster first.'),
                );
              });
            }}
          />
        </>
      )}

      <View style={styles.footerCard}>
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={22}
          color="#275D45"
        />

        <Text style={styles.footerText}>
          BUKLOD Bayanihan recognizes approved participation,
          learning, and community engagement through BUKLOD Points
          and Circle Rank. It is not a personal cash account and
          does not measure spiritual worth.
        </Text>
      </View>

      <Text style={styles.footerBrand}>
        SAMAHANG BINU KLOD NG PAG-IBIG
      </Text>
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 18,
    paddingBottom: 160,
  },

  hero: {
    flexDirection: 'row',
    gap: 6,
    padding: 19,
    marginBottom: 6,
    borderRadius: 0,
    backgroundColor: 'rgba(39,93,69,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
  },

  heroIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#78847D',
  },

  title: {
    marginTop: 4,
    fontSize: 29,
    fontWeight: '900',
    color: '#1C2822',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#69766F',
    fontWeight: '700',
  },

  loadingCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  loadingText: {
    color: '#738078',
  },

  rankCard: {
    padding: 21,
    marginBottom: 6,
    borderRadius: 22,
    backgroundColor: '#275D45',
  },

  rankEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.72)',
  },

  rankName: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  rankNote: {
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.82)',
  },

  summaryGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },

  summaryTile: {
    flex: 1,
    minHeight: 88,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
  },

  summaryTilePrimary: {
    backgroundColor: 'rgba(39,93,69,0.07)',
    borderColor: 'rgba(39,93,69,0.18)',
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#344139',
  },

  summaryValuePrimary: {
    color: '#275D45',
  },

  summaryLabel: {
    marginTop: 5,
    fontSize: 9.5,
    lineHeight: 13,
    color: '#7C8881',
  },

  summaryLabelPrimary: {
    color: '#617068',
  },

  sectionHeader: {
    marginTop: 8,
    marginBottom: 6,
  },

  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#87918B',
  },

  sectionTitle: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '900',
    color: '#202C26',
  },

  doorwayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    marginBottom: 6,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,45,35,0.09)',
  },

  doorwayIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(39,93,69,0.07)',
  },

  doorwayTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#25322B',
  },

  doorwaySubtitle: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#7A867F',
  },

  footerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: 14,
    backgroundColor: 'rgba(39,93,69,0.055)',
  },

  footerText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#6D7972',
  },

  footerBrand: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#929C96',
  },
});
