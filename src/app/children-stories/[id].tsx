import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useAuth } from '@/providers/AuthProvider';
import StoryArt from '@/features/childrenStories/StoryArt';
import { BUNDLED_CHILDREN_STORIES, ChildrenStory, StoryLanguage, findBundledStory, localize } from '@/features/childrenStories/catalog';
import { fetchChildrenStoryLibrary, readStoryProgress, saveStoryProgress } from '@/features/childrenStories/service';

export default function ChildrenStoryReader() {
  const params=useLocalSearchParams<{id:string;lang?:string}>();
  const id=typeof params.id==='string'?params.id:'';
  const {user}=useAuth();
  const [language,setLanguage]=useState<StoryLanguage>(params.lang==='en'?'en':'tl');
  const [story,setStory]=useState<ChildrenStory | null>(findBundledStory(id)??null);
  const [page,setPage]=useState(0);
  const [quiz,setQuiz]=useState(false);
  const [choice,setChoice]=useState<number|null>(null);
  const [complete,setComplete]=useState(false);
  const [favorite,setFavorite]=useState(false);
  const [speaking,setSpeaking]=useState(false);
  const [bedtime,setBedtime]=useState(false);
  const stop=useCallback(()=>{ void Speech.stop().catch(()=>undefined); setSpeaking(false);},[]);
  useFocusEffect(useCallback(()=>()=>{void Speech.stop().catch(()=>undefined)},[]));
  useEffect(()=>{
    const sub=AppState.addEventListener('change',s=>{if(s!=='active')stop()});
    return ()=>sub.remove();
  },[stop]);
  useEffect(()=>{
    let live=true;
    const builtin=findBundledStory(id)??null;
    setStory(builtin);setPage(0);setQuiz(false);setChoice(null);setComplete(false);setFavorite(false);
    void readStoryProgress(user?.id).then(all=>{
      if(!live)return;
      const p=all[id];
      if(p){setPage(Math.min(p.page,Math.max(0,(builtin?.pages.length??16)-1)));setComplete(p.completed);setFavorite(p.favorite)}
    });
    void fetchChildrenStoryLibrary(user?.id).then(items=>{
      if(!live)return;
      const found=items.find(x=>x.id===id);
      if(found) setStory(found);
    });
    return()=>{live=false;void Speech.stop().catch(()=>undefined)};
  },[id,user?.id]);
  useEffect(()=>{stop()},[language,page,quiz,stop]);
  function toggleFavorite(){
    const next=!favorite;setFavorite(next);
    void saveStoryProgress(user?.id,id,{favorite:next});
  }
  function jump(next:number){
    if(!story)return;
    const bounded=Math.max(0,Math.min(story.pages.length-1,next));
    setQuiz(false);setChoice(null);setPage(bounded);
    void saveStoryProgress(user?.id,story.id,{page:bounded});
  }
  function speak(){
    if(!story)return;
    if(speaking){stop();return}
    const content=quiz?localize(story.question,language):localize(story.pages[page].text,language);
    try {
      Speech.speak(content,{language:language==='tl'?'fil-PH':'en-US',rate: bedtime ? 0.77 : 0.88,pitch:1,
        onStart:()=>setSpeaking(true),onDone:()=>setSpeaking(false),
        onStopped:()=>setSpeaking(false),onError:()=>setSpeaking(false)});
    } catch {setSpeaking(false)}
  }
  function submit(index:number){
    if(!story||complete&&choice===story.answer)return;
    setChoice(index);
    if(index===story.answer){
      setComplete(true);
      void saveStoryProgress(user?.id,story.id,{completed:true,page:story.pages.length-1});
    }
  }
  if(!story) return <View style={styles.notFound}>
    <Text style={styles.big}>Hindi makita ang kuwento.</Text>
    <Text style={styles.body}>Bumalik sa library at pumili ng isa pang kuwento.</Text>
    <Pressable accessibilityRole="button" onPress={()=>router.replace('/children-stories' as any)} style={styles.mainButton}><Text style={styles.buttonText}>Story Library</Text></Pressable>
  </View>;
  const finishQuiz=choice===story.answer;
  return (
    <ScrollView style={[styles.screen,bedtime&&styles.dark]} contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to story library" onPress={()=>{stop();router.back()}} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={23} color={bedtime?'#FFF':'#194C46'}/>
        </Pressable>
        <Text style={[styles.headerTitle,bedtime&&styles.light]} numberOfLines={1}>{localize(story.title,language)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={favorite?'Remove favorite':'Add favorite'} onPress={toggleFavorite} style={styles.iconButton}>
          <MaterialCommunityIcons name={favorite?'heart':'heart-outline'} size={24} color={favorite?'#E35772':bedtime?'#FFF':'#236D61'}/>
        </Pressable>
      </View>
      <View style={styles.actions}>
        {(['tl','en'] as const).map(l=><Pressable key={l} accessibilityRole="button" accessibilityState={{selected:language===l}}
          onPress={()=>setLanguage(l)} style={[styles.chip,language===l&&styles.activeChip]}>
          <Text style={[styles.chipText,language===l&&styles.activeChipText]}>{l==='tl'?'Filipino':'English'}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" accessibilityState={{selected:bedtime}} onPress={()=>{setBedtime(!bedtime);stop()}} style={[styles.chip,bedtime&&styles.activeChip]}>
          <Text style={[styles.chipText,bedtime&&styles.activeChipText]}>☾ Bedtime</Text>
        </Pressable>
      </View>
      <StoryArt story={story} page={page} animate={!bedtime&&!quiz}/>
      <View style={[styles.pageCard,bedtime&&styles.darkCard]}>
        <Text style={[styles.chapter,bedtime&&styles.light]}>{quiz?'STORY CHECK':`PAGE ${page+1} / ${story.pages.length}`}</Text>
        {quiz ? <>
          <Text style={[styles.question,bedtime&&styles.light]}>{localize(story.question,language)}</Text>
          {story.choices.map((answer,index)=>{
            const correct=finishQuiz&&index===story.answer;
            const incorrect=choice===index&&!finishQuiz;
            return <Pressable key={index} accessibilityRole="button" disabled={finishQuiz}
              onPress={()=>submit(index)} style={[styles.answer,correct&&styles.correct,incorrect&&styles.incorrect]}>
              <Text style={styles.answerText}>{String.fromCharCode(65+index)}. {localize(answer,language)}</Text>
            </Pressable>;
          })}
          {choice!==null?<Text accessibilityRole="text" style={[styles.feedback,bedtime&&styles.light]}>{finishQuiz
            ?(language==='tl'?'⭐ Magaling! Natapos mo ang kuwento.':'⭐ Wonderful! Story complete.')
            :(language==='tl'?'Subukan muli. Kaya mo iyan!':'Try again. You can do it!')}</Text>:null}
        </> : <>
          <Text style={[styles.storyText,bedtime&&styles.light]}>{localize(story.pages[page].text,language)}</Text>
          <Text style={[styles.tip,bedtime&&styles.light]}>👆 {language==='tl'?'Basahin o pakinggan kasama ang nakatatanda.':'Read or listen with a grown-up.'}</Text>
        </>}
        <Pressable accessibilityRole="button" onPress={speak} style={[styles.audioButton,bedtime&&styles.darkAudio]}>
          <MaterialCommunityIcons name={speaking?'stop-circle-outline':'volume-high'} size={22} color="#FFFFFF"/>
          <Text style={styles.audioText}>{speaking?(language==='tl'?'Itigil':'Stop'):(language==='tl'?'Pakinggan ang kuwento':'Read to me')}</Text>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" disabled={page===0&&!quiz} onPress={()=>{if(quiz){setQuiz(false);setChoice(null)}else jump(page-1)}} style={[styles.secondaryButton,(page===0&&!quiz)&&styles.disabled]}>
          <MaterialCommunityIcons name="chevron-left" size={20} color="#1B6053"/><Text style={styles.secondaryText}>{language==='tl'?'Bumalik':'Previous'}</Text>
        </Pressable>
        {quiz&&finishQuiz ? <Pressable accessibilityRole="button" onPress={()=>{stop();router.replace('/children-stories' as any)}} style={styles.mainButton}>
            <Text style={styles.buttonText}>{language==='tl'?'Tapos na ✓':'Finished ✓'}</Text>
          </Pressable>
        : <Pressable accessibilityRole="button" onPress={()=>{if(quiz){setChoice(null)}else if(page===story.pages.length-1){setQuiz(true)}else jump(page+1)}} style={styles.mainButton}>
            <Text style={styles.buttonText}>{quiz?(language==='tl'?'Ulitin ang tanong':'Try question again'):page===story.pages.length-1?(language==='tl'?'Maikling tanong':'Story question'):(language==='tl'?'Susunod':'Next')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF"/>
          </Pressable>}
      </View>
      {complete&&!quiz?<Text style={[styles.tip,bedtime&&styles.light]}>⭐ {language==='tl'?'Natapos mo na ang story check. Maaari mong basahin muli.':'Story check completed. You can read again.'}</Text>:null}
    </ScrollView>
  );
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F4F8F5'},dark:{backgroundColor:'#13283B'},
  content:{width:'100%',maxWidth:780,alignSelf:'center',padding:14,paddingBottom:35,gap:14},
  top:{flexDirection:'row',alignItems:'center',gap:8},
  iconButton:{width:42,height:42,justifyContent:'center',alignItems:'center'},
  headerTitle:{flex:1,color:'#21453F',fontSize:17,fontWeight:'900',textAlign:'center'},
  light:{color:'#F4FCFF'},
  actions:{flexDirection:'row',gap:8,flexWrap:'wrap'},
  chip:{borderRadius:20,borderWidth:1,borderColor:'#C2DCD1',paddingHorizontal:13,paddingVertical:9,backgroundColor:'#FFFFFF'},
  activeChip:{backgroundColor:'#256A5A',borderColor:'#256A5A'},
  chipText:{fontSize:12,color:'#276052',fontWeight:'800'},
  activeChipText:{color:'#FFFFFF'},
  pageCard:{borderRadius:24,backgroundColor:'#FFFFFF',padding:21,gap:14,borderWidth:1,borderColor:'#E1EBE4'},
  darkCard:{backgroundColor:'#24384D',borderColor:'#344A5F'},
  chapter:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:'#2B8B71'},
  storyText:{fontSize:24,lineHeight:37,color:'#233F39',fontWeight:'600'},
  question:{fontSize:23,lineHeight:31,color:'#203F37',fontWeight:'900'},
  tip:{fontSize:13,lineHeight:20,color:'#69857B'},
  answer:{padding:15,borderWidth:1,borderColor:'#CFE1D6',borderRadius:13,backgroundColor:'#F7FAF7'},
  correct:{borderColor:'#52A77F',backgroundColor:'#D8F3E2'},
  incorrect:{borderColor:'#CD7B78',backgroundColor:'#FFE8E4'},
  answerText:{color:'#205043',fontSize:16,fontWeight:'700'},
  feedback:{fontSize:16,fontWeight:'900',color:'#267E5D'},
  audioButton:{backgroundColor:'#297F67',padding:14,borderRadius:15,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:10},
  darkAudio:{backgroundColor:'#366B80'},audioText:{color:'#FFFFFF',fontSize:15,fontWeight:'900'},
  footer:{flexDirection:'row',justifyContent:'space-between',gap:9,alignItems:'center'},
  mainButton:{backgroundColor:'#267861',paddingHorizontal:18,paddingVertical:15,borderRadius:14,flexDirection:'row',gap:4,alignItems:'center',justifyContent:'center',minHeight:48},
  buttonText:{color:'white',fontWeight:'900',fontSize:14},
  secondaryButton:{flexDirection:'row',alignItems:'center',paddingHorizontal:11,paddingVertical:12,borderWidth:1,borderColor:'#C1DBCD',borderRadius:14,backgroundColor:'white'},
  secondaryText:{color:'#246355',fontWeight:'800',fontSize:13},disabled:{opacity:.4},notFound:{flex:1,justifyContent:'center',alignItems:'center',padding:25,gap:14,backgroundColor:'#F5F9F6'},
  big:{fontSize:23,fontWeight:'900',color:'#26453B'},body:{fontSize:14,color:'#6A7B72',textAlign:'center'}
});
