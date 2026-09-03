import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadClassrooms, type ClassroomCard } from '../../src/core';

function standingColor(item: ClassroomCard) {
  if (item.current_percent == null) return '#738078';
  if (item.current_percent >= 75) return '#1f7a3f';
  if (item.current_percent >= 70) return '#b7791f';
  return '#b42318';
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ClassroomCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    setError('');
    try { setItems(await loadClassrooms()); }
    catch (e: any) { setError(String(e?.message ?? e ?? 'Could not load classrooms.')); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <View style={[styles.screen, { paddingTop: Math.max(insets.top, 14) }]}> 
    <View style={styles.header}><View><Text style={styles.kicker}>BUKLOD CLASSROOM</Text><Text style={styles.title}>My Classrooms</Text><Text style={styles.subtitle}>Everything you need to finish your subjects—without guessing your standing.</Text></View></View>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#1f7a3f" /></View> : error ? <View style={styles.center}><MaterialCommunityIcons name="cloud-alert-outline" size={42} color="#b42318"/><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={()=>load()}><Text style={styles.retryText}>TRY AGAIN</Text></Pressable></View> :
    <FlatList data={items} keyExtractor={x=>x.classroom_id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)} />} contentContainerStyle={{padding:16,paddingBottom:100}} ListEmptyComponent={<View style={styles.empty}><MaterialCommunityIcons name="school-outline" size={42} color="#728078"/><Text style={styles.emptyTitle}>No active classroom yet</Text><Text style={styles.emptyText}>Your enrolled subjects will appear here automatically.</Text></View>} renderItem={({item})=><Pressable onPress={()=>router.push({pathname:'/class/[id]',params:{id:item.classroom_id,name:item.class_name}})} style={({pressed})=>[styles.card,pressed&&{opacity:.78}]}> 
      <View style={styles.cardTop}><View style={styles.iconBox}><MaterialCommunityIcons name="book-open-page-variant-outline" size={25} color="#1f7a3f"/></View><View style={{flex:1}}><Text style={styles.className}>{item.class_name}</Text><Text style={styles.meta}>{[item.subject_code,item.section_name,item.term].filter(Boolean).join(' • ')}</Text></View><MaterialCommunityIcons name="chevron-right" size={23} color="#768079"/></View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={[styles.statValue,{color:standingColor(item)}]}>{item.current_percent == null ? '—' : `${Number(item.current_percent).toFixed(1)}%`}</Text><Text style={styles.statLabel}>Current standing</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{item.pending_requirements}</Text><Text style={styles.statLabel}>To do</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{item.unread_notices}</Text><Text style={styles.statLabel}>Notices</Text></View>
      </View>
      {(item.open_interventions>0 || item.next_due_at) && <View style={styles.noticeLine}>{item.open_interventions>0 && <Text style={styles.warning}>⚠ {item.open_interventions} follow-up item{item.open_interventions===1?'':'s'}</Text>}{item.next_due_at && <Text style={styles.due}>Next due {new Date(item.next_due_at).toLocaleDateString()}</Text>}</View>}
      <Text style={styles.faculty}>Faculty: {item.faculty_name}</Text>
    </Pressable>} />}
  </View>;
}

const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#f4f7f2'},header:{paddingHorizontal:20,paddingTop:10,paddingBottom:6},kicker:{fontSize:11,fontWeight:'900',letterSpacing:1.6,color:'#2b7a45'},title:{fontSize:30,fontWeight:'900',color:'#17311f'},subtitle:{marginTop:4,fontSize:13,lineHeight:19,color:'#66746c',maxWidth:540},center:{flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:10},error:{color:'#7f1d1d',textAlign:'center'},retry:{backgroundColor:'#1f7a3f',paddingHorizontal:18,paddingVertical:11,borderRadius:12},retryText:{color:'#fff',fontWeight:'900'},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dfe8e1',borderRadius:20,padding:16,marginBottom:12},cardTop:{flexDirection:'row',alignItems:'center',gap:11},iconBox:{width:46,height:46,borderRadius:14,backgroundColor:'#e7f4e9',alignItems:'center',justifyContent:'center'},className:{fontSize:17,fontWeight:'900',color:'#1d3525'},meta:{fontSize:12,color:'#728078',marginTop:2},stats:{flexDirection:'row',marginTop:15,borderTopWidth:1,borderTopColor:'#edf1ed',paddingTop:13},stat:{flex:1},statValue:{fontSize:17,fontWeight:'900',color:'#203a28'},statLabel:{fontSize:10,color:'#778279',marginTop:2},noticeLine:{marginTop:12,flexDirection:'row',justifyContent:'space-between',flexWrap:'wrap',gap:6},warning:{fontSize:11,fontWeight:'800',color:'#a15c08'},due:{fontSize:11,color:'#5f7064'},faculty:{marginTop:10,fontSize:11,color:'#718078'},empty:{paddingTop:100,alignItems:'center'},emptyTitle:{fontSize:17,fontWeight:'900',color:'#344b3a',marginTop:12},emptyText:{fontSize:13,color:'#738078',marginTop:5,textAlign:'center'}});
