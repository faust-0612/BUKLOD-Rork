import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type Member = { id: string; name: string; username: string | null };

export default function BuklodOfficialMessages() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [title, setTitle] = useState('Mensahe mula sa BUKLOD');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const nonce = useRef('');

  const lookup = async () => {
    setFeedback('');
    if (search.trim().length < 2) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_search_buklod_notice_recipients_v1', {
        p_search: search.trim(), p_limit: 20,
      });
      if (error) throw error;
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setFeedback(e?.message || 'Could not search members.');
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!selected || busy || title.trim().length < 3 || body.trim().length < 5) return;
    setBusy(true);
    setFeedback('');
    try {
      if (!nonce.current) nonce.current = 'buklod-official:' + Date.now() + ':' + Math.random().toString(36).slice(2);
      const { error } = await (supabase as any).rpc('admin_send_buklod_official_notice_v1', {
        p_recipient_id: selected.id, p_title: title.trim(), p_body: body.trim(), p_nonce: nonce.current,
      });
      if (error) throw error;
      setConfirm(false);
      setSelected(null);
      setBody('');
      nonce.current = '';
      setFeedback('Official message recorded and placed in the recipient notification inbox.');
    } catch (e: any) {
      setFeedback(e?.message || 'Official message could not be delivered.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGate>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <MaterialCommunityIcons name="email-check-outline" size={29} color="#216D47" />
          <View style={styles.fill}>
            <Text style={styles.title}>BUKLOD Official Messages</Text>
            <Text style={styles.secondary}>Send an official, individually addressed notice. Recipients see it in their notification inbox. Server-authorized and retry-safe.</Text>
          </View>
        </View>
        <Pressable style={styles.greenButton} onPress={() => router.push('/admin/system-announcement-boards' as any)}>
          <Text style={styles.white}>MANAGE PUBLIC ANNOUNCEMENTS (HOME & PROFILE)</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.subtitle}>Find an active member</Text>
          <View style={styles.row}>
            <TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Full name or username" />
            <Pressable style={styles.lightButton} onPress={() => void lookup()} disabled={loading}><Text style={styles.dark}>SEARCH</Text></Pressable>
          </View>
          {loading && <ActivityIndicator color="#216D47" />}
          {users.map(user => (
            <Pressable key={user.id} style={[styles.member,selected?.id===user.id && styles.selected]}
              onPress={() => { setSelected(user); nonce.current=''; setFeedback(''); }}>
              <MaterialCommunityIcons name={selected?.id===user.id?'check-circle':'account-outline'} size={21} color="#216D47" />
              <Text style={styles.memberName}>{user.name}{user.username ? ' · @'+user.username : ''}</Text>
            </Pressable>
          ))}
          {!!selected && <Text style={styles.selectedName}>Recipient: {selected.name}</Text>}
        </View>
        <View style={styles.card}>
          <Text style={styles.subtitle}>Compose an official message</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} maxLength={100} placeholder="Notification title" />
          <TextInput value={body} onChangeText={setBody} style={[styles.input,{height:135,textAlignVertical:'top'}]} multiline maxLength={1500} placeholder="Message to the selected member" />
          <Text style={styles.secondary}>This is a notification, not a private Connect conversation. For follow-up conversations, use BSOC Live Support or Connect.</Text>
          <Pressable style={[styles.greenButton,(!selected||body.trim().length<5||title.trim().length<3)&&styles.disabled]}
            disabled={!selected||body.trim().length<5||title.trim().length<3}
            onPress={() => setConfirm(true)}>
            <Text style={styles.white}>REVIEW & SEND TO SELECTED MEMBER</Text>
          </Pressable>
        </View>
        {!!feedback && <Text style={styles.feedback}>{feedback}</Text>}
        <Pressable style={styles.lightButton} onPress={() => router.push('/admin/bsoc-support' as any)}>
          <Text style={styles.dark}>OPEN BSOC LIVE SUPPORT</Text>
        </Pressable>
      </ScrollView>
      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={styles.scrim}>
          <View style={styles.confirm}>
            <Text style={styles.title}>Confirm official message</Text>
            <Text style={styles.secondary}>To: {selected?.name || 'No recipient'}</Text>
            <Text style={styles.subtitle}>{title}</Text>
            <Text style={styles.message}>{body}</Text>
            <View style={styles.row}>
              <Pressable style={styles.lightButton} onPress={() => setConfirm(false)} disabled={busy}><Text style={styles.dark}>CANCEL</Text></Pressable>
              <Pressable style={styles.greenButton} onPress={() => void send()} disabled={busy}>
                <Text style={styles.white}>{busy?'SENDING...':'CONFIRM SEND'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AdminGate>
  );
}

const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:'#F4F8F5'},content:{padding:16,paddingBottom:55,gap:14,maxWidth:720,width:'100%',alignSelf:'center'},
 hero:{flexDirection:'row',gap:12,backgroundColor:'white',borderRadius:16,padding:18,alignItems:'center'},fill:{flex:1},
 title:{fontSize:20,fontWeight:'900',color:'#213A2B'},secondary:{color:'#5E7464',fontSize:12,lineHeight:18},subtitle:{fontSize:14,fontWeight:'900',color:'#213A2B'},
 card:{backgroundColor:'white',padding:16,borderRadius:15,gap:12,borderWidth:1,borderColor:'#DEE9E0'},
 row:{flexDirection:'row',gap:8,alignItems:'center',flexWrap:'wrap'},input:{flex:1,minWidth:100,borderWidth:1,borderColor:'#C9DDCE',borderRadius:11,padding:12,backgroundColor:'white',color:'#213A2B'},
 greenButton:{backgroundColor:'#216D47',borderRadius:10,padding:12,alignSelf:'flex-start'},lightButton:{backgroundColor:'#E5F1E9',borderRadius:10,padding:12},
 white:{color:'white',fontWeight:'900',fontSize:12},dark:{color:'#216D47',fontWeight:'900',fontSize:12},
 member:{padding:10,flexDirection:'row',gap:10,borderRadius:11,backgroundColor:'#F6F9F6',alignItems:'center'},selected:{backgroundColor:'#DBEFE1'},memberName:{flex:1,color:'#253E2D',fontWeight:'700',fontSize:13},
 selectedName:{color:'#216D47',fontWeight:'900',fontSize:12},disabled:{opacity:0.45},
 feedback:{color:'#255A38',fontSize:13,fontWeight:'700'},scrim:{flex:1,backgroundColor:'rgba(0,0,0,0.45)',padding:20,justifyContent:'center'},
 confirm:{backgroundColor:'white',padding:20,borderRadius:16,gap:12,maxWidth:550,width:'100%',alignSelf:'center'},message:{fontSize:13,color:'#293C31',lineHeight:20}
});
