import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatMinorPhp,
  loadMyCommunityContribution,
  recordCommunityEconomyAnalytics,
  type CommunityContributionDashboard,
} from '@/lib/buklodCommunityContributionEconomy';

/* BUKLOD_COMMUNITY_CONTRIBUTION_CARD_R1 */

export default function BuklodCommunityContributionCard() {
  const [data, setData] = useState<CommunityContributionDashboard | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const next = await loadMyCommunityContribution();
        if (!alive) return;
        setData(next);
        void recordCommunityEconomyAnalytics('contribution_card_viewed', {
          period_key: next.period?.key,
          level: next.contribution_level,
        });
      } catch {
        // Signed-out or backend not yet migrated: Wall remains unchanged/usable.
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!data) return null;

  const weightPct = Math.max(0, Number(data.share_weight || 0)) * 100;
  const estimate = data.estimated_share_minor === null
    ? 'No safe estimate yet'
    : formatMinorPhp(data.estimated_share_minor);

  return (
    <View style={s.shell}>
      <View style={s.head}>
        <View style={s.icon}>
          <MaterialCommunityIcons name="account-heart-outline" size={20} color="#1E6B45" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>YOUR COMMUNITY CONTRIBUTION</Text>
          <Text style={s.sub}>See your private contribution now, or open focused ways to grow it.</Text>
        </View>
        <Text style={s.level}>{data.contribution_level}</Text>
      </View>

      <View style={s.metrics}>
        <View style={s.metric}>
          <Text style={s.metricValue}>{data.this_month_qmp}</Text>
          <Text style={s.metricLabel}>THIS MONTH QMP</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricValue}>{weightPct.toFixed(weightPct < 0.01 ? 4 : 2)}%</Text>
          <Text style={s.metricLabel}>SHARE WEIGHT</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricValue}>{data.qualified_posts + data.qualified_videos}</Text>
          <Text style={s.metricLabel}>QUALIFIED CONTENT</Text>
        </View>
      </View>

      <View style={s.estimate}>
        <Text style={s.estimateLabel}>ESTIMATED REVENUE SHARE</Text>
        <Text style={s.estimateValue}>{estimate}</Text>
        <Text style={s.estimateGuard}>ESTIMATE · NOT FINAL · SUBJECT TO PERIOD CLOSE</Text>
      </View>

      <Pressable onPress={() => router.push('/community-contribution' as any)} style={s.primary}>
        <Text style={s.primaryText}>VIEW MY CONTRIBUTION</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void recordCommunityEconomyAnalytics('increase_share_opened', { period_key: data.period?.key });
          router.push('/community-contribution?guide=1' as any);
        }}
        style={s.secondary}
      >
        <Text style={s.secondaryText}>HOW TO GROW MY SHARE</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  shell:{marginTop:10,marginBottom:12,borderWidth:1,borderColor:'#D7E5DD',borderRadius:16,backgroundColor:'#FFF',padding:12,gap:9},
  head:{flexDirection:'row',alignItems:'center',gap:9},
  icon:{width:36,height:36,borderRadius:18,backgroundColor:'#EAF4EE',alignItems:'center',justifyContent:'center'},
  eyebrow:{fontSize:11,fontWeight:'900',color:'#173C2C',letterSpacing:.4},
  sub:{marginTop:2,fontSize:9.5,lineHeight:13,color:'#6E7C74'},
  level:{fontSize:8,fontWeight:'900',color:'#1E6B45',backgroundColor:'#EAF4EE',borderRadius:99,paddingHorizontal:7,paddingVertical:5,overflow:'hidden'},
  metrics:{flexDirection:'row',gap:6},
  metric:{flex:1,minHeight:56,borderRadius:12,backgroundColor:'#F7FAF8',padding:8,justifyContent:'center'},
  metricValue:{fontSize:15,fontWeight:'900',color:'#173C2C'}, metricLabel:{marginTop:2,fontSize:7,fontWeight:'900',color:'#7A887F'},
  estimate:{borderRadius:12,backgroundColor:'#F1F7F3',padding:10}, estimateLabel:{fontSize:8,fontWeight:'900',color:'#4C6859'},
  estimateValue:{marginTop:2,fontSize:17,fontWeight:'900',color:'#1E6B45'}, estimateGuard:{marginTop:2,fontSize:7,lineHeight:10,fontWeight:'900',color:'#7A6A32'},
  primary:{minHeight:36,borderRadius:10,backgroundColor:'#1E6B45',alignItems:'center',justifyContent:'center'}, primaryText:{color:'#FFF',fontSize:9,fontWeight:'900'},
  secondary:{minHeight:34,borderRadius:10,borderWidth:1,borderColor:'#CFE0D6',alignItems:'center',justifyContent:'center',paddingHorizontal:8}, secondaryText:{color:'#1E6B45',fontSize:8.5,fontWeight:'900'},
});
