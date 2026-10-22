import * as Clipboard from 'expo-clipboard';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

type Draft = { local?: boolean; message: string; sources: { id: string; kind: string; name: string; title: string; url: string; excerpt: string }[]; references: { book: number; chapter: number; start: number; end: number; verses: { verse_no: number; verse_text: string }[] }[] };
export default function BuklodBibleMessagePanel({ book, chapter, start, end, translationCode, books, passageVerses } : { book: number; chapter: number; start: number; end: number; translationCode: string; books: {book_no:number;book_name:string}[]; passageVerses: {verse_no:number;verse_text:string}[] }) {
  const { user } = useAuth(), { isConnected, isInternetReachable } = useNetwork();
  const accountId = user?.id || '', online = Boolean(isConnected && isInternetReachable !== false);
  const key = `bible-writer-v1:${book}:${chapter}:${start}:${end}:${translationCode}`;
  const identity = `${accountId}:${key}`;
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  const [expanded, setExpanded] = useState(false), [value, setValue] = useState<{ identity: string; prompt: string; draft: Draft | null }>({ identity:'',prompt:'',draft:null });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submission = useRef(false), edited = useRef(false);
  useEffect(() => {
    let active=true; edited.current=false;setError('');setValue({identity,prompt:'',draft:null});
    if(accountId)void getOfflineCache<{prompt:string;draft:Draft|null}>(key,{userId:accountId,allowStale:true}).then(saved=>{if(active&&!edited.current&&saved)setValue({identity,...saved.data});});
    return()=>{active=false;};
  },[identity,accountId,key]);
  const visible=value.identity===identity?value:{identity,prompt:'',draft:null};
  useEffect(()=>{
    if(!accountId||value.identity!==identity||!edited.current)return;
    const timer=setTimeout(()=>void setOfflineCache(key,{prompt:value.prompt,draft:value.draft},{userId:accountId,ttlMs:365*86400000}).catch(()=>{}),350);
    return()=>clearTimeout(timer);
  },[value,identity,key,accountId]);
  async function write() {
    if(submission.current||!online||!accountId||!visible.prompt.trim())return;
    submission.current=true;setBusy(true);setError('');const submittedIdentity=identity;
    try {
      const session=await supabase.auth.getSession();if(session.data.session?.user.id!==accountId)throw Error('Please sign in again.');
      const recent=await getOfflineCache<string[]>('bible-writer-recent-v1',{userId:accountId,allowStale:true});
      const result=await withBuklodTimeout(supabase.functions.invoke('buklod-bible-assist-v1',{body:{task:'write',book,chapter,start,end,translation:translationCode,prompt:visible.prompt,recentSources:recent?.data || []}}),25000,'Write Message');
      if(result.error||result.data?.error)throw Error(result.data?.error || 'Message could not be verified. Please retry.');
      const draft=result.data as Draft;if(typeof draft.message!=='string'||!Array.isArray(draft.sources)||!Array.isArray(draft.references))throw Error('Invalid message response.');
      const next={prompt:visible.prompt,draft};
      await setOfflineCache(key,next,{userId:accountId,ttlMs:365*86400000});
      await setOfflineCache('bible-writer-recent-v1',[...draft.sources.map(s=>s.url),...(recent?.data||[])].filter((s,i,a)=>a.indexOf(s)===i).slice(0,20),{userId:accountId,ttlMs:365*86400000});
      if(currentIdentity.current===submittedIdentity)setValue({identity,...next});
    } catch(e) {if(currentIdentity.current===submittedIdentity)setError(e instanceof Error?e.message:'Message unavailable.');}
    finally{submission.current=false;setBusy(false);}
  }
  function localOutline() {
    edited.current=true;
    const selected=passageVerses.filter(v=>v.verse_no>=start&&v.verse_no<=end);
    const message='Local outline worksheet (editable; no AI generation)\n'+
      (books.find(b=>b.book_no===book)?.book_name??('Book '+book))+' '+chapter+':'+start+'-'+end+' ('+translationCode+')\n\n'+
      selected.map(v=>v.verse_no+' '+v.verse_text).join('\n')+
      '\n\n1. Explain the passage: What does it say in context?\n2. Apply the passage: What faithful response does it call for?\n3. Share the passage: How can the message encourage the church?\n\nReview every claim against the passage. Add verified sources before quoting an author.';
    setValue({...visible,draft:{local:true,message,sources:[],references:[{book,chapter,start,end,verses:selected}]}});
  }
  async function saveDraft() {
    if(!accountId)return;
    try {await setOfflineCache(key,{prompt:visible.prompt,draft:visible.draft},{userId:accountId,ttlMs:365*86400000});if(currentIdentity.current===identity)setError('Draft saved on this account.');}
    catch {if(currentIdentity.current===identity)setError('Draft could not be saved.');}
  }
  return <View style={{marginVertical:12,padding:16,borderWidth:1,borderColor:'#DCE5E0',borderRadius:14,gap:12}}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(v=>!v)} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontWeight:'700',color:'#173B2F'}}>Preaching Outline Maker / Write Message</Text></Pressable>
    {expanded&&<>
      <Text>Passage: {books.find(b=>b.book_no===book)?.book_name??book} {chapter}:{start}-{end} ({translationCode})</Text>
      <Text>Use the local worksheet offline, or request a source-grounded AI draft while connected. Request three parallel sermon points in your message when needed.</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={localOutline} style={{minHeight:44,justifyContent:'center'}}><Text>Create local outline worksheet</Text></Pressable>
      <TextInput accessibilityLabel="Write Message request" editable={!busy} multiline maxLength={4000} placeholder="Write Message…" value={visible.prompt} onChangeText={prompt=>{edited.current=true;setValue({...visible,prompt});}} style={{minHeight:100,borderWidth:1,borderColor:'#CBD9D0',borderRadius:10,padding:12,textAlignVertical:'top'}} />
      <Pressable accessibilityRole="button" disabled={busy||!online||!visible.prompt.trim()||!accountId} onPress={()=>void write()} style={{minHeight:44,justifyContent:'center',opacity:busy||!online?0.5:1}}><Text>{busy?'Writing…':'Write Message'}</Text></Pressable>
      {busy&&<ActivityIndicator accessibilityLabel="Writing message"/>}
      {!online&&<Text>Offline — saved draft remains available. Connect to generate a new message.</Text>}
      {!!error&&<Text accessibilityRole="alert">{error}</Text>}
      {visible.draft&&<>
        <Text style={{fontSize:12,color:'#52665A'}}>{visible.draft.local ? 'Local worksheet for your own editing.' : 'AI draft for review - verify interpretation and citations before preaching.'}</Text>
        <TextInput accessibilityLabel="Editable preaching draft" editable={!busy} multiline value={visible.draft.message} onChangeText={message=>{edited.current=true;setValue({...visible,draft:{...visible.draft!,message}});}} style={{fontSize:16,lineHeight:25,minHeight:180,textAlignVertical:'top'}} />
        <Pressable accessibilityRole="button" onPress={()=>void saveDraft()} style={{minHeight:44,justifyContent:'center'}}><Text>Save draft</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={()=>void Clipboard.setStringAsync(visible.draft!.message).catch(()=>setError('Copy unavailable.'))} style={{minHeight:44,justifyContent:'center'}}><Text>Copy draft</Text></Pressable>
        {visible.draft.sources.map(s=><View key={s.id} style={{gap:5}}><Text selectable>[{s.id}] {s.name} · {s.title}</Text><Text selectable>“{s.excerpt}”</Text><Pressable accessibilityRole="link" onPress={()=>{if(/^https:\/\//.test(s.url))void Linking.openURL(s.url);}} style={{minHeight:44,justifyContent:'center'}}><Text>Source</Text></Pressable></View>)}
        {visible.draft.references.map((r,i)=><View key={i}><Text>{books.find(b => b.book_no === r.book)?.book_name || `Book ${r.book}`} · {r.chapter}:{r.start}{r.end===r.start?'':`–${r.end}`} · {translationCode}</Text>{r.verses.map(v=><Text selectable key={v.verse_no}>{v.verse_no} {v.verse_text}</Text>)}</View>)}
      </>}
    </>}
  </View>;
}
