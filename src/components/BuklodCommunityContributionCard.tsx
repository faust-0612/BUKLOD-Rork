import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatMinorPhp,
  loadMyCommunityContribution,
  loadMyCommunityQmpHistory,
  recordCommunityEconomyAnalytics,
  type CommunityContributionDashboard,
} from '@/lib/buklodCommunityContributionEconomy';
import type { CommunityQmpHistory } from '@/lib/buklodQmpHistory';
import { getBuklodCardTone } from '@/lib/buklodCardTones';
import { useAuth } from '@/providers/AuthProvider';

/* BUKLOD_COMMUNITY_CONTRIBUTION_CARD_R1 */
const contributionTone = getBuklodCardTone('teal');
const monthTone = getBuklodCardTone('sky');
const shareTone = getBuklodCardTone('lavender');
const contentTone = getBuklodCardTone('peach');
const impactTone = getBuklodCardTone('amber');
const revenueTone = getBuklodCardTone('mint');

export default function BuklodCommunityContributionCard() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [data, setData] = useState<CommunityContributionDashboard | null>(null);
  const [history, setHistory] = useState<CommunityQmpHistory | null>(null);
  const [status, setStatus] = useState<'loading' | 'failed' | 'ready'>('loading');
  const [retryEpoch, setRetryEpoch] = useState(0);

  useEffect(() => {
    let alive = true;
    let lastLoaded = 0;
    let loading = false;
    let analyticsSent = false;
    let historyRequestId = 0;
    setHistory(null); // Account-scoped history must never leak on user switch.
    setData(null); // Never reuse another account's financial preview.
    setStatus('loading');
    if (!userId) return () => { alive = false; };
    const refresh = async () => {
      if (!alive || loading) return;
      loading = true;
      // Separate read-only lifetime query: never delay the existing Wall QMP paint.
      const historyRequest = ++historyRequestId;
      void loadMyCommunityQmpHistory()
        .then(next => {
          if (alive && historyRequest === historyRequestId) setHistory(next);
        })
        .catch(() => {
          // Keep the prior authentic snapshot; never replace a load error with 0 QMP.
        });
      try {
        const next = await loadMyCommunityContribution();
        if (!alive) return;
        setData(next);
        setStatus('ready');
        lastLoaded = Date.now();
        if (!analyticsSent) {
          analyticsSent = true;
          void recordCommunityEconomyAnalytics('contribution_card_viewed', {
            period_key: next.period?.key,
            level: next.contribution_level,
          });
        }
      } catch {
        // Keep the most recent genuine snapshot; never invent a peso amount.
        if (alive) setStatus(current => current === 'ready' ? current : 'failed');
      } finally {
        loading = false;
      }
    };
    void refresh();
    // Bounded foreground refresh, jittered so many clients don't stampede SQL.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 240_000 + Math.floor(Math.random() * 90_000));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastLoaded > 120_000) void refresh();
    });
    return () => { alive = false; clearInterval(timer); subscription.remove(); };
  }, [userId, retryEpoch]);

  if (!data) {
    if (!userId) return null;
    // A failed/slow request must not make the entire Home feature disappear.
    // Never display invented QMP/earnings or another account's stale snapshot.
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Community Contribution status, tap to retry"
        onPress={() => setRetryEpoch(current => current + 1)}
        style={s.emptyShell}>
        <MaterialCommunityIcons name="account-heart-outline" size={22} color="#1E6B45" />
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>YOUR COMMUNITY CONTRIBUTION</Text>
          <Text style={s.sub}>{status === 'failed'
            ? 'Unable to load right now · tap to retry'
            : 'Loading your private contribution summary…'}</Text>
        </View>
      </Pressable>
    );
  }

  const estimate = data.estimated_share_minor === null
    ? 'No safe estimate yet'
    : data.estimate_below_cent ? 'Below ₱0.01' : formatMinorPhp(data.estimated_share_minor);
  const breakdown = data.engagement_breakdown;

  return (
    <View style={s.shell}>
      <View style={s.head}>
        <View style={s.icon}>
          <MaterialCommunityIcons name="account-heart-outline" size={20} color="#1E6B45" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>YOUR COMMUNITY CONTRIBUTION</Text>
          <Text style={s.sub}>Your contribution progress and estimated earnings at a glance.</Text>
        </View>
        <Text style={s.level}>{data.contribution_level}</Text>
      </View>

      <View style={s.metrics}>
        <View style={s.metric}>
          <Text style={s.metricValue}>{data.this_month_qmp}</Text>
          <Text style={s.metricLabel}>THIS MONTH QMP</Text>
        </View>
        <View style={[s.metric, { backgroundColor: shareTone.surface }]}>
          <Text style={[s.metricValue, { color: shareTone.ink }]}>{data.meaningful_replies}</Text>
          <Text style={s.metricLabel}>MEANINGFUL REPLIES</Text>
        </View>
        <View style={[s.metric, { backgroundColor: contentTone.surface }]}>
          <Text style={[s.metricValue, { color: contentTone.ink }]}>{data.qualified_posts + data.qualified_videos}</Text>
          <Text style={s.metricLabel}>QUALIFIED CONTENT</Text>
        </View>
      </View>
      <Text style={s.historyLine}>
        Lifetime QMP: {history ? history.lifetime_qmp.toLocaleString() : '—'} · Period: {data.period.key}
      </Text>
      <Text style={s.periodNote}>
        Monthly QMP starts fresh each month. Your lifetime QMP is preserved as a record of your contributions.
      </Text>

      <View style={s.impact}>
        <Text style={s.impactTitle}>THIS MONTH’S QUALIFIED CONTRIBUTION</Text>
        <Text style={s.impactText}>
          Posts {breakdown?.useful_post_qmp ?? 0} QMP · Videos {breakdown?.qualified_video_qmp ?? 0} QMP · Replies {breakdown?.meaningful_reply_qmp ?? 0} QMP
        </Text>
        <Text style={s.impactText}>
          Validated engagement {breakdown?.validated_engagement_qmp ?? 0} QMP
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View my community contributions and earnings"
        onPress={() => router.push('/community-contribution' as any)}
        style={s.estimate}>
        <Text style={s.estimateLabel}>YOUR ESTIMATED REVENUE SHARE</Text>
        <Text style={s.estimateValue}>{estimate}</Text>
        <Text style={s.estimateGuard}>
          ESTIMATE ONLY · NOT FINAL · NOT WITHDRAWABLE
        </Text>
        {data.estimate_updated_at ? (
          <Text style={s.estimateGuard}>Last updated {new Date(data.estimate_updated_at).toLocaleString()}</Text>
        ) : null}
        <Text style={s.detailLink}>VIEW MY EARNINGS DETAILS</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="How to increase my community share"
        onPress={() => {
          void recordCommunityEconomyAnalytics('increase_share_opened', { period_key: data.period?.key });
          router.push('/community-contribution?guide=1' as any);
        }}
        style={({ pressed }) => [s.secondary, pressed && { opacity: 0.82 }]}
      >
        <Text style={s.secondaryText}>HOW CAN I INCREASE MY SHARE?</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  emptyShell:{marginTop:0,marginBottom:0,padding:14,borderRadius:4,
    borderWidth:1,borderColor:contributionTone.border,backgroundColor:contributionTone.surface,
    flexDirection:'row',alignItems:'center',gap:12,minHeight:72},
  shell:{marginTop:0,marginBottom:0,borderWidth:1,borderColor:contributionTone.border,borderRadius:4,backgroundColor:contributionTone.surface,padding:12,gap:9},
  head:{flexDirection:'row',alignItems:'center',gap:9},
  icon:{width:36,height:36,borderRadius:18,backgroundColor:contributionTone.soft,alignItems:'center',justifyContent:'center'},
  eyebrow:{fontSize:11,fontWeight:'900',color:'#173C2C',letterSpacing:.4},
  sub:{marginTop:2,fontSize:9.5,lineHeight:13,color:'#6E7C74'},
  level:{fontSize:8,fontWeight:'900',color:'#1E6B45',backgroundColor:'#EAF4EE',borderRadius:99,paddingHorizontal:7,paddingVertical:5,overflow:'hidden'},
  metrics:{flexDirection:'row',gap:6},
  metric:{flex:1,minHeight:56,borderRadius:12,backgroundColor:monthTone.surface,padding:8,justifyContent:'center'},
  metricValue:{fontSize:15,fontWeight:'900',color:'#173C2C'}, metricLabel:{marginTop:2,fontSize:7,fontWeight:'900',color:'#4B5B56'},
  historyLine:{fontSize:10,fontWeight:'800',color:'#305C47',paddingHorizontal:2},
  periodNote:{fontSize:8.5,lineHeight:12,color:'#52665C',paddingHorizontal:2},
  impact:{borderRadius:12,borderWidth:1,borderColor:impactTone.border,backgroundColor:impactTone.surface,padding:9},
  impactTitle:{fontSize:8,fontWeight:'900',color:impactTone.ink},
  impactText:{marginTop:3,fontSize:8.5,lineHeight:12,color:'#5F7066'},
  estimate:{borderRadius:12,backgroundColor:revenueTone.surface,padding:10}, estimateLabel:{fontSize:8,fontWeight:'900',color:revenueTone.ink},
  detailLink:{marginTop:7,fontSize:8,fontWeight:'900',color:'#1E6B45'},
  estimateValue:{marginTop:2,fontSize:17,fontWeight:'900',color:'#1E6B45'}, estimateGuard:{marginTop:2,fontSize:7,lineHeight:10,fontWeight:'900',color:'#66501D'},
  secondary:{minHeight:34,borderRadius:10,borderWidth:1,borderColor:shareTone.border,backgroundColor:shareTone.soft,alignItems:'center',justifyContent:'center',paddingHorizontal:8}, secondaryText:{color:shareTone.ink,fontSize:8.5,fontWeight:'900'},
});
