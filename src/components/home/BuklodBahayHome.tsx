import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  addBahayItem,
  addCommunityGoal,
  createBahay,
  createBahayCommunity,
  createBahayPoll,
  decideBahayInvite,
  errorMessage,
  inviteKasambahay,
  joinBahayCommunity,
  loadBahayHomes,
  loadBahaySnapshot,
  loadCommunity,
  openBahayFile,
  pickAndUploadBahayFile,
  plantBahayGarden,
  sendBahayMessage,
  sendCommunityMessage,
  subscribeBahay,
  toggleBahayItem,
  voteBahayPoll,
  waterBahayPlant,
  type BahayHome,
  type BahayItem,
  type BahayMember,
  type BahayRole,
  type BahayRoom,
  type BahayVisibility,
} from '@/lib/buklodBahay';
import { useAuth } from '@/providers/AuthProvider';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type RoomKey = BahayRoom | 'PEOPLE' | 'COMMUNITY';

const ROOM_META: Record<RoomKey,{title:string;sub:string;icon:IconName}> = {
  SALA:{title:'Sala',sub:'Family messages · announcements · polls',icon:'sofa-outline'},
  KITCHEN:{title:'Kitchen',sub:'Hugasin · ulam · grocery · chores',icon:'silverware-fork-knife'},
  BEDROOM:{title:'Kwarto',sub:'Private notes · reminders · private files',icon:'bed-outline'},
  DRAWER:{title:'Shared Drawer',sub:'Family files · receipts · documents',icon:'archive-outline'},
  CALENDAR:{title:'Calendar',sub:'Events · appointments · reminders',icon:'calendar-month-outline'},
  BILLS:{title:'Bills & Home Care',sub:'Bills · inventory · maintenance',icon:'home-lightning-bolt-outline'},
  GARDEN:{title:'Garden',sub:'Grow virtual plants from shared effort',icon:'flower-outline'},
  GENERAL:{title:'House Rules',sub:'Rules · emergency · important notes',icon:'clipboard-text-outline'},
  PEOPLE:{title:'Kasambahay',sub:'Members · roles · invitations',icon:'account-group-outline'},
  COMMUNITY:{title:'Compound / Subdivision',sub:'Shared goals with other homes',icon:'home-group'},
};

const SHARED_ROOMS: RoomKey[] = ['SALA','KITCHEN','CALENDAR','BILLS','DRAWER','GENERAL','PEOPLE','COMMUNITY','GARDEN','BEDROOM'];
const ROLE_OPTIONS: BahayRole[] = ['ADULT','TEEN','CHILD','HELPER','GUEST','ADMIN'];

function dueFromMode(mode: string) {
  if (mode === '1H') return new Date(Date.now()+60*60*1000).toISOString();
  if (mode === 'TONIGHT') {
    const d = new Date();
    d.setHours(20,0,0,0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate()+1);
    return d.toISOString();
  }
  if (mode === 'TOMORROW') {
    const d = new Date();
    d.setDate(d.getDate()+1);
    d.setHours(9,0,0,0);
    return d.toISOString();
  }
  if (mode === 'WEEK') return new Date(Date.now()+7*24*60*60*1000).toISOString();
  return null;
}

function formatWhen(value?: string|null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

function memberName(member?: BahayMember|null) {
  return member?.profiles?.full_name || member?.profiles?.username || 'Kasambahay';
}

function ItemRow({item,members,onToggle}:{item:BahayItem;members:BahayMember[];onToggle:(item:BahayItem)=>void}) {
  const assigned = members.find((m)=>m.user_id===item.assigned_to);
  return (
    <Pressable onPress={()=>onToggle(item)} style={[styles.itemRow,item.is_done&&styles.itemDone]}>
      <MaterialCommunityIcons
        name={item.is_done?'checkbox-marked-circle':'checkbox-blank-circle-outline'}
        size={22}
        color={item.is_done?'#4E7D5B':'#6D7F72'}
      />
      <View style={{flex:1,minWidth:0}}>
        <Text style={[styles.itemTitle,item.is_done&&styles.strike]}>{item.title}</Text>
        <Text style={styles.itemMeta}>
          {item.item_type}
          {assigned ? ` · ${memberName(assigned)}` : ''}
          {item.due_at ? ` · ${formatWhen(item.due_at)}` : ''}
          {item.amount != null ? ` · ₱${Number(item.amount).toLocaleString()}` : ''}
        </Text>
        {!!item.body && <Text style={styles.itemBody}>{item.body}</Text>}
      </View>
    </Pressable>
  );
}

export default function BuklodBahayHome() {
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const { user, profile } = useAuth();
  const userId = user?.id || profile?.id || '';

  const [homes,setHomes] = useState<BahayHome[]>([]);
  const [invitations,setInvitations] = useState<any[]>([]);
  const [activeHomeId,setActiveHomeId] = useState('');
  const [snapshot,setSnapshot] = useState<any>(null);
  const [activeRoom,setActiveRoom] = useState<RoomKey|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');

  const [newHomeName,setNewHomeName] = useState('');
  const [newHomeKind,setNewHomeKind] = useState<'PHYSICAL'|'VIRTUAL'>('PHYSICAL');
  const [draft,setDraft] = useState('');
  const [detailDraft,setDetailDraft] = useState('');
  const [dueMode,setDueMode] = useState('NONE');
  const [assignedTo,setAssignedTo] = useState<string|null>(null);
  const [amountDraft,setAmountDraft] = useState('');
  const [messageDraft,setMessageDraft] = useState('');
  const [inviteId,setInviteId] = useState('');
  const [inviteRole,setInviteRole] = useState<BahayRole>('ADULT');
  const [pollQuestion,setPollQuestion] = useState('');
  const [pollOptions,setPollOptions] = useState('Yes,No');
  const [plantNickname,setPlantNickname] = useState('');
  const [plantType,setPlantType] = useState('SUNFLOWER');

  const [communityName,setCommunityName] = useState('');
  const [communityKind,setCommunityKind] = useState<'COMPOUND'|'SUBDIVISION'|'VIRTUAL'>('COMPOUND');
  const [communityCode,setCommunityCode] = useState('');
  const [selectedCommunityId,setSelectedCommunityId] = useState('');
  const [communityData,setCommunityData] = useState<any>({items:[],messages:[]});
  const [communityDraft,setCommunityDraft] = useState('');
  const [communityMessage,setCommunityMessage] = useState('');

  const activeHome = snapshot?.home || homes.find((home)=>home.id===activeHomeId) || null;
  const members: BahayMember[] = snapshot?.members ?? [];
  const items: BahayItem[] = snapshot?.items ?? [];
  const files: any[] = snapshot?.files ?? [];
  const plants: any[] = snapshot?.plants ?? [];
  const polls: any[] = snapshot?.polls ?? [];
  const communities: any[] = snapshot?.communities ?? [];

  const activeMembership = members.find((m)=>m.user_id===userId);
  const canAdmin = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  const refreshHomes = useCallback(async (preferId?: string) => {
    if (!userId) return;
    try {
      const result = await loadBahayHomes(userId);
      setHomes(result.homes);
      setInvitations(result.invitations);
      const stored = await AsyncStorage.getItem(`buklod.bahay.active.${userId}`);
      const next = preferId || (stored && result.homes.some((h)=>h.id===stored) ? stored : result.homes[0]?.id || '');
      setActiveHomeId(next);
      if (next) await AsyncStorage.setItem(`buklod.bahay.active.${userId}`,next);
    } catch (e) {
      setError(errorMessage(e));
    }
  },[userId]);

  const refreshSnapshot = useCallback(async () => {
    if (!activeHomeId) {
      setSnapshot(null);
      return;
    }
    try {
      const next = await loadBahaySnapshot(activeHomeId);
      setSnapshot(next);
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  },[activeHomeId]);

  useEffect(()=>{
    let mounted=true;
    if (!userId) return;
    setLoading(true);
    void refreshHomes().finally(()=>mounted&&setLoading(false));
    return ()=>{mounted=false};
  },[refreshHomes,userId]);

  useEffect(()=>{
    void refreshSnapshot();
    if (!activeHomeId) return;
    const unsubscribe = subscribeBahay(activeHomeId,()=>{ void refreshSnapshot(); });
    return unsubscribe;
  },[activeHomeId,refreshSnapshot]);

  useEffect(()=>{
    if (!selectedCommunityId) {
      setCommunityData({items:[],messages:[]});
      return;
    }
    void loadCommunity(selectedCommunityId).then(setCommunityData).catch((e)=>setError(errorMessage(e)));
  },[selectedCommunityId]);

  const pendingCount = useMemo(()=>items.filter((i)=>!i.is_done && i.visibility!=='PRIVATE').length,[items]);
  const todayCount = useMemo(()=>{
    const end = Date.now()+24*60*60*1000;
    return items.filter((i)=>!i.is_done && i.due_at && new Date(i.due_at).getTime()<=end).length;
  },[items]);
  const nextDue = useMemo(()=>items.filter((i)=>!i.is_done&&i.due_at).sort((a,b)=>String(a.due_at).localeCompare(String(b.due_at)))[0],[items]);

  const switchHome = async (id:string) => {
    setActiveHomeId(id);
    setActiveRoom(null);
    setSelectedCommunityId('');
    if (userId) await AsyncStorage.setItem(`buklod.bahay.active.${userId}`,id);
  };

  const run = async (fn:()=>Promise<any>,success?:string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setError('');
      if (success) Alert.alert('BUKLOD Bahay',success);
    } catch (e) {
      const msg=errorMessage(e);
      setError(msg);
      Alert.alert('BUKLOD Bahay',msg);
    } finally {
      setBusy(false);
    }
  };

  const createHomeNow = () => run(async()=>{
    if (!newHomeName.trim()) throw new Error('Ilagay ang pangalan ng Bahay.');
    const id = await createBahay(newHomeName,newHomeKind);
    setNewHomeName('');
    await refreshHomes(id);
    await switchHome(id);
    await refreshSnapshot();
  },'Nagawa na ang Bahay.');

  const decideInvite = (homeId:string,accept:boolean) => run(async()=>{
    await decideBahayInvite(homeId,accept);
    await refreshHomes();
  },accept?'Kasambahay ka na.':'Invitation declined.');

  const itemTypeForRoom = (room:RoomKey) => {
    if (room==='KITCHEN') return 'TASK';
    if (room==='CALENDAR') return 'EVENT';
    if (room==='BILLS') return 'BILL';
    if (room==='GENERAL') return 'RULE';
    if (room==='BEDROOM') return 'PRIVATE_NOTE';
    return 'NOTICE';
  };

  const addRoomItem = (type?:string) => run(async()=>{
    if (!activeHomeId || !userId || !activeRoom || ['PEOPLE','COMMUNITY','GARDEN','DRAWER'].includes(activeRoom)) return;
    if (!draft.trim()) throw new Error('Maglagay muna ng item.');
    const room = activeRoom as BahayRoom;
    const visibility: BahayVisibility = room==='BEDROOM' ? 'PRIVATE' : room==='BILLS' ? 'ADULTS' : 'SHARED';
    await addBahayItem({
      homeId:activeHomeId,userId,room,type:type||itemTypeForRoom(activeRoom),
      title:draft,body:detailDraft,assignedTo:room==='KITCHEN'?assignedTo:null,
      dueAt:dueFromMode(dueMode),
      amount:room==='BILLS'&&amountDraft ? Number(amountDraft) : null,
      visibility,
    });
    setDraft(''); setDetailDraft(''); setAmountDraft(''); setDueMode('NONE'); setAssignedTo(null);
    await refreshSnapshot();
  });

  const addKitchenPreset = (type:string) => {
    void run(async()=>{
      if (!draft.trim()) throw new Error('Ilagay ang gagawin o bibilhin.');
      await addBahayItem({
        homeId:activeHomeId,userId,room:'KITCHEN',type,title:draft,body:detailDraft,
        assignedTo:type==='TASK'?assignedTo:null,dueAt:dueFromMode(dueMode),visibility:'SHARED',
      });
      setDraft('');setDetailDraft('');setDueMode('NONE');setAssignedTo(null);
      await refreshSnapshot();
    });
  };

  const sendMessage = () => run(async()=>{
    if (!messageDraft.trim()) return;
    await sendBahayMessage(activeHomeId,userId,messageDraft);
    setMessageDraft('');
    await refreshSnapshot();
  });

  const makePoll = () => run(async()=>{
    if (!pollQuestion.trim()) throw new Error('Ilagay ang tanong.');
    await createBahayPoll(activeHomeId,userId,pollQuestion,pollOptions.split(','));
    setPollQuestion(''); setPollOptions('Yes,No');
    await refreshSnapshot();
  });

  const uploadFile = (visibility:BahayVisibility) => run(async()=>{
    await pickAndUploadBahayFile({homeId:activeHomeId,userId,visibility});
    await refreshSnapshot();
  });

  const openFile = (path:string) => run(async()=>{
    const url=await openBahayFile(path);
    if (url) await Linking.openURL(url);
  });

  const inviteMember = () => run(async()=>{
    if (!inviteId.trim()) throw new Error('Ilagay ang @username o login identifier.');
    const expires = inviteRole==='GUEST' ? new Date(Date.now()+7*24*60*60*1000).toISOString() : null;
    const person = await inviteKasambahay(activeHomeId,inviteId,inviteRole,expires);
    setInviteId('');
    await refreshSnapshot();
    Alert.alert('Invitation sent',`${person?.full_name || person?.username || 'User'} was invited.`);
  });

  const plant = () => run(async()=>{
    await plantBahayGarden(activeHomeId,plantType,plantNickname);
    setPlantNickname('');
    await refreshSnapshot();
  });

  const water = (plantId:string) => run(async()=>{
    await waterBahayPlant(plantId);
    await refreshSnapshot();
  });

  const createCommunity = () => run(async()=>{
    if (!communityName.trim()) throw new Error('Ilagay ang pangalan.');
    const result=await createBahayCommunity(activeHomeId,communityName,communityKind);
    setCommunityName('');
    await refreshSnapshot();
    if (result?.community_id) setSelectedCommunityId(result.community_id);
    Alert.alert('Community created',`Join code: ${result?.join_code || ''}`);
  });

  const joinCommunity = () => run(async()=>{
    if (!communityCode.trim()) throw new Error('Ilagay ang join code.');
    const id=await joinBahayCommunity(activeHomeId,communityCode);
    setCommunityCode('');
    await refreshSnapshot();
    setSelectedCommunityId(id);
  });

  const addGoal = () => run(async()=>{
    if (!selectedCommunityId || !communityDraft.trim()) return;
    await addCommunityGoal(selectedCommunityId,userId,communityDraft);
    setCommunityDraft('');
    setCommunityData(await loadCommunity(selectedCommunityId));
  });

  const sendCommunity = () => run(async()=>{
    if (!selectedCommunityId || !communityMessage.trim()) return;
    await sendCommunityMessage(selectedCommunityId,userId,communityMessage);
    setCommunityMessage('');
    setCommunityData(await loadCommunity(selectedCommunityId));
  });

  const renderComposer = (types:string[]) => (
    <View style={styles.composer}>
      <TextInput value={draft} onChangeText={setDraft} placeholder="Add item…" placeholderTextColor="#8A978F" style={styles.input}/>
      <TextInput value={detailDraft} onChangeText={setDetailDraft} placeholder="Details (optional)" placeholderTextColor="#8A978F" style={styles.input}/>
      {activeRoom==='BILLS' && <TextInput value={amountDraft} onChangeText={setAmountDraft} placeholder="Amount (optional)" keyboardType="decimal-pad" placeholderTextColor="#8A978F" style={styles.input}/>}
      <View style={styles.chips}>
        {['NONE','1H','TONIGHT','TOMORROW','WEEK'].map((x)=><Pressable key={x} onPress={()=>setDueMode(x)} style={[styles.chip,dueMode===x&&styles.chipActive]}><Text style={[styles.chipText,dueMode===x&&styles.chipTextActive]}>{x==='NONE'?'No due':x}</Text></Pressable>)}
      </View>
      <View style={styles.chips}>
        {types.map((type)=><Pressable key={type} onPress={()=>void addRoomItem(type)} style={styles.actionChip}><Text style={styles.actionChipText}>+ {type}</Text></Pressable>)}
      </View>
    </View>
  );

  const renderRoom = () => {
    if (!activeRoom || !activeHome) return null;
    const meta=ROOM_META[activeRoom];
    const roomItems=items.filter((i)=>i.room===activeRoom);

    return (
      <View>
        <View style={styles.roomHeader}>
          <Pressable onPress={()=>{setActiveRoom(null);setSelectedCommunityId('')}} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={20} color="#31543E"/></Pressable>
          <View style={{flex:1}}>
            <Text style={styles.roomHeading}>{meta.title}</Text>
            <Text style={styles.roomSub}>{meta.sub}</Text>
          </View>
          <MaterialCommunityIcons name={meta.icon} size={29} color="#4E7D5B"/>
        </View>

        {activeRoom==='SALA' && (
          <View style={styles.sectionStack}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Family Message</Text>
              <View style={styles.sendRow}>
                <TextInput value={messageDraft} onChangeText={setMessageDraft} onSubmitEditing={()=>void sendMessage()} placeholder="Message sa bahay…" placeholderTextColor="#8A978F" style={[styles.input,{flex:1}]}/>
                <Pressable onPress={()=>void sendMessage()} style={styles.primaryIcon}><MaterialCommunityIcons name="send" size={18} color="#FFF"/></Pressable>
              </View>
              {(snapshot?.messages??[]).slice(0,12).map((m:any)=>(
                <View key={m.id} style={styles.message}>
                  <Text style={styles.messageName}>{m.profiles?.full_name||m.profiles?.username||(m.sender_id===userId?'You':'Kasambahay')}</Text>
                  <Text style={styles.messageBody}>{m.body}</Text>
                  <Text style={styles.tiny}>{formatWhen(m.created_at)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Family Poll</Text>
              <TextInput value={pollQuestion} onChangeText={setPollQuestion} placeholder="Anong desisyon?" placeholderTextColor="#8A978F" style={styles.input}/>
              <TextInput value={pollOptions} onChangeText={setPollOptions} placeholder="Choices, comma separated" placeholderTextColor="#8A978F" style={styles.input}/>
              <Pressable onPress={()=>void makePoll()} style={styles.primaryButton}><Text style={styles.primaryText}>CREATE POLL</Text></Pressable>
              {polls.map((poll:any)=>(
                <View key={poll.id} style={styles.poll}>
                  <Text style={styles.itemTitle}>{poll.question}</Text>
                  <View style={styles.chips}>
                    {(poll.options??[]).map((option:any)=>{
                      const mine=(option.votes??[]).some((v:any)=>v.user_id===userId);
                      return <Pressable key={option.id} onPress={()=>void run(async()=>{await voteBahayPoll(poll.id,option.id,userId);await refreshSnapshot()})} style={[styles.chip,mine&&styles.chipActive]}><Text style={[styles.chipText,mine&&styles.chipTextActive]}>{option.label} · {(option.votes??[]).length}</Text></Pressable>
                    })}
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notices / Moments</Text>
              {renderComposer(['NOTICE','MOMENT','EMERGENCY'])}
              {items.filter((i)=>i.room==='SALA').map((i)=><ItemRow key={i.id} item={i} members={members} onToggle={(x)=>void run(async()=>{await toggleBahayItem(x);await refreshSnapshot()})}/>)}
            </View>
          </View>
        )}

        {activeRoom==='KITCHEN' && (
          <View style={styles.sectionStack}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kitchen Board</Text>
              <TextInput value={draft} onChangeText={setDraft} placeholder="Hugasin, ulam, grocery…" placeholderTextColor="#8A978F" style={styles.input}/>
              <TextInput value={detailDraft} onChangeText={setDetailDraft} placeholder="Details (optional)" placeholderTextColor="#8A978F" style={styles.input}/>
              <View style={styles.chips}>
                {['NONE','1H','TONIGHT','TOMORROW'].map((x)=><Pressable key={x} onPress={()=>setDueMode(x)} style={[styles.chip,dueMode===x&&styles.chipActive]}><Text style={[styles.chipText,dueMode===x&&styles.chipTextActive]}>{x}</Text></Pressable>)}
              </View>
              <Text style={styles.label}>Assign chore</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Pressable onPress={()=>setAssignedTo(null)} style={[styles.chip,!assignedTo&&styles.chipActive]}><Text style={[styles.chipText,!assignedTo&&styles.chipTextActive]}>Anyone</Text></Pressable>
                {members.map((m)=><Pressable key={m.user_id} onPress={()=>setAssignedTo(m.user_id)} style={[styles.chip,assignedTo===m.user_id&&styles.chipActive]}><Text style={[styles.chipText,assignedTo===m.user_id&&styles.chipTextActive]}>{memberName(m)}</Text></Pressable>)}
              </ScrollView>
              <View style={styles.chips}>
                <Pressable onPress={()=>addKitchenPreset('TASK')} style={styles.actionChip}><Text style={styles.actionChipText}>+ CHORE</Text></Pressable>
                <Pressable onPress={()=>addKitchenPreset('GROCERY')} style={styles.actionChip}><Text style={styles.actionChipText}>+ GROCERY</Text></Pressable>
                <Pressable onPress={()=>addKitchenPreset('MEAL')} style={styles.actionChip}><Text style={styles.actionChipText}>+ ULAM / MEAL</Text></Pressable>
              </View>
              <Pressable onPress={()=>router.push('/personal-home/recipe' as any)} style={styles.softButton}><MaterialCommunityIcons name="chef-hat" size={18} color="#31543E"/><Text style={styles.softText}>AI Recipe</Text></Pressable>
            </View>
            <View style={styles.card}>
              {items.filter((i)=>i.room==='KITCHEN').map((i)=><ItemRow key={i.id} item={i} members={members} onToggle={(x)=>void run(async()=>{await toggleBahayItem(x);await refreshSnapshot()})}/>)}
            </View>
          </View>
        )}

        {activeRoom==='BEDROOM' && (
          <View style={styles.sectionStack}>
            <View style={[styles.card,styles.privateCard]}>
              <View style={styles.privateBadge}><MaterialCommunityIcons name="lock" size={14} color="#704A2C"/><Text style={styles.privateText}>PRIVATE · only you can read these</Text></View>
              {renderComposer(['PRIVATE_NOTE','REMINDER'])}
              <Pressable onPress={()=>void uploadFile('PRIVATE')} style={styles.softButton}><MaterialCommunityIcons name="file-lock-outline" size={18} color="#31543E"/><Text style={styles.softText}>ADD PRIVATE FILE</Text></Pressable>
              <Pressable onPress={()=>router.push('/personal-home/reminders' as any)} style={styles.softButton}><MaterialCommunityIcons name="alarm" size={18} color="#31543E"/><Text style={styles.softText}>PERSONAL REMINDERS</Text></Pressable>
            </View>
            <View style={styles.card}>
              {items.filter((i)=>i.room==='BEDROOM').map((i)=><ItemRow key={i.id} item={i} members={members} onToggle={(x)=>void run(async()=>{await toggleBahayItem(x);await refreshSnapshot()})}/>)}
              {files.filter((f)=>f.visibility==='PRIVATE').map((f)=><Pressable key={f.id} onPress={()=>void openFile(f.storage_path)} style={styles.fileRow}><MaterialCommunityIcons name="file-lock-outline" size={20} color="#4E7D5B"/><Text style={styles.fileName}>{f.file_name}</Text></Pressable>)}
            </View>
          </View>
        )}

        {activeRoom==='DRAWER' && (
          <View style={styles.sectionStack}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Shared Drawer</Text>
              <Text style={styles.helper}>250 MB per Bahay · max 10 MB per file. Videos are intentionally excluded here to keep storage practical.</Text>
              <View style={styles.chips}>
                <Pressable onPress={()=>void uploadFile('SHARED')} style={styles.actionChip}><Text style={styles.actionChipText}>+ SHARED FILE</Text></Pressable>
                {(activeMembership?.role==='OWNER'||activeMembership?.role==='ADMIN'||activeMembership?.role==='ADULT')&&<Pressable onPress={()=>void uploadFile('ADULTS')} style={styles.actionChip}><Text style={styles.actionChipText}>+ ADULTS ONLY</Text></Pressable>}
              </View>
            </View>
            <View style={styles.card}>
              {files.filter((f)=>f.visibility!=='PRIVATE').map((f)=><Pressable key={f.id} onPress={()=>void openFile(f.storage_path)} style={styles.fileRow}><MaterialCommunityIcons name={f.visibility==='ADULTS'?'file-lock-outline':'file-document-outline'} size={20} color="#4E7D5B"/><View style={{flex:1}}><Text style={styles.fileName}>{f.file_name}</Text><Text style={styles.tiny}>{f.visibility} · {(Number(f.size_bytes||0)/1024/1024).toFixed(1)} MB</Text></View></Pressable>)}
              {!files.filter((f)=>f.visibility!=='PRIVATE').length&&<Text style={styles.empty}>Wala pang shared files.</Text>}
            </View>
          </View>
        )}

        {activeRoom==='GARDEN' && (
          <View style={styles.sectionStack}>
            <View style={[styles.card,styles.gardenCard]}>
              <View style={styles.gardenStats}>
                <Text style={styles.gardenStat}>⚡ {activeHome.garden_energy||0} energy</Text>
                <Text style={styles.gardenStat}>🌱 {activeHome.garden_seeds||0} seeds</Text>
                <Text style={styles.gardenStat}>🏆 {activeHome.garden_harvests||0} harvests</Text>
              </View>
              <Text style={styles.helper}>Shared chores and maintenance earn garden energy. Water plants to grow them. A full-grown plant gives 2 seeds back.</Text>
              <TextInput value={plantNickname} onChangeText={setPlantNickname} placeholder="Plant nickname (optional)" placeholderTextColor="#78907A" style={styles.input}/>
              <View style={styles.chips}>
                {['SUNFLOWER','TOMATO','HERB','TREE','FLOWER'].map((type)=><Pressable key={type} onPress={()=>setPlantType(type)} style={[styles.chip,plantType===type&&styles.chipActive]}><Text style={[styles.chipText,plantType===type&&styles.chipTextActive]}>{type}</Text></Pressable>)}
              </View>
              <Pressable onPress={()=>void plant()} style={styles.primaryButton}><Text style={styles.primaryText}>PLANT 🌱</Text></Pressable>
            </View>
            <View style={styles.plantGrid}>
              {plants.map((p:any)=>(
                <Pressable key={p.id} onPress={()=>void water(p.id)} style={styles.plantCard}>
                  <Text style={styles.plantEmoji}>{p.stage>=5?'🌳':p.stage>=4?'🌿':p.stage>=3?'🌱':p.stage>=2?'🌾':'🫘'}</Text>
                  <Text style={styles.itemTitle}>{p.nickname||p.plant_type}</Text>
                  <Text style={styles.tiny}>Stage {p.stage}/5 · {p.harvested_at?'Harvested':'Tap to water'}</Text>
                </Pressable>
              ))}
              {!plants.length&&<Text style={styles.empty}>Wala pang tanim. May 3 starter seeds ang bagong Bahay.</Text>}
            </View>
          </View>
        )}

        {activeRoom==='PEOPLE' && (
          <View style={styles.sectionStack}>
            {canAdmin&&<View style={styles.card}>
              <Text style={styles.cardTitle}>Invite Kasambahay</Text>
              <TextInput value={inviteId} onChangeText={setInviteId} autoCapitalize="none" placeholder="@username or login identifier" placeholderTextColor="#8A978F" style={styles.input}/>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {ROLE_OPTIONS.map((role)=><Pressable key={role} onPress={()=>setInviteRole(role)} style={[styles.chip,inviteRole===role&&styles.chipActive]}><Text style={[styles.chipText,inviteRole===role&&styles.chipTextActive]}>{role}</Text></Pressable>)}
              </ScrollView>
              <Text style={styles.helper}>Guest access automatically expires after 7 days. A person can belong to multiple Bahay.</Text>
              <Pressable onPress={()=>void inviteMember()} style={styles.primaryButton}><Text style={styles.primaryText}>SEND INVITATION</Text></Pressable>
            </View>}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kasambahay · {members.length}</Text>
              {members.map((m)=><View key={m.user_id} style={styles.memberRow}><View style={styles.avatar}><MaterialCommunityIcons name="account" size={20} color="#FFF"/></View><View style={{flex:1}}><Text style={styles.itemTitle}>{memberName(m)}</Text><Text style={styles.itemMeta}>{m.role}{m.expires_at?` · until ${formatWhen(m.expires_at)}`:''}</Text></View></View>)}
            </View>
          </View>
        )}

        {activeRoom==='COMMUNITY' && (
          <View style={styles.sectionStack}>
            {canAdmin&&<View style={styles.card}>
              <Text style={styles.cardTitle}>Build a Compound / Subdivision</Text>
              <TextInput value={communityName} onChangeText={setCommunityName} placeholder="Community name" placeholderTextColor="#8A978F" style={styles.input}/>
              <View style={styles.chips}>{(['COMPOUND','SUBDIVISION','VIRTUAL'] as const).map((kind)=><Pressable key={kind} onPress={()=>setCommunityKind(kind)} style={[styles.chip,communityKind===kind&&styles.chipActive]}><Text style={[styles.chipText,communityKind===kind&&styles.chipTextActive]}>{kind}</Text></Pressable>)}</View>
              <Pressable onPress={()=>void createCommunity()} style={styles.primaryButton}><Text style={styles.primaryText}>CREATE COMMUNITY</Text></Pressable>
              <View style={styles.dividerLine}/>
              <TextInput value={communityCode} onChangeText={setCommunityCode} autoCapitalize="characters" placeholder="Join code from another community" placeholderTextColor="#8A978F" style={styles.input}/>
              <Pressable onPress={()=>void joinCommunity()} style={styles.softButton}><MaterialCommunityIcons name="link-variant" size={18} color="#31543E"/><Text style={styles.softText}>JOIN COMMUNITY</Text></Pressable>
            </View>}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Communities</Text>
              <View style={styles.chips}>{communities.map((c:any)=><Pressable key={c.id} onPress={()=>setSelectedCommunityId(c.id)} style={[styles.chip,selectedCommunityId===c.id&&styles.chipActive]}><Text style={[styles.chipText,selectedCommunityId===c.id&&styles.chipTextActive]}>{c.community_kind}: {c.name}</Text></Pressable>)}</View>
              {!communities.length&&<Text style={styles.empty}>Wala pa. Puwedeng literal compound o virtual group of homes with a shared goal.</Text>}
            </View>
            {!!selectedCommunityId&&<View style={styles.card}>
              <Text style={styles.cardTitle}>Shared Goal Board</Text>
              <View style={styles.sendRow}><TextInput value={communityDraft} onChangeText={setCommunityDraft} placeholder="Shared goal…" placeholderTextColor="#8A978F" style={[styles.input,{flex:1}]}/><Pressable onPress={()=>void addGoal()} style={styles.primaryIcon}><MaterialCommunityIcons name="plus" size={20} color="#FFF"/></Pressable></View>
              {(communityData.items??[]).map((x:any)=><View key={x.id} style={styles.goalRow}><MaterialCommunityIcons name={x.is_done?'flag-checkered':'flag-outline'} size={20} color="#4E7D5B"/><View style={{flex:1}}><Text style={styles.itemTitle}>{x.title}</Text><Text style={styles.itemBody}>{x.body||'Shared goal'}</Text></View></View>)}
              <Text style={[styles.cardTitle,{marginTop:14}]}>Community Message</Text>
              <View style={styles.sendRow}><TextInput value={communityMessage} onChangeText={setCommunityMessage} placeholder="Message to connected homes…" placeholderTextColor="#8A978F" style={[styles.input,{flex:1}]}/><Pressable onPress={()=>void sendCommunity()} style={styles.primaryIcon}><MaterialCommunityIcons name="send" size={18} color="#FFF"/></Pressable></View>
              {(communityData.messages??[]).slice(0,10).map((m:any)=><View key={m.id} style={styles.message}><Text style={styles.messageBody}>{m.body}</Text><Text style={styles.tiny}>{formatWhen(m.created_at)}</Text></View>)}
            </View>}
          </View>
        )}

        {['CALENDAR','BILLS','GENERAL'].includes(activeRoom) && (
          <View style={styles.sectionStack}>
            <View style={styles.card}>
              {renderComposer(activeRoom==='CALENDAR'?['EVENT','REMINDER']:activeRoom==='BILLS'?['BILL','INVENTORY','MAINTENANCE']:['RULE','NOTICE','EMERGENCY'])}
              {activeRoom==='BILLS'&&<Pressable onPress={()=>router.push('/personal-home/budget' as any)} style={styles.softButton}><MaterialCommunityIcons name="wallet-outline" size={18} color="#31543E"/><Text style={styles.softText}>PERSONAL BUDGET TOOL</Text></Pressable>}
            </View>
            <View style={styles.card}>
              {roomItems.map((i)=><ItemRow key={i.id} item={i} members={members} onToggle={(x)=>void run(async()=>{await toggleBahayItem(x);await refreshSnapshot()})}/>)}
              {!roomItems.length&&<Text style={styles.empty}>Wala pang items dito.</Text>}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (!userId) return <View style={styles.center}><Text style={styles.empty}>Sign in to open your Bahay.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4E7D5B"/><Text style={styles.empty}>Binubuksan ang Bahay…</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}><MaterialCommunityIcons name="home-heart" size={26} color="#FFF"/></View>
        <View style={{flex:1}}>
          <Text style={styles.brand}>BUKLOD Bahay</Text>
          <Text style={styles.brandSub}>Araw-araw na buhay, magkakasama.</Text>
        </View>
        {busy&&<ActivityIndicator color="#4E7D5B"/>}
      </View>

      {!!error&&<Pressable onPress={()=>setError('')} style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#7A3E32"/><Text style={styles.errorText}>{error}</Text></Pressable>}

      {!!invitations.length&&<View style={styles.invitePanel}>
        <Text style={styles.cardTitle}>Invitations</Text>
        {invitations.map((invite:any)=><View key={invite.id} style={styles.inviteRow}><View style={{flex:1}}><Text style={styles.itemTitle}>{invite.name}</Text><Text style={styles.itemMeta}>Invite as {invite.role||'Kasambahay'}</Text></View><Pressable onPress={()=>void decideInvite(invite.id,false)} style={styles.smallGhost}><Text style={styles.smallGhostText}>DECLINE</Text></Pressable><Pressable onPress={()=>void decideInvite(invite.id,true)} style={styles.smallAccept}><Text style={styles.smallAcceptText}>ACCEPT</Text></Pressable></View>)}
      </View>}

      {!homes.length ? (
        <View style={styles.welcome}>
          <MaterialCommunityIcons name="home-plus-outline" size={58} color="#4E7D5B"/>
          <Text style={styles.welcomeTitle}>Gumawa ng iyong Bahay</Text>
          <Text style={styles.welcomeText}>Puwedeng literal household, dorm, shared house, o virtual Bahay. Maaari kang maging Kasambahay sa maraming Bahay.</Text>
          <TextInput value={newHomeName} onChangeText={setNewHomeName} placeholder="Hal. Gabut Family" placeholderTextColor="#8A978F" style={styles.input}/>
          <View style={styles.chips}><Pressable onPress={()=>setNewHomeKind('PHYSICAL')} style={[styles.chip,newHomeKind==='PHYSICAL'&&styles.chipActive]}><Text style={[styles.chipText,newHomeKind==='PHYSICAL'&&styles.chipTextActive]}>PHYSICAL</Text></Pressable><Pressable onPress={()=>setNewHomeKind('VIRTUAL')} style={[styles.chip,newHomeKind==='VIRTUAL'&&styles.chipActive]}><Text style={[styles.chipText,newHomeKind==='VIRTUAL'&&styles.chipTextActive]}>VIRTUAL</Text></Pressable></View>
          <Pressable onPress={()=>void createHomeNow()} style={styles.primaryButton}><Text style={styles.primaryText}>CREATE BAHAY</Text></Pressable>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.homeSwitcher}>
            {homes.map((home)=><Pressable key={home.id} onPress={()=>void switchHome(home.id)} style={[styles.homePill,activeHomeId===home.id&&styles.homePillActive]}><MaterialCommunityIcons name={home.home_kind==='VIRTUAL'?'home-city-outline':'home-outline'} size={17} color={activeHomeId===home.id?'#FFF':'#31543E'}/><Text style={[styles.homePillText,activeHomeId===home.id&&styles.homePillTextActive]}>{home.name}</Text></Pressable>)}
            <Pressable onPress={()=>{setActiveHomeId('');setSnapshot(null)}} style={styles.homePill}><MaterialCommunityIcons name="plus" size={17} color="#31543E"/><Text style={styles.homePillText}>New</Text></Pressable>
          </ScrollView>

          {!activeHomeId ? (
            <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>New Bahay</Text>
              <TextInput value={newHomeName} onChangeText={setNewHomeName} placeholder="Bahay name" placeholderTextColor="#8A978F" style={styles.input}/>
              <View style={styles.chips}><Pressable onPress={()=>setNewHomeKind('PHYSICAL')} style={[styles.chip,newHomeKind==='PHYSICAL'&&styles.chipActive]}><Text style={[styles.chipText,newHomeKind==='PHYSICAL'&&styles.chipTextActive]}>PHYSICAL</Text></Pressable><Pressable onPress={()=>setNewHomeKind('VIRTUAL')} style={[styles.chip,newHomeKind==='VIRTUAL'&&styles.chipActive]}><Text style={[styles.chipText,newHomeKind==='VIRTUAL'&&styles.chipTextActive]}>VIRTUAL</Text></Pressable></View>
              <Pressable onPress={()=>void createHomeNow()} style={styles.primaryButton}><Text style={styles.primaryText}>CREATE</Text></Pressable>
            </View>
          ) : activeRoom ? renderRoom() : (
            <>
              <View style={styles.houseHeader}>
                <View>
                  <Text style={styles.houseName}>{activeHome?.name||'Bahay'}</Text>
                  <Text style={styles.houseMeta}>{members.length} Kasambahay · {activeHome?.home_kind==='VIRTUAL'?'Virtual':'Physical'} Bahay</Text>
                </View>
                <Pressable onPress={()=>void refreshSnapshot()} style={styles.refresh}><MaterialCommunityIcons name="refresh" size={20} color="#31543E"/></Pressable>
              </View>

              <View style={styles.todayBar}>
                <View style={styles.todayStat}><Text style={styles.todayNumber}>{pendingCount}</Text><Text style={styles.todayLabel}>pending</Text></View>
                <View style={styles.todayStat}><Text style={styles.todayNumber}>{todayCount}</Text><Text style={styles.todayLabel}>due soon</Text></View>
                <View style={[styles.todayStat,{flex:2}]}><Text style={styles.todayLabel}>NEXT</Text><Text style={styles.nextText} numberOfLines={1}>{nextDue?.title || 'Walang urgent na gawain'}</Text></View>
              </View>

              <View style={styles.houseShell}>
                <View style={styles.roof}><MaterialCommunityIcons name="home-heart" size={34} color="#FFF"/><Text style={styles.roofText}>HOME</Text></View>
                <View style={[styles.roomGrid,!compact&&styles.roomGridWide]}>
                  {SHARED_ROOMS.map((room)=>{
                    const meta=ROOM_META[room];
                    const count=room==='PEOPLE'?members.length:room==='COMMUNITY'?communities.length:room==='GARDEN'?plants.length:room==='DRAWER'?files.filter((f)=>f.visibility!=='PRIVATE').length:items.filter((i)=>i.room===room&&!i.is_done).length;
                    return <Pressable key={room} onPress={()=>setActiveRoom(room)} style={[styles.roomTile,room==='BEDROOM'&&styles.bedroomTile,room==='GARDEN'&&styles.gardenTile]}>
                      <View style={styles.roomIcon}><MaterialCommunityIcons name={meta.icon} size={compact?24:29} color={room==='BEDROOM'?'#704A2C':room==='GARDEN'?'#3C744B':'#31543E'}/></View>
                      <Text style={styles.tileTitle}>{meta.title}</Text>
                      <Text style={styles.tileSub} numberOfLines={2}>{meta.sub}</Text>
                      <View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>
                      {room==='BEDROOM'&&<MaterialCommunityIcons name="lock" size={12} color="#704A2C" style={styles.lock}/>}
                    </Pressable>
                  })}
                </View>
                <View style={styles.gardenStrip}><Text style={styles.gardenStripText}>🌱 Garden grows when the household works together · ⚡ {activeHome?.garden_energy||0}</Text></View>
              </View>

              <View style={styles.utilityRow}>
                <Pressable onPress={()=>router.push('/personal-home/media' as any)} style={styles.utility}><MaterialCommunityIcons name="radio" size={19} color="#31543E"/><Text style={styles.utilityText}>Media</Text></Pressable>
                <Pressable onPress={()=>router.push('/personal-home/recipe' as any)} style={styles.utility}><MaterialCommunityIcons name="chef-hat" size={19} color="#31543E"/><Text style={styles.utilityText}>Recipe</Text></Pressable>
                <Pressable onPress={()=>router.push('/personal-home/budget' as any)} style={styles.utility}><MaterialCommunityIcons name="wallet-outline" size={19} color="#31543E"/><Text style={styles.utilityText}>Budget</Text></Pressable>
                <Pressable onPress={()=>router.push('/personal-home/reminders' as any)} style={styles.utility}><MaterialCommunityIcons name="alarm" size={19} color="#31543E"/><Text style={styles.utilityText}>Reminder</Text></Pressable>
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F4F0E6'},
  page:{width:'100%',maxWidth:1040,alignSelf:'center',padding:14,paddingBottom:60,gap:12},
  center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#F4F0E6'},
  brandRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4},
  brandIcon:{width:46,height:46,borderRadius:15,backgroundColor:'#4E7D5B',alignItems:'center',justifyContent:'center'},
  brand:{fontSize:22,fontWeight:'900',color:'#20382A'},
  brandSub:{fontSize:11,fontWeight:'700',color:'#6D7F72',marginTop:2},
  errorBox:{flexDirection:'row',gap:8,alignItems:'center',padding:10,borderRadius:12,backgroundColor:'#F8E8E4',borderWidth:1,borderColor:'#E8C5BC'},
  errorText:{flex:1,color:'#7A3E32',fontSize:12,fontWeight:'700'},
  invitePanel:{padding:12,borderRadius:16,backgroundColor:'#FFF7DF',borderWidth:1,borderColor:'#E8D59B',gap:8},
  inviteRow:{flexDirection:'row',alignItems:'center',gap:7},
  smallGhost:{paddingHorizontal:9,paddingVertical:7,borderRadius:9,borderWidth:1,borderColor:'#B8C2BA'},
  smallGhostText:{fontSize:9,fontWeight:'900',color:'#55675A'},
  smallAccept:{paddingHorizontal:9,paddingVertical:7,borderRadius:9,backgroundColor:'#4E7D5B'},
  smallAcceptText:{fontSize:9,fontWeight:'900',color:'#FFF'},
  welcome:{alignSelf:'center',width:'100%',maxWidth:540,alignItems:'center',padding:24,borderRadius:24,backgroundColor:'#FFF',borderWidth:1,borderColor:'#D9DED8',gap:12},
  welcomeTitle:{fontSize:24,fontWeight:'900',color:'#20382A'},
  welcomeText:{fontSize:13,lineHeight:19,textAlign:'center',color:'#65756A'},
  homeSwitcher:{gap:8,paddingVertical:2},
  homePill:{flexDirection:'row',gap:5,alignItems:'center',paddingHorizontal:11,paddingVertical:8,borderRadius:18,backgroundColor:'#FFF',borderWidth:1,borderColor:'#CBD5CE'},
  homePillActive:{backgroundColor:'#4E7D5B',borderColor:'#4E7D5B'},
  homePillText:{fontSize:11,fontWeight:'800',color:'#31543E'},
  homePillTextActive:{color:'#FFF'},
  houseHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  houseName:{fontSize:26,fontWeight:'900',color:'#20382A'},
  houseMeta:{fontSize:11,fontWeight:'700',color:'#718077',marginTop:3},
  refresh:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF',borderWidth:1,borderColor:'#D7DED8'},
  todayBar:{flexDirection:'row',gap:8,padding:10,borderRadius:17,backgroundColor:'#EAF2EB',borderWidth:1,borderColor:'#D4E1D6'},
  todayStat:{flex:1,minWidth:0,paddingHorizontal:8},
  todayNumber:{fontSize:22,fontWeight:'900',color:'#31543E'},
  todayLabel:{fontSize:8,fontWeight:'900',color:'#75837A',textTransform:'uppercase'},
  nextText:{fontSize:12,fontWeight:'800',color:'#2C4133',marginTop:3},
  houseShell:{overflow:'hidden',borderRadius:24,backgroundColor:'#FFF',borderWidth:1,borderColor:'#D5DCD6'},
  roof:{height:74,backgroundColor:'#6D4A31',alignItems:'center',justifyContent:'center',gap:2},
  roofText:{color:'#FFF',fontSize:9,fontWeight:'900',letterSpacing:2},
  roomGrid:{flexDirection:'row',flexWrap:'wrap',padding:8,gap:8},
  roomGridWide:{padding:12,gap:10},
  roomTile:{position:'relative',width:'48.5%',minHeight:126,padding:12,borderRadius:16,backgroundColor:'#F7F5ED',borderWidth:1,borderColor:'#D8D9D2'},
  bedroomTile:{backgroundColor:'#FAF0E8',borderColor:'#E5D0C1'},
  gardenTile:{backgroundColor:'#EEF7EC',borderColor:'#CFE1CC'},
  roomIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center',marginBottom:8},
  tileTitle:{fontSize:14,fontWeight:'900',color:'#263D2D'},
  tileSub:{fontSize:9.5,lineHeight:13,color:'#708077',fontWeight:'600',marginTop:3,paddingRight:20},
  countBadge:{position:'absolute',right:9,bottom:9,minWidth:24,height:24,borderRadius:12,paddingHorizontal:6,alignItems:'center',justifyContent:'center',backgroundColor:'#E1EAE2'},
  countText:{fontSize:9,fontWeight:'900',color:'#31543E'},
  lock:{position:'absolute',right:10,top:10},
  gardenStrip:{paddingVertical:11,paddingHorizontal:14,backgroundColor:'#DCEED8',borderTopWidth:1,borderTopColor:'#C9DDC5'},
  gardenStripText:{fontSize:10.5,fontWeight:'800',color:'#3D6846',textAlign:'center'},
  utilityRow:{flexDirection:'row',gap:7},
  utility:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',gap:4,paddingVertical:10,borderRadius:13,backgroundColor:'#FFF',borderWidth:1,borderColor:'#D7DED8'},
  utilityText:{fontSize:9,fontWeight:'800',color:'#496053'},
  roomHeader:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:18,backgroundColor:'#FFF',borderWidth:1,borderColor:'#D8DED9'},
  backButton:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'#EDF3EE'},
  roomHeading:{fontSize:21,fontWeight:'900',color:'#20382A'},
  roomSub:{fontSize:10.5,fontWeight:'700',color:'#75837A',marginTop:2},
  sectionStack:{gap:10,marginTop:10},
  card:{padding:13,borderRadius:18,backgroundColor:'#FFF',borderWidth:1,borderColor:'#D9DED9',gap:8},
  privateCard:{backgroundColor:'#FFF9F4',borderColor:'#E7D5C7'},
  gardenCard:{backgroundColor:'#F1F8EF',borderColor:'#CDE1C9'},
  cardTitle:{fontSize:14,fontWeight:'900',color:'#263D2D'},
  privateBadge:{alignSelf:'flex-start',flexDirection:'row',gap:5,alignItems:'center',paddingHorizontal:9,paddingVertical:5,borderRadius:12,backgroundColor:'#F3E5D9'},
  privateText:{fontSize:8.5,fontWeight:'900',color:'#704A2C'},
  composer:{gap:7},
  input:{minHeight:42,borderRadius:12,borderWidth:1,borderColor:'#D2DAD4',backgroundColor:'#FAFBF9',paddingHorizontal:11,paddingVertical:8,fontSize:12,color:'#24392B'},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:6,alignItems:'center'},
  chip:{paddingHorizontal:9,paddingVertical:6,borderRadius:14,borderWidth:1,borderColor:'#CED8D0',backgroundColor:'#FFF'},
  chipActive:{backgroundColor:'#4E7D5B',borderColor:'#4E7D5B'},
  chipText:{fontSize:8.5,fontWeight:'900',color:'#5E7064'},
  chipTextActive:{color:'#FFF'},
  actionChip:{paddingHorizontal:10,paddingVertical:8,borderRadius:11,backgroundColor:'#E7F0E8'},
  actionChipText:{fontSize:9,fontWeight:'900',color:'#31543E'},
  primaryButton:{alignItems:'center',justifyContent:'center',minHeight:42,paddingHorizontal:14,borderRadius:12,backgroundColor:'#4E7D5B'},
  primaryText:{fontSize:10,fontWeight:'900',color:'#FFF',letterSpacing:.4},
  softButton:{flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',minHeight:40,paddingHorizontal:12,borderRadius:12,backgroundColor:'#EDF3EE',borderWidth:1,borderColor:'#D7E3D9'},
  softText:{fontSize:9.5,fontWeight:'900',color:'#31543E'},
  primaryIcon:{width:42,height:42,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#4E7D5B'},
  sendRow:{flexDirection:'row',gap:7,alignItems:'center'},
  itemRow:{flexDirection:'row',gap:9,alignItems:'flex-start',paddingVertical:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E1E5E1'},
  itemDone:{opacity:.55},
  itemTitle:{fontSize:12,fontWeight:'900',color:'#263B2D'},
  itemMeta:{fontSize:8.5,fontWeight:'700',color:'#7D8A82',marginTop:2},
  itemBody:{fontSize:10,lineHeight:14,color:'#68776D',marginTop:3},
  strike:{textDecorationLine:'line-through'},
  message:{padding:9,borderRadius:12,backgroundColor:'#F5F7F4',gap:2},
  messageName:{fontSize:9,fontWeight:'900',color:'#4E7D5B'},
  messageBody:{fontSize:11,lineHeight:15,color:'#304337'},
  tiny:{fontSize:7.5,fontWeight:'700',color:'#8A958E',marginTop:2},
  poll:{paddingVertical:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#E1E5E1',gap:7},
  label:{fontSize:9,fontWeight:'900',color:'#637269'},
  fileRow:{flexDirection:'row',gap:8,alignItems:'center',paddingVertical:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E2E6E2'},
  fileName:{fontSize:11,fontWeight:'800',color:'#304438',flex:1},
  helper:{fontSize:9.5,lineHeight:14,color:'#718077',fontWeight:'600'},
  empty:{fontSize:11,color:'#859188',fontWeight:'700',textAlign:'center',paddingVertical:12},
  gardenStats:{flexDirection:'row',flexWrap:'wrap',gap:7},
  gardenStat:{fontSize:10,fontWeight:'900',color:'#3C6B45',paddingHorizontal:8,paddingVertical:6,borderRadius:12,backgroundColor:'#E0EFDC'},
  plantGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  plantCard:{width:'48%',minHeight:120,padding:12,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#F4FAF2',borderWidth:1,borderColor:'#CFE1CB'},
  plantEmoji:{fontSize:34,marginBottom:5},
  memberRow:{flexDirection:'row',gap:9,alignItems:'center',paddingVertical:7},
  avatar:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:'#6D8D75'},
  dividerLine:{height:1,backgroundColor:'#E1E6E2',marginVertical:4},
  goalRow:{flexDirection:'row',gap:8,alignItems:'flex-start',paddingVertical:8,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E2E6E2'},
});
