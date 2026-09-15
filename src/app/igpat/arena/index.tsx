import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { igpatArenaModeLabel, igpatArenaStatusLabel } from '@/lib/igpat/arena';

type ArenaScope = 'mine' | 'open' | 'completed';
type ArenaRow = {
  id: string; mode: string; title?: string | null; status: string;
  creator_user_id: string; creator_name: string; opponent_user_id?: string | null;
  opponent_name?: string | null; winner_user_id?: string | null; winner_name?: string | null;
  result_count?: number | null; respect_score?: number | null; created_at?: string | null;
};
type RankingRow = {
  user_id: string; display_name: string; completed_entries: number; wins: number;
  respect_received: number; arena_score: number;
};

const SCOPES: Array<{ key: ArenaScope; label: string }> = [
  { key: 'mine', label: 'MY ARENA' },
  { key: 'open', label: 'OPEN' },
  { key: 'completed', label: 'COMPLETE' },
];

const ARENA_FEATURES = [
  { route: '/igpat/arena/squad', icon: 'account-group-outline', title: 'SQUAD', helper: 'Consent-based team battles' },
  { route: '/igpat/arena/last-man', icon: 'tournament', title: 'LAST MAN', helper: 'Deterministic elimination' },
  { route: '/igpat/arena/hill', icon: 'crown-outline', title: 'THE HILL', helper: 'Approved champions' },
  { route: '/igpat/arena/boss', icon: 'flag-checkered', title: 'BOSS', helper: 'Cluster objective' },
  { route: '/igpat/arena/streak', icon: 'fire', title: 'IRON STREAK', helper: 'Real completion days' },
  { route: '/igpat/arena/season', icon: 'podium-gold', title: 'SEASON', helper: 'Arena-only ranking' },
  { route: '/igpat/arena/badges', icon: 'shield-star-outline', title: 'SKILL BADGES', helper: 'Transparent criteria' },
  { route: '/igpat/arena/bounty', icon: 'medal-outline', title: 'BOUNTY', helper: 'Symbolic rewards only' },
  { route: '/igpat/arena/record', icon: 'chart-box-outline', title: 'MY RECORD', helper: 'Structured W/L only' },
] as const;

function dateLabel(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
}

export default function IgpatArenaScreen() {
  const [scope, setScope] = useState<ArenaScope>('mine');
  const [rows, setRows] = useState<ArenaRow[]>([]);
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [showRankings, setShowRankings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (showRankings) {
        const { data, error: rankError } = await (supabase as any).rpc('get_buklod_igpat_arena_rankings_v1', { p_limit: 50 });
        if (rankError) throw rankError;
        setRankings((data ?? []) as RankingRow[]);
      } else {
        const { data, error: arenaError } = await (supabase as any).rpc('get_buklod_igpat_arena_v2', { p_scope: scope, p_limit: 40 });
        if (arenaError) throw arenaError;
        setRows((data ?? []) as ArenaRow[]);
      }
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Arena:', String(loadError?.message ?? loadError));
      setError('Arena is not available yet. The secured IGPAT server update may still need to be applied.');
      if (showRankings) setRankings([]); else setRows([]);
    } finally { setLoading(false); }
  }, [scope, showRankings]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>BUKLOD IGPAT</Text><Text style={styles.title}>Arena</Text><Text style={styles.subtitle}>Mastery, discipline, achievement, team identity and earned Respect—without humiliation.</Text></View>
      </View>

      <View style={styles.ruleCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={19} color="#D9FF69" />
        <View style={styles.ruleCopy}><Text style={styles.ruleTitle}>INTENTIONAL COMPETITION ONLY</Text><Text style={styles.ruleText}>Arena stays outside passive Watch. Results come from actual submissions and unique Respect—not engagement farming, wagering, or forced participation.</Text></View>
      </View>

      <View style={styles.primaryActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Start Arena challenge" style={styles.createButton} onPress={() => router.push('/igpat/arena/create' as any)}><MaterialCommunityIcons name="sword-cross" size={18} color="#07100B" /><Text style={styles.createText}>START CHALLENGE</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={showRankings ? 'Show Arena challenges' : 'Show Arena rankings'} style={[styles.rankButton, showRankings && styles.rankButtonActive]} onPress={() => setShowRankings(current => !current)}><MaterialCommunityIcons name="podium" size={18} color={showRankings ? '#07100B' : '#FFFFFF'} /><Text style={[styles.rankText, showRankings && styles.rankTextActive]}>{showRankings ? 'CHALLENGES' : 'RANKINGS'}</Text></Pressable>
      </View>

      <Text style={styles.featureLabel}>ARENA MODES & PROGRESS</Text>
      <View style={styles.featureGrid}>
        {ARENA_FEATURES.map(feature => (
          <Pressable key={feature.route} accessibilityRole="button" accessibilityLabel={`Open ${feature.title} Arena mode`} style={styles.featureTile} onPress={() => router.push(feature.route as any)}>
            <MaterialCommunityIcons name={feature.icon as any} size={18} color={['THE HILL','SQUAD','LAST MAN'].includes(feature.title) ? '#D9FF69' : '#FFFFFF'} />
            <Text style={styles.featureTitle}>{feature.title}</Text><Text style={styles.featureHelper}>{feature.helper}</Text>
          </Pressable>
        ))}
      </View>

      {!showRankings ? <View style={styles.scopeTabs}>{SCOPES.map(option => <Pressable key={option.key} accessibilityRole="tab" accessibilityState={{ selected: scope === option.key }} accessibilityLabel={`${option.label} Arena challenges`} style={[styles.scopeTab, scope===option.key&&styles.scopeTabActive]} onPress={() => setScope(option.key)}><Text style={[styles.scopeText,scope===option.key&&styles.scopeTextActive]}>{option.label}</Text></Pressable>)}</View> : null}

      {loading ? <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading Arena…</Text></View> : error ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry Arena" style={styles.retryButton} onPress={() => void load()}><Text style={styles.retryText}>RETRY</Text></Pressable></View>
      ) : showRankings ? (
        rankings.length ? <View style={styles.list}>{rankings.map((row,index)=><View key={row.user_id} style={styles.rankCard}><View style={styles.rankNumber}><Text style={styles.rankNumberText}>{index+1}</Text></View><View style={styles.rankMain}><Text style={styles.rankName} numberOfLines={1}>{row.display_name}</Text><Text style={styles.rankStats}>{row.wins} wins · {row.completed_entries} completed · {row.respect_received} Respect</Text></View><View style={styles.scoreBadge}><Text style={styles.scoreValue}>{row.arena_score}</Text><Text style={styles.scoreLabel}>ARENA SCORE</Text></View></View>)}<Text style={styles.rankFootnote}>Arena ranking never applies to normal social posts or other BUKLOD point/rank systems.</Text></View> : <View style={styles.stateCard}><Text style={styles.stateText}>No completed Arena records yet.</Text></View>
      ) : rows.length ? (
        <View style={styles.list}>{rows.map(row=><Pressable accessibilityRole="button" accessibilityLabel={`Open ${igpatArenaModeLabel(row.mode)} challenge`} key={row.id} style={styles.card} onPress={() => router.push(`/igpat/arena/${row.id}` as any)}><View style={styles.cardTop}><Text style={styles.mode}>{igpatArenaModeLabel(row.mode).toUpperCase()}</Text><Text style={styles.status}>{igpatArenaStatusLabel(row.status)}</Text></View><Text style={styles.cardTitle} numberOfLines={2}>{row.title?.trim()||igpatArenaModeLabel(row.mode)}</Text><Text style={styles.match} numberOfLines={1}>{row.creator_name}{row.opponent_name?`  vs  ${row.opponent_name}`:' · open challenge'}</Text><View style={styles.cardBottom}><Text style={styles.meta}>{Number(row.result_count??0)} submissions · {Number(row.respect_score??0)} Respect</Text><Text style={styles.meta}>{dateLabel(row.created_at)}</Text></View>{row.winner_name?<Text style={styles.winner}>RESULT · {row.winner_name}</Text>:null}</Pressable>)}</View>
      ) : <View style={styles.stateCard}><Text style={styles.stateText}>No Arena challenges in this view yet.</Text></View>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#050807'},content:{padding:18,paddingTop:54,paddingBottom:48},headerRow:{flexDirection:'row',alignItems:'flex-start',gap:12},backButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.15)',backgroundColor:'#0D120F'},headerCopy:{flex:1},eyebrow:{color:'rgba(255,255,255,0.46)',fontSize:9,fontWeight:'900',letterSpacing:1.2},title:{marginTop:4,color:'#FFFFFF',fontSize:28,fontWeight:'900'},subtitle:{marginTop:5,color:'rgba(255,255,255,0.58)',fontSize:11,lineHeight:17},ruleCard:{marginTop:20,borderRadius:17,borderWidth:1,borderColor:'rgba(217,255,105,0.20)',backgroundColor:'#10150D',padding:14,flexDirection:'row',gap:11,alignItems:'flex-start'},ruleCopy:{flex:1},ruleTitle:{color:'#D9FF69',fontSize:9,fontWeight:'900',letterSpacing:.8},ruleText:{marginTop:4,color:'rgba(255,255,255,0.56)',fontSize:9.5,lineHeight:15},primaryActions:{marginTop:14,flexDirection:'row',gap:9},createButton:{flex:1,minHeight:48,borderRadius:15,backgroundColor:'#FFFFFF',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},createText:{color:'#07100B',fontSize:9,fontWeight:'900',letterSpacing:.7},rankButton:{minWidth:122,minHeight:48,paddingHorizontal:13,borderRadius:15,borderWidth:1,borderColor:'rgba(255,255,255,0.18)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:'#0D120F'},rankButtonActive:{backgroundColor:'#FFFFFF',borderColor:'#FFFFFF'},rankText:{color:'#FFFFFF',fontSize:8.5,fontWeight:'900',letterSpacing:.6},rankTextActive:{color:'#07100B'},featureLabel:{marginTop:18,marginBottom:8,color:'rgba(255,255,255,0.38)',fontSize:8,fontWeight:'900',letterSpacing:.8},featureGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},featureTile:{width:'48%',minHeight:88,borderRadius:15,borderWidth:1,borderColor:'rgba(255,255,255,0.11)',backgroundColor:'#0D120F',padding:11,justifyContent:'center'},featureTitle:{marginTop:7,color:'#FFFFFF',fontSize:8.5,fontWeight:'900',letterSpacing:.5},featureHelper:{marginTop:3,color:'rgba(255,255,255,0.36)',fontSize:7.7,lineHeight:11},scopeTabs:{marginTop:16,padding:3,borderRadius:999,backgroundColor:'#0D120F',flexDirection:'row'},scopeTab:{flex:1,minHeight:44,borderRadius:999,alignItems:'center',justifyContent:'center'},scopeTabActive:{backgroundColor:'#FFFFFF'},scopeText:{color:'rgba(255,255,255,0.58)',fontSize:8.5,fontWeight:'900',letterSpacing:.5},scopeTextActive:{color:'#07100B'},centerState:{marginTop:40,alignItems:'center',gap:10},stateCard:{marginTop:22,borderRadius:17,borderWidth:1,borderColor:'rgba(255,255,255,0.12)',backgroundColor:'#0D120F',padding:18},stateText:{color:'rgba(255,255,255,0.62)',fontSize:10.5,lineHeight:16,textAlign:'center'},retryButton:{marginTop:13,alignSelf:'center',minHeight:44,justifyContent:'center',paddingHorizontal:17,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:'rgba(255,255,255,0.20)'},retryText:{color:'#FFFFFF',fontSize:8.5,fontWeight:'900',letterSpacing:.7},list:{marginTop:18,gap:10},card:{minHeight:108,borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,0.12)',backgroundColor:'#0D120F',padding:15},cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},mode:{color:'#D9FF69',fontSize:8.5,fontWeight:'900',letterSpacing:.7},status:{color:'rgba(255,255,255,0.42)',fontSize:8,fontWeight:'900',letterSpacing:.6},cardTitle:{marginTop:7,color:'#FFFFFF',fontSize:15,lineHeight:20,fontWeight:'900'},match:{marginTop:7,color:'rgba(255,255,255,0.70)',fontSize:10.5,fontWeight:'700'},cardBottom:{marginTop:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},meta:{color:'rgba(255,255,255,0.38)',fontSize:8.5},winner:{marginTop:10,color:'#D9FF69',fontSize:9,fontWeight:'900',letterSpacing:.6},rankCard:{minHeight:74,borderRadius:17,borderWidth:1,borderColor:'rgba(255,255,255,0.12)',backgroundColor:'#0D120F',padding:12,flexDirection:'row',alignItems:'center',gap:11},rankNumber:{width:34,height:34,borderRadius:17,backgroundColor:'rgba(255,255,255,0.08)',alignItems:'center',justifyContent:'center'},rankNumberText:{color:'#FFFFFF',fontSize:11,fontWeight:'900'},rankMain:{flex:1},rankName:{color:'#FFFFFF',fontSize:11.5,fontWeight:'900'},rankStats:{marginTop:4,color:'rgba(255,255,255,0.44)',fontSize:8.5},scoreBadge:{alignItems:'flex-end'},scoreValue:{color:'#D9FF69',fontSize:17,fontWeight:'900'},scoreLabel:{color:'rgba(255,255,255,0.32)',fontSize:6.8,fontWeight:'900',letterSpacing:.6},rankFootnote:{marginTop:6,color:'rgba(255,255,255,0.38)',fontSize:8.5,lineHeight:13,textAlign:'center'}
});
