import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type WallPost = {
  id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  is_hidden: boolean;
  is_reel: boolean;
  media_mime_type: string | null;
};
type Status = 'ALL' | 'VISIBLE' | 'HIDDEN';

export default function BuklodOfficialWallControl() {
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('ALL');
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [active, setActive] = useState<WallPost | null>(null);
  const [reason, setReason] = useState('');
  const serial = useRef(0);
  const cursor = useRef<{ created: string; id: string } | null>(null);

  const load = useCallback(async (append: boolean) => {
    if (append && cursor.current === null) return;
    const generation = ++serial.current;
    setLoading(true);
    setProblem('');
    try {
      const { data, error } = await (supabase as any).rpc('admin_list_buklod_official_wall_v1', {
        p_limit: 30,
        p_before_created: append ? cursor.current?.created : null,
        p_before_id: append ? cursor.current?.id : null,
        p_status: status,
        p_search: query || null,
      });
      if (error) throw error;
      if (generation !== serial.current) return;
      const incoming = Array.isArray(data?.rows) ? data.rows as WallPost[] : [];
      setPosts(current => append ? [...current, ...incoming.filter(row => !current.some(old => old.id === row.id))] : incoming);
      const last = incoming[incoming.length - 1];
      cursor.current = incoming.length === 30 && last ? { created: last.created_at, id: last.id } : null;
      setMore(cursor.current !== null);
    } catch (e: any) {
      if (generation === serial.current) setProblem(e?.message || 'Unable to load Wall posts.');
    } finally {
      if (generation === serial.current) setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    cursor.current = null;
    void load(false);
    return () => { serial.current += 1; };
  }, [load]);

  const moderate = async () => {
    if (!active || reason.trim().length < 8 || busy) return;
    setBusy(true);
    setProblem('');
    try {
      const { data, error } = await (supabase as any).rpc('admin_set_buklod_official_wall_visibility_v1', {
        p_post_id: active.id, p_hide: !active.is_hidden, p_reason: reason.trim(),
      });
      if (error) throw error;
      const hidden = data?.is_hidden === true;
      setPosts(previous => previous.map(p => p.id === active.id ? { ...p, is_hidden: hidden } : p));
      setActive(null);
      setReason('');
      await load(false);
    } catch (e: any) {
      setProblem(e?.message || 'Moderation action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGate>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading && !more} onRefresh={() => void load(false)} />}>
        <View style={styles.hero}>
          <MaterialCommunityIcons name="shield-check-outline" size={27} color="#216D47" />
          <View style={styles.fill}>
            <Text style={styles.title}>Wall Control Center</Text>
            <Text style={styles.secondary}>Review all public posts, open details and apply audited soft takedowns. Nothing is physically deleted.</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.greenButton} onPress={() => router.push('/(tabs)/buklod' as any)}>
            <Text style={styles.white}>OPEN WALL / POST AS BUKLOD</Text>
          </Pressable>
          <Pressable style={styles.lightButton} onPress={() => router.push('/admin/content-reports' as any)}>
            <Text style={styles.dark}>REPORTED CONTENT</Text>
          </Pressable>
        </View>
        <View style={styles.filters}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search caption or author" style={styles.input} />
          <Pressable onPress={() => setQuery(search.trim())} style={styles.lightButton}><Text style={styles.dark}>SEARCH</Text></Pressable>
        </View>
        <View style={styles.filters}>
          {(['ALL','VISIBLE','HIDDEN'] as Status[]).map(v => (
            <Pressable key={v} style={[styles.filter, status===v&&styles.selected]} onPress={() => setStatus(v)}>
              <Text style={[styles.filterText,status===v&&styles.white]}>{v}</Text>
            </Pressable>
          ))}
        </View>
        {!!problem && <Text style={styles.error}>{problem}</Text>}
        {loading && posts.length===0 && <ActivityIndicator color="#216D47" />}
        {posts.map(post => (
          <View key={post.id} style={styles.post}>
            <View style={styles.header}>
              <View style={styles.fill}>
                <Text style={styles.author}>{post.author_name}</Text>
                <Text style={styles.secondary}>{new Date(post.created_at).toLocaleString('en-PH')} · {post.media_mime_type || 'Text'}</Text>
              </View>
              <Text style={post.is_hidden ? styles.hidden : styles.visible}>{post.is_hidden?'HIDDEN':'VISIBLE'}</Text>
            </View>
            <Text style={styles.body} numberOfLines={5}>{post.body}</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } } as never)} style={styles.lightButton}>
                <Text style={styles.dark}>VIEW POST</Text>
              </Pressable>
              <Pressable style={post.is_hidden ? styles.lightButton : styles.dangerButton} onPress={() => { setActive(post);setReason(''); }}>
                <Text style={post.is_hidden ? styles.dark : styles.white}>{post.is_hidden?'RESTORE':'HIDE / TAKEDOWN'}</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {more && <Pressable style={styles.lightButton} onPress={() => void load(true)} disabled={loading}>
          <Text style={styles.dark}>{loading?'LOADING...':'LOAD MORE POSTS'}</Text>
        </Pressable>}
        {!loading && posts.length===0 && !problem && <Text style={styles.secondary}>No matching public Wall posts.</Text>}
      </ScrollView>

      <Modal transparent visible={!!active} animationType="fade" onRequestClose={() => setActive(null)}>
        <View style={styles.scrim}>
          <View style={styles.modal}>
            <Text style={styles.title}>{active?.is_hidden?'Restore post':'Hide post'}</Text>
            <Text style={styles.secondary}>
              {active?.is_hidden
                ? 'Restoration is allowed only for a prior BUKLOD Official takedown; unrelated privacy/safety hides remain protected.'
                : 'The post will disappear from public views. Media and history remain available for audit.'}
            </Text>
            <TextInput value={reason} onChangeText={setReason} multiline placeholder="Required moderation reason (minimum 8 characters)" style={[styles.input,{minHeight:90}]} />
            <View style={styles.actions}>
              <Pressable style={styles.lightButton} onPress={() => setActive(null)} disabled={busy}><Text style={styles.dark}>CANCEL</Text></Pressable>
              <Pressable style={[styles.dangerButton,(busy||reason.trim().length<8)&&{opacity:0.5}]} onPress={() => void moderate()} disabled={busy||reason.trim().length<8}>
                <Text style={styles.white}>{busy?'SAVING...':'CONFIRM ACTION'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminGate>
  );
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#F4F8F5'},content:{padding:16,paddingBottom:56,gap:13,maxWidth:760,width:'100%',alignSelf:'center'},
  hero:{flexDirection:'row',gap:12,alignItems:'center',backgroundColor:'white',padding:18,borderRadius:16},
  title:{fontSize:20,fontWeight:'900',color:'#203D2B'},secondary:{fontSize:12,color:'#617569',lineHeight:18},fill:{flex:1},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},greenButton:{borderRadius:11,padding:12,backgroundColor:'#216D47'},
  lightButton:{borderRadius:11,padding:11,backgroundColor:'#E9F2EC'},dangerButton:{borderRadius:11,padding:11,backgroundColor:'#983B3B'},
  white:{color:'white',fontSize:12,fontWeight:'900'},dark:{color:'#25583D',fontSize:12,fontWeight:'900'},
  filters:{flexDirection:'row',gap:8,alignItems:'center'},input:{flex:1,backgroundColor:'white',color:'#1B3926',borderWidth:1,borderColor:'#CADBCC',borderRadius:10,padding:12},
  filter:{paddingHorizontal:13,paddingVertical:8,backgroundColor:'#E9F2EC',borderRadius:10},selected:{backgroundColor:'#216D47'},
  filterText:{fontWeight:'800',fontSize:12,color:'#216D47'},error:{color:'#A22D2D',fontWeight:'700',fontSize:13},
  post:{backgroundColor:'white',borderRadius:14,padding:15,gap:10,borderWidth:1,borderColor:'#E0E9E2'},header:{flexDirection:'row',gap:8},
  author:{fontSize:14,fontWeight:'900',color:'#203D2B'},body:{fontSize:13,color:'#304638',lineHeight:20},
  visible:{fontSize:10,fontWeight:'900',color:'#216D47'},hidden:{fontSize:10,fontWeight:'900',color:'#983B3B'},
  scrim:{flex:1,justifyContent:'center',padding:22,backgroundColor:'rgba(0,0,0,0.45)'},
  modal:{backgroundColor:'white',padding:20,borderRadius:18,gap:13,width:'100%',maxWidth:550,alignSelf:'center'},
});
