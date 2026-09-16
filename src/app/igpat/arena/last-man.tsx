import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type Participant = { user_id: string; name: string; status: string; joined_at?: string | null; eliminated_round?: number | null };
type Entry = { user_id: string; name: string; post_id?: string | null; respect_received?: number | null; submitted_at?: string | null; advanced?: boolean | null; my_vote?: boolean };
type Event = {
  id: string; category: string; max_participants: number; status: string; current_round: number;
  creator_user_id: string; creator_name: string; champion_user_id?: string | null; champion_name?: string | null;
  is_creator?: boolean; my_status?: string | null; participants?: Participant[]; entries?: Entry[]; created_at?: string | null;
};
type MyIgpat = { id: string; body?: string | null; created_at?: string | null };
type Hub = { events?: Event[]; my_igpats?: MyIgpat[] };

const CATEGORIES = ['sports','preaching','singing','teaching','creativity','fitness','craftsmanship','trivia','skills'] as const;

function title(value: string) {
  return value.split('_').map(word => word ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
}

export default function IgpatLastManStandingScreen() {
  const { user } = useAuth();
  const [hub, setHub] = useState<Hub>({});
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('skills');
  const [cap, setCap] = useState(8);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: loadError } = await (supabase as any).rpc('get_buklod_igpat_lms_hub_v1');
      if (loadError) throw loadError;
      setHub((data ?? {}) as Hub);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT Last Man Standing:', String(loadError?.message ?? loadError));
      setError('Last Man Standing is not available yet. The secured Arena server update may still need to be applied.');
      setHub({});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, rpc: string, args: Record<string, unknown> = {}, success?: string) => {
    if (busy) return;
    setBusy(key);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(rpc, args);
      if (rpcError) throw rpcError;
      if (success) Alert.alert('Last Man Standing', success);
      if (rpc === 'igpat_advance_lms_round_v1' && data?.completed) Alert.alert('Last Man Standing', 'Champion confirmed from the published deterministic advancement rule.');
      await load();
    } catch (actionError: any) {
      Alert.alert('Arena Action Failed', String(actionError?.message ?? actionError));
    } finally { setBusy(null); }
  };

  const events = hub.events ?? [];
  const igpats = hub.my_igpats ?? [];
  const hasOwnedOpen = useMemo(() => events.some(event => event.is_creator && ['OPEN','ACTIVE'].includes(event.status)), [events]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}><MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text><Text style={styles.title}>Last Man Standing</Text><Text style={styles.subtitle}>Structured elimination only: everyone opts in, every active participant submits a real IGPAT, and advancement is deterministic—not random.</Text></View>
      </View>

      <View style={styles.ruleCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={20} color="#D9FF69" />
        <View style={styles.flex}><Text style={styles.ruleTitle}>PREDICTABLE ADVANCEMENT</Text><Text style={styles.ruleText}>Each round advances the top half by unique outside Respect. Voting opens only after the full active field has submitted and only for viewers who can see every active entry. Ties are resolved by earlier verified submission, then a stable account identifier. Participants cannot vote.</Text></View>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading elimination events…</Text></View> : error ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry Last Man Standing" style={styles.smallButton} onPress={() => void load()}><Text style={styles.smallText}>RETRY</Text></Pressable></View>
      ) : (
        <>
          {!hasOwnedOpen ? (
            <View style={styles.createCard}>
              <Text style={styles.sectionTitle}>CREATE A STRUCTURED EVENT</Text>
              <Text style={styles.helper}>No custom call-out text is used here, reducing harassment. Pick a clear skill category and participant cap.</Text>
              <View style={styles.chips}>{CATEGORIES.map(value => <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${title(value)} category`} key={value} style={[styles.chip,category===value&&styles.chipActive]} onPress={() => setCategory(value)}><Text style={[styles.chipText,category===value&&styles.chipTextActive]}>{title(value).toUpperCase()}</Text></Pressable>)}</View>
              <Text style={styles.label}>MAX PARTICIPANTS</Text>
              <View style={styles.row}>{[4,8,12,16].map(value => <Pressable accessibilityRole="button" accessibilityLabel={`Set maximum participants to ${value}`} key={value} style={[styles.capButton,cap===value&&styles.capActive]} onPress={() => setCap(value)}><Text style={[styles.capText,cap===value&&styles.capTextActive]}>{value}</Text></Pressable>)}</View>
              <Pressable accessibilityRole="button" accessibilityLabel="Create Last Man Standing event" disabled={!!busy} style={styles.primaryButton} onPress={() => void run('create','igpat_create_lms_event_v1',{p_category:category,p_max_participants:cap},'Last Man Standing event opened for voluntary joining.')}><MaterialCommunityIcons name="tournament" size={18} color="#07100B" /><Text style={styles.primaryText}>CREATE EVENT</Text></Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EVENTS</Text>
            {events.length ? events.map(event => {
              const activeParticipants = (event.participants ?? []).filter(p => p.status === 'ACTIVE');
              const joined = Boolean(event.my_status && event.my_status !== 'LEFT');
              const activeMe = event.my_status === 'ACTIVE';
              const selected = selectedPosts[event.id] ?? igpats[0]?.id ?? '';
              const myEntry = (event.entries ?? []).find(entry => entry.user_id === user?.id);
              const activeEntries = (event.entries ?? []).filter(entry => activeParticipants.some(p => p.user_id === entry.user_id));
              const allSubmitted = event.status === 'ACTIVE' && activeParticipants.length > 1 && activeEntries.length === activeParticipants.length;
              const allVisibleToMe = allSubmitted && activeEntries.every(entry => Boolean(entry.post_id));
              const canVote = event.status === 'ACTIVE' && !joined && allVisibleToMe;
              return (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventTop}><View style={styles.flex}><Text style={styles.eventTitle}>{title(event.category)} · {event.status}</Text><Text style={styles.meta}>Host {event.creator_name} · Round {event.current_round || 'Lobby'} · {(event.participants ?? []).filter(p=>p.status!=='LEFT').length}/{event.max_participants}</Text></View>{event.champion_name ? <MaterialCommunityIcons name="trophy-outline" size={22} color="#D9FF69" /> : null}</View>
                  {event.champion_name ? <Text style={styles.champion}>CHAMPION · {event.champion_name}</Text> : null}
                  <View style={styles.participants}>{(event.participants ?? []).map(participant => <View key={participant.user_id} style={[styles.personChip,participant.status==='ELIMINATED'&&styles.eliminated]}><Text style={styles.personText}>{participant.name}</Text><Text style={styles.personStatus}>{participant.status}{participant.eliminated_round ? ` · R${participant.eliminated_round}` : ''}</Text></View>)}</View>

                  {event.status === 'OPEN' ? (
                    <View style={styles.row}>
                      {!joined ? <Pressable accessibilityRole="button" accessibilityLabel="Join Last Man Standing event" disabled={!!busy} style={styles.primarySmall} onPress={() => void run(`join:${event.id}`,'igpat_join_lms_event_v1',{p_event_id:event.id},'You joined voluntarily.')}><Text style={styles.primarySmallText}>JOIN</Text></Pressable> : null}
                      {joined && !event.is_creator ? <Pressable accessibilityRole="button" accessibilityLabel="Leave Last Man Standing event" disabled={!!busy} style={styles.smallButton} onPress={() => void run(`leave:${event.id}`,'igpat_leave_lms_event_v1',{p_event_id:event.id},'You left before elimination began.')}><Text style={styles.smallText}>LEAVE</Text></Pressable> : null}
                      {event.is_creator ? <Pressable accessibilityRole="button" accessibilityLabel="Start Last Man Standing event" disabled={!!busy || activeParticipants.length<4} style={[styles.primarySmall,activeParticipants.length<4&&styles.disabled]} onPress={() => void run(`start:${event.id}`,'igpat_start_lms_event_v1',{p_event_id:event.id},'Round 1 started. Every active participant must submit before advancement.')}><Text style={styles.primarySmallText}>START · MIN 4</Text></Pressable> : null}
                      {event.is_creator ? <Pressable accessibilityRole="button" accessibilityLabel="Cancel open Last Man Standing event" disabled={!!busy} style={styles.smallButton} onPress={() => void run(`cancel:${event.id}`,'igpat_leave_lms_event_v1',{p_event_id:event.id},'Open event cancelled.')}><Text style={styles.smallText}>CANCEL</Text></Pressable> : null}
                    </View>
                  ) : null}

                  {event.status === 'ACTIVE' ? (
                    <>
                      <Text style={styles.label}>ROUND {event.current_round} ENTRIES</Text>
                      {!joined && !allSubmitted ? <Text style={styles.helper}>Outside Respect opens after every active participant submits this round.</Text> : null}
                      {!joined && allSubmitted && !allVisibleToMe ? <Text style={styles.helper}>Respect is unavailable to this account because not every active entry is currently viewable.</Text> : null}
                      {(event.entries ?? []).length ? (event.entries ?? []).map(entry => (
                        <View key={entry.user_id} style={styles.entryRow}>
                          <View style={styles.flex}><Text style={styles.entryName}>{entry.name}</Text><Text style={styles.meta}>{Number(entry.respect_received??0)} Respect{entry.advanced===true?' · ADVANCED':entry.advanced===false?' · ELIMINATED':''}</Text></View>
                          {entry.post_id ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${entry.name} IGPAT`} style={styles.openButton} onPress={() => router.push(`/post/${entry.post_id}` as any)}><Text style={styles.openText}>VIEW</Text></Pressable> : <Text style={styles.meta}>PRIVATE</Text>}
                          {canVote && entry.post_id ? <Pressable accessibilityRole="button" accessibilityLabel={`Give Respect to ${entry.name}`} disabled={!!busy} style={[styles.voteButton,entry.my_vote&&styles.voteActive]} onPress={() => void run(`vote:${event.id}:${entry.user_id}`,'igpat_vote_lms_v1',{p_event_id:event.id,p_participant_user_id:entry.user_id})}><Text style={[styles.voteText,entry.my_vote&&styles.voteTextActive]}>{entry.my_vote?'RESPECTED':'RESPECT'}</Text></Pressable> : null}
                        </View>
                      )) : <Text style={styles.helper}>Waiting for verified IGPAT submissions.</Text>}

                      {activeMe && igpats.length ? (
                        <View style={styles.submitBox}>
                          <Text style={styles.helper}>{myEntry ? 'You may replace your round IGPAT only before outside Respect voting begins. Once voting starts, the entry is locked for fairness.' : 'Choose one of your real IGPATs for this round. Once outside Respect voting begins, the entry is locked for fairness.'}</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.igpatRow}>{igpats.slice(0,12).map(post => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${post.body?.trim() || 'IGPAT'} for this round`} key={post.id} style={[styles.igpatChip,selected===post.id&&styles.igpatSelected]} onPress={() => setSelectedPosts(current=>({...current,[event.id]:post.id}))}><Text style={[styles.igpatText,selected===post.id&&styles.igpatTextSelected]} numberOfLines={1}>{post.body?.trim()||'IGPAT'}</Text></Pressable>)}</ScrollView>
                          <Pressable accessibilityRole="button" accessibilityLabel={myEntry?'Update round entry':'Submit round entry'} disabled={!!busy||!selected} style={styles.primarySmall} onPress={() => void run(`submit:${event.id}`,'igpat_submit_lms_entry_v1',{p_event_id:event.id,p_post_id:selected},myEntry?'Round entry updated.':'Round entry submitted.')}><Text style={styles.primarySmallText}>{myEntry?'UPDATE ENTRY':'SUBMIT ENTRY'}</Text></Pressable>
                        </View>
                      ) : null}

                      {(event.is_creator || activeMe) && allSubmitted ? <Pressable accessibilityRole="button" accessibilityLabel="Advance Last Man Standing round by published rule" disabled={!!busy} style={styles.advanceButton} onPress={() => void run(`advance:${event.id}`,'igpat_advance_lms_round_v1',{p_event_id:event.id})}><MaterialCommunityIcons name="arrow-right-bold-outline" size={17} color="#07100B" /><Text style={styles.advanceText}>ADVANCE BY PUBLISHED RULE</Text></Pressable> : null}
                    </>
                  ) : null}
                </View>
              );
            }) : <View style={styles.stateCard}><Text style={styles.stateText}>No Last Man Standing events yet.</Text></View>}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#050807'},content:{padding:18,paddingTop:54,paddingBottom:48},headerRow:{flexDirection:'row',gap:12,alignItems:'flex-start'},backButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.15)',backgroundColor:'#0D120F'},headerCopy:{flex:1},eyebrow:{color:'rgba(255,255,255,0.44)',fontSize:8.5,fontWeight:'900',letterSpacing:1},title:{marginTop:4,color:'#FFFFFF',fontSize:24,fontWeight:'900'},subtitle:{marginTop:5,color:'rgba(255,255,255,0.57)',fontSize:10.5,lineHeight:16},flex:{flex:1},ruleCard:{marginTop:18,padding:14,borderRadius:17,borderWidth:1,borderColor:'rgba(217,255,105,0.18)',backgroundColor:'#10150D',flexDirection:'row',gap:10,alignItems:'flex-start'},ruleTitle:{color:'#D9FF69',fontSize:8.5,fontWeight:'900',letterSpacing:.7},ruleText:{marginTop:4,color:'rgba(255,255,255,0.58)',fontSize:9.3,lineHeight:15},center:{marginTop:44,alignItems:'center',gap:10},stateCard:{marginTop:18,padding:16,borderRadius:17,borderWidth:1,borderColor:'rgba(255,255,255,0.12)',backgroundColor:'#0D120F'},stateText:{color:'rgba(255,255,255,0.60)',fontSize:9.5,lineHeight:15,textAlign:'center'},createCard:{marginTop:20,padding:15,borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,0.12)',backgroundColor:'#0D120F'},section:{marginTop:22},sectionTitle:{marginBottom:8,color:'#FFFFFF',fontSize:9.5,fontWeight:'900',letterSpacing:.8},helper:{color:'rgba(255,255,255,0.45)',fontSize:8.8,lineHeight:14},chips:{marginTop:10,flexDirection:'row',flexWrap:'wrap',gap:6},chip:{minHeight:38,paddingHorizontal:10,borderRadius:999,borderWidth:1,borderColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'},chipActive:{backgroundColor:'#FFFFFF',borderColor:'#FFFFFF'},chipText:{color:'rgba(255,255,255,0.63)',fontSize:7.5,fontWeight:'900'},chipTextActive:{color:'#07100B'},label:{marginTop:15,marginBottom:7,color:'rgba(255,255,255,0.42)',fontSize:8,fontWeight:'900',letterSpacing:.7},row:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:8},capButton:{width:48,height:44,borderRadius:12,borderWidth:1,borderColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'},capActive:{backgroundColor:'#FFFFFF'},capText:{color:'#FFFFFF',fontSize:9,fontWeight:'900'},capTextActive:{color:'#07100B'},primaryButton:{marginTop:14,minHeight:48,borderRadius:15,backgroundColor:'#FFFFFF',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},primaryText:{color:'#07100B',fontSize:9,fontWeight:'900',letterSpacing:.6},eventCard:{marginBottom:10,padding:14,borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,0.12)',backgroundColor:'#0D120F'},eventTop:{flexDirection:'row',alignItems:'center',gap:8},eventTitle:{color:'#FFFFFF',fontSize:12,fontWeight:'900'},meta:{marginTop:3,color:'rgba(255,255,255,0.40)',fontSize:8,lineHeight:12},champion:{marginTop:8,color:'#D9FF69',fontSize:9,fontWeight:'900',letterSpacing:.6},participants:{marginTop:9,flexDirection:'row',flexWrap:'wrap',gap:6},personChip:{paddingHorizontal:9,minHeight:34,borderRadius:999,backgroundColor:'rgba(217,255,105,0.08)',justifyContent:'center'},eliminated:{backgroundColor:'rgba(255,255,255,0.05)',opacity:.65},personText:{color:'#FFFFFF',fontSize:8,fontWeight:'800'},personStatus:{marginTop:1,color:'rgba(255,255,255,0.34)',fontSize:6.5,fontWeight:'900'},primarySmall:{minHeight:44,paddingHorizontal:13,borderRadius:999,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},primarySmallText:{color:'#07100B',fontSize:8,fontWeight:'900',letterSpacing:.5},smallButton:{minHeight:44,paddingHorizontal:13,borderRadius:999,borderWidth:1,borderColor:'rgba(255,255,255,0.20)',alignItems:'center',justifyContent:'center'},smallText:{color:'#FFFFFF',fontSize:8,fontWeight:'900'},disabled:{opacity:.4},entryRow:{marginTop:7,minHeight:54,padding:10,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.09)',flexDirection:'row',alignItems:'center',gap:8},entryName:{color:'#FFFFFF',fontSize:9.5,fontWeight:'900'},openButton:{minHeight:40,paddingHorizontal:10,justifyContent:'center'},openText:{color:'#FFFFFF',fontSize:7.5,fontWeight:'900'},voteButton:{minHeight:40,paddingHorizontal:10,borderRadius:999,borderWidth:1,borderColor:'rgba(255,255,255,0.18)',justifyContent:'center'},voteActive:{backgroundColor:'#D9FF69',borderColor:'#D9FF69'},voteText:{color:'#FFFFFF',fontSize:7.2,fontWeight:'900'},voteTextActive:{color:'#07100B'},submitBox:{marginTop:10,paddingTop:8,borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.08)'},igpatRow:{gap:7,paddingVertical:8},igpatChip:{maxWidth:180,minHeight:42,paddingHorizontal:12,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.14)',justifyContent:'center'},igpatSelected:{backgroundColor:'#FFFFFF'},igpatText:{color:'#FFFFFF',fontSize:8.4},igpatTextSelected:{color:'#07100B',fontWeight:'900'},advanceButton:{marginTop:12,minHeight:48,borderRadius:15,backgroundColor:'#D9FF69',flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'},advanceText:{color:'#07100B',fontSize:8.5,fontWeight:'900',letterSpacing:.6}
});