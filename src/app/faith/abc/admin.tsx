/** Authenticated, server-authorized ABaKa doctrinal drafting and reviewed publication. */
import React, {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/providers/AuthProvider';
import {useNetwork} from '@/providers/NetworkProvider';
import {supabase} from '@/lib/supabase';
import {DOCTRINE_LABELS,type DoctrineDifficulty} from '@/data/faith/abcDoctrinalCatalog';

type AdminLesson = {
  lesson_id:string; series_key:string; series_title:string; position:number;
  code:string; title:string; difficulty:DoctrineDifficulty; prerequisite_id:string;
  body_blocks:Array<{kind:string;text:string;refs?:Array<{label:string;bookNo:number;chapter:number;verse:number}>}>;
  assessment_prompt:string; assessment_options:string[];correct_option:string;
  published:boolean; content_locked?:boolean; content_version:number; review_note:string|null;
};

const CHOICES=['A','B','C','D'] as const;
const LEVELS:DoctrineDifficulty[]=['foundation','intermediate','advanced','deep'];
const textString=(value:unknown)=>String(value??'').trim();

function EditorField({name,value,onChangeText,multiline=false,placeholder,editable=true}:{
  name:string;value:string;onChangeText:(value:string)=>void;multiline?:boolean;placeholder?:string;editable?:boolean;
}) {
  return <View style={styles.field}>
    <Text style={styles.label}>{name}</Text>
    <TextInput accessibilityLabel={name} value={value} onChangeText={onChangeText}
      multiline={multiline} editable={editable} autoCapitalize="sentences"
      placeholder={placeholder} placeholderTextColor="#71877A"
      style={[styles.input,multiline&&styles.multiline,!editable&&{opacity:.55}]}
      textAlignVertical="top"/>
  </View>;
}

export default function AbakaAdminStudio(){
  const {session}=useAuth();
  return <AccountScopedAbakaAdminStudio key={session?.user?.id??'signed-out'}/>;
}

function AccountScopedAbakaAdminStudio(){
  const {session}=useAuth();
  const {online}=useNetwork();
  const insets=useSafeAreaInsets();
  const accountId=session?.user?.id??'';
  const [isAdmin,setIsAdmin]=useState<boolean|null>(null);
  const [rows,setRows]=useState<AdminLesson[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [busy,setBusy]=useState(false);
  const [selectedId,setSelectedId]=useState('');
  const [selectedSnapshot,setSelectedSnapshot]=useState<AdminLesson|null>(null);
  const [seriesKey,setSeriesKey]=useState('god-and-creation');
  const [seriesTitle,setSeriesTitle]=useState('Pagkilala sa Diyos');
  const [position,setPosition]=useState('3');
  const [code,setCode]=useState('S2 · 3');
  const [title,setTitle]=useState('');
  const [difficulty,setDifficulty]=useState<DoctrineDifficulty>('intermediate');
  const [prerequisiteId,setPrerequisiteId]=useState('doctrine-0002');
  const [body,setBody]=useState('');
  const [refLabel,setRefLabel]=useState('');
  const [bookNo,setBookNo]=useState('');
  const [chapter,setChapter]=useState('');
  const [verse,setVerse]=useState('');
  const [question,setQuestion]=useState('');
  const [options,setOptions]=useState(['','','','']);
  const [correct,setCorrect]=useState('A');
  const [reviewNote,setReviewNote]=useState('');

  const refresh=useCallback(async()=>{
    if(!online) return;
    const {data,error}=await (supabase as any).rpc('buklod_abc_doctrine_admin_list_v2',{p_before_id:null});
    if(error)throw error;
    const page=Array.isArray(data)?data as AdminLesson[]:[];
    setRows(page);setHasMore(page.length===80);
  },[online]);

  useEffect(()=>{
    let active=true;
    setIsAdmin(null);
    setRows([]);
    if(!accountId){setIsAdmin(false);return()=>{active=false;};}
    void (async()=>{
      try{
        const {data,error}=await (supabase as any).rpc('buklod_is_system_admin');
        if(error)throw error;
        if(!active)return;
        const allowed=data===true;
        setIsAdmin(allowed);
        if(allowed)await refresh();
      }catch{
        if(active)setIsAdmin(false);
      }
    })();
    return()=>{active=false;};
  },[accountId,refresh]);

  async function loadMore(){
    if(busy||!hasMore||!online||isAdmin!==true||!rows.length)return;
    setBusy(true);
    try{
      const {data,error}=await (supabase as any).rpc('buklod_abc_doctrine_admin_list_v2',{p_before_id:rows[rows.length-1].lesson_id});
      if(error)throw error;
      const page=Array.isArray(data)?data as AdminLesson[]:[];
      setRows(current=>[...current,...page.filter(row=>!current.some(old=>old.lesson_id===row.lesson_id))]);
      setHasMore(page.length===80);
    }catch(error:any){Alert.alert('Unable to load more lessons',textString(error?.message||error));}finally{setBusy(false);}
  }

  function loadDraft(row:AdminLesson){
    setSelectedSnapshot(row);
    setSelectedId(row.lesson_id);
    setSeriesKey(row.series_key);
    setSeriesTitle(row.series_title);
    setPosition(String(row.position));
    setCode(row.code);
    setTitle(row.title);
    setDifficulty(row.difficulty);
    setPrerequisiteId(row.prerequisite_id);
    setBody(textString(row.body_blocks.find(block=>block.kind==='body')?.text));
    const firstRef=row.body_blocks.find(block=>block.refs?.length)?.refs?.[0];
    setRefLabel(firstRef?.label??'');
    setBookNo(firstRef?.bookNo?String(firstRef.bookNo):'');
    setChapter(firstRef?.chapter?String(firstRef.chapter):'');
    setVerse(firstRef?.verse?String(firstRef.verse):'');
    setQuestion(row.assessment_prompt);
    setOptions([...row.assessment_options]);
    setCorrect(row.correct_option);
    setReviewNote(row.review_note??'');
  }

  function clearDraft(){
    setSelectedSnapshot(null);setSelectedId('');setTitle('');setBody('');setRefLabel('');
    setBookNo('');setChapter('');setVerse('');setQuestion('');
    setOptions(['','','','']);setCorrect('A');setReviewNote('');
  }

  async function save(){
    if(busy||isAdmin!==true||!online||contentLocked)return;
    if(selectedId&&!selected){Alert.alert('Reload draft','Select the existing draft before editing.');return;}
    const book=Number(bookNo),ch=Number(chapter),v=Number(verse);
    if(!title.trim()||body.trim().length<120||!question.trim()||
      !refLabel.trim()||!Number.isInteger(book)||book<1||book>66||
      !Number.isInteger(ch)||ch<1||!Number.isInteger(v)||v<1||
      options.some(choice=>choice.trim().length<5)){
      Alert.alert('Kulang ang draft','Kailangan ng orihinal na paliwanag (120+ characters), eksaktong Bible reference (book # 1–66, chapter, verse), quiz at apat na pagpipilian.');
      return;
    }
    const reference={label:refLabel.trim(),bookNo:book,chapter:ch,verse:v};
    const initialBlocks=[
      {kind:'heading',text:'Doktrina: '+title.trim(),refs:[reference]},
      {kind:'body',text:body.trim(),refs:[reference]},
      {kind:'homework',text:'Isulat kung paano nauugnay ang aralin sa sariling buhay, pananampalataya at pagmamahal sa kapwa.'},
    ];
    // Preserve every untouched study block and reference from multi-block drafts.
    const prior=selected?.body_blocks;
    const bodyIndex=prior?.findIndex(block=>block.kind==='body')??-1;
    const refIndex=prior?.findIndex(block=>block.refs?.length)??-1;
    const bodyBlocks=prior&&bodyIndex>=0&&refIndex>=0?prior.map((block,i)=>{
      let next={...block};
      if(i===bodyIndex)next={...next,text:body.trim()};
      if(i===refIndex&&block.refs?.length){
        const old=block.refs[0];
        if(old.label!==reference.label||old.bookNo!==book||old.chapter!==ch||old.verse!==v)next={...next,refs:[reference,...block.refs.slice(1)]};
      }
      return next;
    }):initialBlocks;
    if(prior&&(bodyIndex<0||refIndex<0)){Alert.alert('Unsupported draft structure','Create a new draft instead of discarding original study blocks.');return;}
    setBusy(true);
    try {
      const {data,error}=await (supabase as any).rpc('buklod_abc_doctrine_admin_save_v1',{
        p_lesson_id:selectedId||null,
        p_series_key:seriesKey.trim().toLowerCase(),
        p_series_title:seriesTitle.trim(),
        p_position:Number(position),
        p_code:code.trim(),
        p_title:title.trim(),
        p_difficulty:difficulty,
        p_prerequisite_id:prerequisiteId.trim(),
        p_body_blocks:bodyBlocks,
        p_assessment_prompt:question.trim(),
        p_assessment_options:options.map(x=>x.trim()),
        p_correct_option:correct,
      });
      if(error)throw error;
      const savedId=textString(data?.lesson_id);
      if(!savedId)throw new Error('Missing saved lesson ID');
      const saved:AdminLesson={lesson_id:savedId,series_key:seriesKey.trim().toLowerCase(),series_title:seriesTitle.trim(),position:Number(position),code:code.trim(),title:title.trim(),difficulty,prerequisite_id:prerequisiteId.trim(),body_blocks:bodyBlocks,assessment_prompt:question.trim(),assessment_options:options.map(x=>x.trim()),correct_option:correct,published:false,content_locked:false,content_version:Number(data?.content_version??1),review_note:null};
      setSelectedSnapshot(saved);setSelectedId(savedId);
      setRows(current=>current.map(row=>row.lesson_id===savedId?saved:row));
      await refresh();
      Alert.alert('Draft saved','Naitala ang unpublished draft. Hindi pa ito makikita ng ordinaryong members.');
    }catch(error:any){
      Alert.alert('Hindi na-save ang draft',textString(error?.message||error));
    }finally{setBusy(false);}
  }

  async function publish(publishNow:boolean){
    if(!selectedId||busy||isAdmin!==true||!online)return;
    if(reviewNote.trim().length<30){
      Alert.alert('Review note required','Isulat ang 30+ character na theological review, Bible-source check at dahilan ng desisyon.');
      return;
    }
    setBusy(true);
    try {
      const {error}=await (supabase as any).rpc('buklod_abc_doctrine_admin_publication_v1',{
        p_lesson_id:selectedId,p_publish:publishNow,p_review_note:reviewNote.trim(),
      });
      if(error)throw error;
      if(selected){const updated={...selected,published:publishNow,content_locked:true,review_note:reviewNote.trim()};setSelectedSnapshot(updated);setRows(current=>current.map(row=>row.lesson_id===selectedId?updated:row));}
      await refresh();
      Alert.alert('Review recorded',publishNow?'Lesson published for members.':'Lesson unpublished; previous learning records remain preserved.');
    }catch(error:any){
      Alert.alert('Hindi ma-update ang publication',textString(error?.message||error));
    }finally{setBusy(false);}
  }

  const selected=rows.find(row=>row.lesson_id===selectedId)??(selectedSnapshot?.lesson_id===selectedId?selectedSnapshot:undefined);
  const isPublished=Boolean(selected?.published);
  const contentLocked=Boolean(selected?.published||selected?.content_locked);
  if(!accountId)return <View style={styles.page}><Text style={styles.notice}>Mag-sign in bilang System Admin.</Text></View>;
  if(isAdmin===null)return <View style={styles.page}><ActivityIndicator color="#C8A86C" style={{marginTop:60}}/></View>;
  if(!isAdmin)return <View style={styles.page}><Text style={styles.notice}>Ang ABaKa authoring ay para lamang sa authorized System Admin.</Text></View>;

  return <ScrollView keyboardShouldPersistTaps="handled" style={styles.page}
    contentContainerStyle={[styles.content,{paddingTop:Math.max(insets.top,12)+12,paddingBottom:Math.max(insets.bottom,20)+32}]}>
    <Pressable accessibilityRole="button" onPress={()=>router.back()} style={styles.back}>
      <MaterialCommunityIcons name="arrow-left" size={20} color="#F9E4A7"/>
      <Text style={styles.actionText}>ABaKa Directory</Text>
    </Pressable>
    <Text style={styles.title}>ABaKa Doctrinal Studio</Text>
    <Text style={styles.subtitle}>Gumawa ng orihinal na draft, suriin ang Biblia, at mag-publish lamang pagkatapos ng theological review. Ang mga published lesson ay immutable.</Text>
    {!online&&<Text style={styles.notice}>Offline: kailangan ang koneksyon upang mag-save o mag-publish.</Text>}

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Existing lessons · {rows.length}</Text>
      <Pressable accessibilityRole="button" onPress={clearDraft} style={styles.secondaryBtn}>
        <Text style={styles.actionText}>+ Create new doctrinal draft</Text>
      </Pressable>
      {rows.map(row=><Pressable accessibilityRole="button" key={row.lesson_id}
        onPress={()=>loadDraft(row)} style={[styles.row,row.lesson_id===selectedId&&styles.selected]}>
        <View style={{flex:1}}>
          <Text style={styles.rowTitle}>{row.code} · {row.title}</Text>
          <Text style={styles.rowMeta}>{row.lesson_id} · {row.series_title} · {DOCTRINE_LABELS[row.difficulty]}</Text>
        </View>
        <Text style={[styles.state,row.published&&{color:'#A9E5B8'}]}>{row.published?'PUBLISHED':'DRAFT'}</Text>
      </Pressable>)}
      {hasMore&&<Pressable accessibilityRole="button" disabled={busy||!online} onPress={()=>void loadMore()} style={styles.secondaryBtn}><Text style={styles.actionText}>Load more lessons</Text></Pressable>}
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{selectedId?'Edit / review '+selectedId:'New unpublished lesson'}</Text>
      {contentLocked&&<Text style={styles.notice}>Na-publish na ang lesson na ito dati. Hindi maaaring baguhin ang nilalaman. Para sa revision, gumawa ng bagong draft/ID.</Text>}
      <EditorField name="Series key (e.g. god-and-creation)" value={seriesKey} onChangeText={setSeriesKey} editable={!contentLocked}/>
      <EditorField name="Series title" value={seriesTitle} onChangeText={setSeriesTitle} editable={!contentLocked}/>
      <EditorField name="Position in series" value={position} onChangeText={setPosition} editable={!contentLocked}/>
      <EditorField name="Lesson code" value={code} onChangeText={setCode} editable={!contentLocked}/>
      <EditorField name="Lesson title" value={title} onChangeText={setTitle} editable={!contentLocked}/>
      <Text style={styles.label}>Difficulty and verified reward</Text>
      <View style={styles.levels}>
        {LEVELS.map(level=><Pressable key={level} accessibilityRole="button"
          disabled={contentLocked} accessibilityState={{selected:level===difficulty}}
          onPress={()=>setDifficulty(level)} style={[styles.level,difficulty===level&&styles.levelSelected]}>
          <Text style={styles.levelText}>{DOCTRINE_LABELS[level]}</Text>
        </Pressable>)}
      </View>
      <EditorField name="Prerequisite ID (lesson-26 or published doctrine-XXXX)" value={prerequisiteId} onChangeText={setPrerequisiteId} editable={!contentLocked}/>
      <EditorField name="Original Bible-based teaching (at least 120 characters)" value={body} onChangeText={setBody} multiline editable={!contentLocked}/>
      <EditorField name="Bible reference label (e.g. Efeso 2:8)" value={refLabel} onChangeText={setRefLabel} editable={!contentLocked}/>
      <View style={styles.triple}>
        <View style={{flex:1}}><EditorField name="Book # 1–66" value={bookNo} onChangeText={setBookNo} editable={!contentLocked}/></View>
        <View style={{flex:1}}><EditorField name="Chapter" value={chapter} onChangeText={setChapter} editable={!contentLocked}/></View>
        <View style={{flex:1}}><EditorField name="Verse" value={verse} onChangeText={setVerse} editable={!contentLocked}/></View>
      </View>
      <EditorField name="Bible-based multiple-choice question" value={question} onChangeText={setQuestion} multiline editable={!contentLocked}/>
      {CHOICES.map((letter,index)=><EditorField key={letter} name={'Option '+letter}
        value={options[index]??''} editable={!contentLocked}
        onChangeText={value=>setOptions(current=>current.map((item,i)=>i===index?value:item))}/>)}
      <Text style={styles.label}>Correct answer (visible only to System Admin)</Text>
      <View style={styles.levels}>
        {CHOICES.map(letter=><Pressable key={letter} disabled={contentLocked}
          accessibilityRole="button" accessibilityState={{selected:correct===letter}}
          onPress={()=>setCorrect(letter)} style={[styles.level,correct===letter&&styles.levelSelected]}>
          <Text style={styles.levelText}>{letter}</Text>
        </Pressable>)}
      </View>
      <Pressable disabled={busy||contentLocked||!online} accessibilityRole="button"
        style={[styles.primaryBtn,(busy||contentLocked||!online)&&styles.disabled]} onPress={()=>void save()}>
        <Text style={styles.primaryText}>{busy?'Saving...':'Save unpublished draft'}</Text>
      </Pressable>
    </View>

    {selectedId&&<View style={styles.section}>
      <Text style={styles.sectionTitle}>Theological publication review</Text>
      <Text style={styles.subtitle}>Suriin ang doktrina, tamang Bible citations, quiz answer, at mga implikasyon. Magbigay ng malinaw na dahilan; ire-record ang publication action sa private audit trail.</Text>
      <EditorField name="Review notes (minimum 30 characters)" value={reviewNote} onChangeText={setReviewNote} multiline/>
      <Pressable accessibilityRole="button" disabled={busy||!online}
        style={[styles.primaryBtn,(busy||!online)&&styles.disabled]}
        onPress={()=>Alert.alert(isPublished?'Unpublish doctrinal lesson?':'Publish doctrinal lesson?',
          'Tiyaking nasuri ang mga talata, paksa, answer key at prerequisite.',
          [{text:'Cancel',style:'cancel'},
           {text:isPublished?'Unpublish':'Confirm publication',
            onPress:()=>void publish(!isPublished)}])}>
        <Text style={styles.primaryText}>{isPublished?'Unpublish with audit note':'Approve and publish'}</Text>
      </Pressable>
    </View>}
  </ScrollView>;
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#071C29'},
  content:{paddingHorizontal:13,gap:12},
  back:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:8,padding:10,backgroundColor:'#17443F',borderRadius:10},
  actionText:{fontSize:12,fontWeight:'800',color:'#FAE6B2'},
  title:{fontSize:23,fontWeight:'900',color:'#FFE6A8'},
  subtitle:{fontSize:12,lineHeight:18,color:'#C9DACE'},
  notice:{margin:14,fontSize:13,lineHeight:19,color:'#F4DCA2'},
  section:{gap:9,backgroundColor:'#113036',borderRadius:13,padding:12,borderColor:'#497067',borderWidth:1},
  sectionTitle:{fontWeight:'900',color:'#FFE7B6',fontSize:16},
  field:{gap:5},
  label:{fontSize:11,fontWeight:'800',color:'#C7DFD2'},
  input:{fontSize:13,color:'#FFF6E5',backgroundColor:'#234443',borderWidth:1,borderColor:'#658879',borderRadius:9,paddingVertical:10,paddingHorizontal:11,minHeight:43},
  multiline:{minHeight:92},
  triple:{flexDirection:'row',gap:8},
  levels:{flexDirection:'row',gap:6,flexWrap:'wrap'},
  level:{paddingVertical:8,paddingHorizontal:11,backgroundColor:'#264742',borderColor:'#56786A',borderWidth:1,borderRadius:8},
  levelSelected:{borderColor:'#F3C674',backgroundColor:'#485638'},
  levelText:{fontSize:11,fontWeight:'800',color:'#F8E7C6'},
  primaryBtn:{backgroundColor:'#327C54',padding:13,borderRadius:11,alignItems:'center',minHeight:44},
  primaryText:{fontWeight:'900',color:'#FFFFFF',fontSize:13},
  secondaryBtn:{backgroundColor:'#245849',borderRadius:10,padding:11},
  disabled:{opacity:.45},
  row:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#1A3B40',borderRadius:8,padding:10,borderWidth:1,borderColor:'#3D635D'},
  selected:{borderColor:'#D7BA7B'},
  rowTitle:{fontWeight:'800',color:'#F9E9C8',fontSize:12},
  rowMeta:{color:'#B8CDC1',fontSize:10,marginTop:4},
  state:{fontSize:9,fontWeight:'900',color:'#F6CEA5'},
});
