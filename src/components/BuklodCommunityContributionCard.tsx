import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatMinorPhp,
  loadMyCommunityContribution,
  recordCommunityEconomyAnalytics,
  type CommunityContributionDashboard,
} from '@/lib/buklodCommunityContributionEconomy';
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

  useEffect(() => {
    let alive = true;
    let lastLoaded = 0;
    let loading = false;
    let analyticsSent = false;
    setData(null); // Never reuse another account's financial preview.
    if (!userId) return () => { alive = false; };
    const refresh = async () => {
      if (!alive || loading) return;
      loading = true;
      try {
        const next = await loadMyCommunityContribution();
        if (!alive) return;
        setData(next);
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
  }, [userId]);

  if (!data) return null;

  const weightPct = Math.max(0, Number(data.share_weight || 0)) * 100;
  const estimate = data.estimated_share_minor === null
    ? 'No safe estimate yet'
    : data.estimate_below_cent ? 'Below ₱0.01' : formatMinorPhp(data.estimated_share_minor);
  const breakdown = data.engagement_breakdown;
  const trendPctPoints = Number(data.share_weight_delta || 0) * 100;
  const trendLabel =
    Math.abs(trendPctPoints) < 0.0001
      ? 'No prior-period change yet'
      : `${trendPctPoints > 0 ? '+' : ''}${trendPctPoints.toFixed(
          Math.abs(trendPctPoints) < 0.01 ? 4 : 2,
        )} pp share-weight trend`;

  return (
    <View style={s.shell}>
      <View style={s.head}>
        <View style={s.icon}>
          <MaterialCommunityIcons name="account-heart-outline" size={20} color="#1E6B45" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>YOUR COMMUNITY CONTRIBUTION</Text>
          <Text style={s.sub}>Create value → grow qualified monthly share weight.</Text>
        </View>
        <Text style={s.level}>{data.contribution_level}</Text>
      </View>

      <View style={s.metrics}>
        <View style={s.metric}>
          <Text style={s.metricValue}>{data.this_month_qmp}</Text>
          <Text style={s.metricLabel}>THIS MONTH QMP</Text>
        </View>
        <View style={[s.metric, { backgroundColor: shareTone.surface }]}>
          <Text style={[s.metricValue, { color: shareTone.ink }]}>{weightPct.toFixed(weightPct < 0.01 ? 4 : 2)}%</Text>
          <Text style={s.metricLabel}>SHARE WEIGHT</Text>
        </View>
        <View style={[s.metric, { backgroundColor: contentTone.surface }]}>
          <Text style={[s.metricValue, { color: contentTone.ink }]}>{data.qualified_posts + data.qualified_videos}</Text>
          <Text style={s.metricLabel}>QUALIFIED CONTENT</Text>
        </View>
      </View>

      <View style={s.impact}>
        <Text style={s.impactTitle}>WHAT HELPED YOUR SHARE GROW?</Text>
        <Text style={s.impactText}>
          Posts {breakdown?.useful_post_qmp ?? 0} QMP · Videos {breakdown?.qualified_video_qmp ?? 0} QMP · Replies {breakdown?.meaningful_reply_qmp ?? 0} QMP
        </Text>
        <Text style={s.impactText}>
          Validated engagement {breakdown?.validated_engagement_qmp ?? 0} QMP · {trendLabel}
        </Text>
      </View>

      <View style={s.estimate}>
        <Text style={s.estimateLabel}>ESTIMATED REVENUE SHARE</Text>
        <Text style={s.estimateValue}>{estimate}</Text>
        <Text style={s.estimateGuard}>
          {data.estimate_status === 'PROVISIONAL_ADMOB'
            ? 'ADMOB PRELIMINARY · CHANGES WITH COMMUNITY QMP · NOT WITHDRAWABLE'
            : 'ESTIMATE · NOT FINAL · NOT WITHDRAWABLE'}
        </Text>
        {data.estimate_updated_at ? (
          <Text style={s.estimateGuard}>Report updated {new Date(data.estimate_updated_at).toLocaleString()}</Text>
        ) : null}
      </View>

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
  shell:{marginTop:10,marginBottom:12,borderWidth:1,borderColor:contributionTone.border,borderRadius:16,backgroundColor:contributionTone.surface,padding:12,gap:9},
  head:{flexDirection:'row',alignItems:'center',gap:9},
  icon:{width:36,height:36,borderRadius:18,backgroundColor:contributionTone.soft,alignItems:'center',justifyContent:'center'},
  eyebrow:{fontSize:11,fontWeight:'900',color:'#173C2C',letterSpacing:.4},
  sub:{marginTop:2,fontSize:9.5,lineHeight:13,color:'#6E7C74'},
  level:{fontSize:8,fontWeight:'900',color:'#1E6B45',backgroundColor:'#EAF4EE',borderRadius:99,paddingHorizontal:7,paddingVertical:5,overflow:'hidden'},
  metrics:{flexDirection:'row',gap:6},
  metric:{flex:1,minHeight:56,borderRadius:12,backgroundColor:monthTone.surface,padding:8,justifyContent:'center'},
  metricValue:{fontSize:15,fontWeight:'900',color:'#173C2C'}, metricLabel:{marginTop:2,fontSize:7,fontWeight:'900',color:'#4B5B56'},
  impact:{borderRadius:12,borderWidth:1,borderColor:impactTone.border,backgroundColor:impactTone.surface,padding:9},
  impactTitle:{fontSize:8,fontWeight:'900',color:impactTone.ink},
  impactText:{marginTop:3,fontSize:8.5,lineHeight:12,color:'#5F7066'},
  estimate:{borderRadius:12,backgroundColor:revenueTone.surface,padding:10}, estimateLabel:{fontSize:8,fontWeight:'900',color:revenueTone.ink},
  estimateValue:{marginTop:2,fontSize:17,fontWeight:'900',color:'#1E6B45'}, estimateGuard:{marginTop:2,fontSize:7,lineHeight:10,fontWeight:'900',color:'#66501D'},
  secondary:{minHeight:34,borderRadius:10,borderWidth:1,borderColor:shareTone.border,backgroundColor:shareTone.soft,alignItems:'center',justifyContent:'center',paddingHorizontal:8}, secondaryText:{color:shareTone.ink,fontSize:8.5,fontWeight:'900'},
});
