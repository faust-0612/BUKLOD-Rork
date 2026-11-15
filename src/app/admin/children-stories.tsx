import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';
import { BUNDLED_CHILDREN_STORIES, ChildrenStory, StoryCategory, STORY_CATEGORIES, isValidChildrenStory } from '@/features/childrenStories/catalog';

type Row = { id:string; payload:ChildrenStory; is_published:boolean; publish_at:string|null; updated_at:string };
const empty: ChildrenStory = {
 id:'',category:'Values',minAge:6,maxAge:8,emoji:'🌟',palette:['#206776','#8FC69E'],version:1,source:'published',
 title:{tl:'',en:''},summary:{tl:'',en:''},
 pages:[{text:{tl:'',en:''}},{text:{tl:'',en:''}},{text:{tl:'',en:''}}],
 question:{tl:'',en:''},choices:[{tl:'',en:''},{tl:'',en:''},{tl:'',en:''}],answer:0
};
const clone=(v:ChildrenStory):ChildrenStory=>JSON.parse(JSON.stringify(v));
const sequence=(s:string)=>s.split(/^\s*---\s*$/m).map(x=>x.trim()).filter(Boolean);
export default function ChildrenStoryEditor() {
 const [rows,setRows]=useState<Row[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [form,setForm]=useState<ChildrenStory>(clone(empty));
 const [selected,setSelected]=useState<string|null>(null);
 const [published,setPublished]=useState(false);
 const [schedule,setSchedule]=useState('');
 const [pagesTl,setPagesTl]=useState('');
 const [pagesEn,setPagesEn]=useState('');
 const [choicesTl,setChoicesTl]=useState('');
 const [choicesEn,setChoicesEn]=useState('');
 const update=useCallback((patch:Partial<ChildrenStory>)=>setForm(old=>({...old,...patch})),[]);
 const load=useCallback(async()=>{
   setLoading(true);setError('');
   const {data,error:requestError}=await supabase.from('buklod_children_stories')
      .select('id,payload,is_published,publish_at,updated_at').order('updated_at',{ascending:false}).limit(100);
   if(requestError) setError('Story CMS database is not ready or access was denied: '+requestError.message);
   else setRows((data??[]) as Row[]);
   setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load]);
 function edit(story:ChildrenStory,row?:Row){
   setSelected(story.id);setForm(clone(story));
   setPagesTl(story.pages.map(p=>p.text.tl).join('\n---\n'));
   setPagesEn(story.pages.map(p=>p.text.en).join('\n---\n'));
   setChoicesTl(story.choices.map(c=>c.tl).join('\n'));
   setChoicesEn(story.choices.map(c=>c.en).join('\n'));
   setPublished(Boolean(row?.is_published));
   setSchedule(row?.publish_at ? row.publish_at.slice(0,10) : '');
 }
 function reset(){
   setSelected(null);setForm(clone(empty));setPagesTl('');setPagesEn('');
   setChoicesTl('');setChoicesEn('');setPublished(false);setSchedule('');
 }
 async function save(){
   if(saving)return;
   const tlPages=sequence(pagesTl);const enPages=sequence(pagesEn);
   const tlChoices=choicesTl.split('\n').map(x=>x.trim()).filter(Boolean);
   const enChoices=choicesEn.split('\n').map(x=>x.trim()).filter(Boolean);
   const candidate:ChildrenStory={...form,id:form.id.trim().toLowerCase(),source:'published',
     pages:tlPages.map((tl,i)=>({text:{tl,en:enPages[i]??''}})),
     choices:tlChoices.map((tl,i)=>({tl,en:enChoices[i]??''}))
   };
   if(tlPages.length!==enPages.length||tlChoices.length!==3||enChoices.length!==3||!isValidChildrenStory(candidate)){
     Alert.alert('Check story','Use a 3–70 character lowercase slug, bilingual titles and summaries, 3–16 paired pages separated by --- lines, exactly 3 answer choices per language, and a question.');
     return;
   }
   if(schedule && (!/^\d{4}-\d{2}-\d{2}$/.test(schedule)||Number.isNaN(Date.parse(schedule+'T00:00:00+08:00')))){
     Alert.alert('Schedule','Use a valid YYYY-MM-DD date, or leave it blank.');return;
   }
   setSaving(true);
   const {error:requestError}=await supabase.from('buklod_children_stories').upsert({
     id:candidate.id,payload:candidate,is_published:published,
     publish_at:schedule?new Date(schedule+'T00:00:00+08:00').toISOString():null,\n     updated_at:new Date().toISOString()
   },{onConflict:'id'});
   setSaving(false);
   if(requestError){Alert.alert('Not saved',requestError.message);return}
   Alert.alert('Story saved',published?'Publication follows the scheduled date.':'Saved as a private draft.');
   reset();await load();
 }
 const field=(label:string,value:string,onChangeText:(value:string)=>void,multiline=false,placeholder='')=><View style={styles.field}>
   <Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline}
      placeholder={placeholder} placeholderTextColor="#81918C" autoCapitalize="sentences"
      style={[styles.input,multiline&&styles.multi]}/>
 </View>;
 return <AdminGate><ScrollView style={styles.screen} contentContainerStyle={styles.content}>
   <Text style={styles.kicker}>CONTENT MANAGEMENT · PRIVATE DRAFTS</Text>
   <Text style={styles.heading}>Children's Stories</Text>
   <Text style={styles.intro}>Curate bilingual, age-appropriate stories. The 12 original bundled stories remain available offline. Public stories require explicit publication.</Text>
   <View style={styles.row}><Pressable onPress={reset} style={styles.primary}><Text style={styles.primaryText}>+ New Story</Text></Pressable>
     <Pressable onPress={()=>void load()} style={styles.secondary}><Text style={styles.secondaryText}>Refresh</Text></Pressable></View>
   {loading?<ActivityIndicator/>:error?<Text style={styles.warning}>{error}</Text>:null}
   <Text style={styles.subhead}>Editorial stories ({rows.length})</Text>
   {rows.map(row=><Pressable key={row.id} onPress={()=>edit(row.payload,row)} style={styles.listItem}>
     <Text style={styles.itemTitle}>{row.payload?.emoji??'📖'} {row.payload?.title?.tl??row.id}</Text>
     <Text style={styles.status}>{row.is_published?'Published/scheduled':'Private draft'} · {row.id}</Text>
   </Pressable>)}
   <Text style={styles.subhead}>Bundled stories · edit or publish an override</Text>
   <View style={styles.rowWrap}>{BUNDLED_CHILDREN_STORIES.map(s=><Pressable key={s.id} onPress={()=>edit(s,rows.find(r=>r.id===s.id))}
      style={styles.bundle}><Text style={styles.bundleText}>{s.emoji} {s.title.tl}</Text></Pressable>)}</View>
   <View style={styles.editor}>
     <Text style={styles.subhead}>{selected?'Edit story':'New original story'}</Text>
     {field('URL slug (lowercase letters, digits, hyphens)',form.id,v=>update({id:v}),false,'halimbawa: ang-bagong-kuwento')}
     {field('Title · Filipino',form.title.tl,v=>update({title:{...form.title,tl:v}}))}
     {field('Title · English',form.title.en,v=>update({title:{...form.title,en:v}}))}
     {field('Summary · Filipino',form.summary.tl,v=>update({summary:{...form.summary,tl:v}}),true)}
     {field('Summary · English',form.summary.en,v=>update({summary:{...form.summary,en:v}}),true)}
     <Text style={styles.label}>Category</Text>
     <View style={styles.rowWrap}>{STORY_CATEGORIES.map(c=><Pressable key={c} onPress={()=>update({category:c as StoryCategory})}
       style={[styles.pill,form.category===c&&styles.pillOn]}><Text style={[styles.pillText,form.category===c&&styles.pillTextOn]}>{c}</Text></Pressable>)}</View>
     <Text style={styles.label}>Age range</Text>
     <View style={styles.rowWrap}>{[[3,5],[6,8],[9,12]] .map(([min,max])=><Pressable key={min} onPress={()=>update({minAge:min,maxAge:max})}
       style={[styles.pill,form.minAge===min&&styles.pillOn]}><Text style={[styles.pillText,form.minAge===min&&styles.pillTextOn]}>{min}–{max}</Text></Pressable>)}</View>
     {field('Illustration icon / emoji',form.emoji,v=>update({emoji:v}))}
     {field('Pages · Filipino (separate pages with a line containing ---)',pagesTl,setPagesTl,true)}
     {field('Pages · English (same number of pages)',pagesEn,setPagesEn,true)}
     {field('Story question · Filipino',form.question.tl,v=>update({question:{...form.question,tl:v}}))}
     {field('Story question · English',form.question.en,v=>update({question:{...form.question,en:v}}))}
     {field('Three choices · Filipino (one per line)',choicesTl,setChoicesTl,true)}
     {field('Three choices · English (one per line)',choicesEn,setChoicesEn,true)}
     <Text style={styles.label}>Correct answer</Text>
     <View style={styles.rowWrap}>{[0,1,2].map(i=><Pressable key={i} onPress={()=>update({answer:i})} style={[styles.pill,form.answer===i&&styles.pillOn]}>
       <Text style={[styles.pillText,form.answer===i&&styles.pillTextOn]}>{'ABC'[i]}</Text></Pressable>)}</View>
     {field('Schedule · YYYY-MM-DD (optional, Philippine time)',schedule,setSchedule,false,'YYYY-MM-DD')}
     <Pressable accessibilityRole="button" accessibilityState={{checked:published}} onPress={()=>setPublished(!published)} style={styles.publishToggle}>
       <Text style={styles.label}>{published?'✓ Publish approved content':'○ Save as private draft'}</Text>
     </Pressable>
     <Pressable onPress={()=>void save()} disabled={saving} style={[styles.primary,saving&&{opacity:.5}]}>
       <Text style={styles.primaryText}>{saving?'Saving…':published?'Save & schedule/publish':'Save private draft'}</Text>
     </Pressable>
   </View>
   <Text style={styles.warning}>Safety: Only System Admins can edit. Preview both languages before publishing. Do not upload copyrighted stories or personally identifying information about children.</Text>
 </ScrollView></AdminGate>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#F3F8F5'},content:{padding:18,paddingBottom:46,maxWidth:880,width:'100%',alignSelf:'center',gap:12},
 kicker:{fontSize:11,fontWeight:'900',color:'#27715E',letterSpacing:1.1},
 heading:{fontSize:27,color:'#1D493D',fontWeight:'900'},
 intro:{color:'#5C7067',fontSize:14,lineHeight:21},
 row:{flexDirection:'row',gap:10,flexWrap:'wrap'},
 rowWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
 primary:{backgroundColor:'#26755E',paddingVertical:13,paddingHorizontal:17,borderRadius:12,alignItems:'center',justifyContent:'center'},
 primaryText:{color:'#FFF',fontWeight:'900',fontSize:14},
 secondary:{borderWidth:1,borderColor:'#B9D9C9',paddingHorizontal:15,paddingVertical:13,borderRadius:12},
 secondaryText:{fontWeight:'800',color:'#28644F'},
 warning:{backgroundColor:'#FFF4D7',padding:14,color:'#7C591E',borderRadius:12,lineHeight:20},
 subhead:{fontSize:18,fontWeight:'900',color:'#245047',marginTop:12,marginBottom:6},
 listItem:{borderWidth:1,borderColor:'#DFEBE3',backgroundColor:'#FFF',padding:12,borderRadius:12,gap:4},
 itemTitle:{fontWeight:'900',color:'#245044',fontSize:15},
 status:{color:'#768B80',fontSize:12},
 bundle:{backgroundColor:'#E3F2E8',borderRadius:12,paddingVertical:9,paddingHorizontal:12},
 bundleText:{fontWeight:'700',fontSize:12,color:'#336452'},
 editor:{gap:12,backgroundColor:'white',borderWidth:1,borderColor:'#D7E7DD',padding:16,borderRadius:18,marginTop:15},
 field:{gap:6},label:{color:'#2B594B',fontSize:13,fontWeight:'800'},
 input:{borderWidth:1,borderColor:'#CBDDD1',backgroundColor:'#FCFEFC',borderRadius:11,padding:11,minHeight:46,color:'#1B3C31',fontSize:15},
 multi:{minHeight:94,textAlignVertical:'top'},
 pill:{borderWidth:1,borderColor:'#BFD5C8',borderRadius:16,paddingHorizontal:14,paddingVertical:9},
 pillOn:{backgroundColor:'#2C755F',borderColor:'#2C755F'},
 pillText:{color:'#42715D',fontSize:13,fontWeight:'800'},
 pillTextOn:{color:'#FFF'},
 publishToggle:{borderRadius:11,backgroundColor:'#E9F6EE',padding:14},
});
