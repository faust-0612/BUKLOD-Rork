import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useAuth } from '@/providers/AuthProvider';
import StoryArt from '@/features/childrenStories/StoryArt';
import { BUNDLED_CHILDREN_STORIES, ChildrenStory, StoryLanguage, findBundledStory, localize } from '@/features/childrenStories/catalog';
import { fetchChildrenStoryLibrary, readStoryProgress, saveStoryProgress } from '@/features/childrenStories/service';
import { getSundaySchoolLesson } from '@/features/childrenStories/sundaySchool';
import { StoryNarrator, type StoryAudioState } from '@/features/childrenStories/storyNarration';

export default function ChildrenStoryReader() {
  const params=useLocalSearchParams<{id:string;lang?:string}>();
  const id=typeof params.id==='string'?params.id:'';
  const {user}=useAuth();
  const [language,setLanguage]=useState<StoryLanguage>(params.lang==='en'?'en':'tl');
  const [story,setStory]=useState<ChildrenStory | null>(findBundledStory(id)??null);
  const [page,setPage]=useState(0);
  const [quiz,setQuiz]=useState(false);
  const [questionIndex,setQuestionIndex]=useState(0);
  const [choice,setChoice]=useState<number|null>(null);
  const [complete,setComplete]=useState(false);
  const [favorite,setFavorite]=useState(false);
  const [audioState,setAudioState]=useState<StoryAudioState>({status:'idle'});
  const [bedtime,setBedtime]=useState(false);
  const narratorRef=useRef<StoryNarrator | null>(null);
  const narrator=useCallback(()=>{
    if(!narratorRef.current) narratorRef.current=new StoryNarrator(Speech,setAudioState);
    return narratorRef.current;
  },[]);
  const stop=useCallback(()=>{
    narratorRef.current?.stop();
    setAudioState({status:'idle'});
  },[]);
  useFocusEffect(useCallback(()=>()=>stop(),[stop]));
  useEffect(()=>()=>{narratorRef.current?.dispose();narratorRef.current=null;},[]);
  useEffect(()=>{
    const sub=AppState.addEventListener('change',s=>{if(s!=='active')stop()});
    return ()=>sub.remove();
  },[stop]);
  useEffect(()=>{
    let live=true;
    const builtin=findBundledStory(id)??null;
    setStory(builtin);setPage(0);setQuiz(false);setQuestionIndex(0);setChoice(null);setComplete(false);setFavorite(false);
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
    return()=>{live=false;stop();};
  },[id,user?.id,stop]);
  useEffect(()=>{stop()},[language,page,quiz,questionIndex,stop]);
  const lesson=getSundaySchoolLesson(story);
  const questions=story?[{prompt:story.question,choices:story.choices,answer:story.answer},...(lesson?.questions??[])]:[];
  const activeQuestion=questions[Math.min(questionIndex,questions.length-1)];
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
    if(audioState.status==='playing'){narrator().pause();return;}
    if(audioState.status==='paused'){void narrator().resume();return;}
    if(audioState.status==='preparing'){stop();return;}
    const content=quiz?(activeQuestion?localize(activeQuestion.prompt,language):'')
      :lesson?localize(lesson.narrative,language)
      :localize(story.pages[Math.min(page,story.pages.length-1)].text,language);
    void narrator().play(content,language,bedtime);
  }
  const audioNotice=audioState.status==='error' ? (
    audioState.problem==='voice-unavailable'
      ? (language==='tl'?'Walang Filipino/Tagalog na boses sa phone. I-install o i-enable sa Android Settings → Text-to-speech output → Voice data, saka subukang muli.':'The selected language voice is not installed. Enable or download it in Android Text-to-speech settings, then retry.')
      : (language==='tl'?'Hindi masimulan ang pagbasa. Tingnan ang Text-to-speech engine, voice data at media volume ng phone, saka subukan muli.':'Speech could not start. Check your phone’s text-to-speech engine, voice data and media volume, then retry.')
  ) : null;
  function submit(index:number){
    if(!story||!activeQuestion||choice===activeQuestion.answer)return;
    setChoice(index);
    if(index===activeQuestion.answer&&questionIndex===questions.length-1){
      setComplete(true);
      void saveStoryProgress(user?.id,story.id,{completed:true,page:story.pages.length-1});
    }
  }
  if(!story) return <View style={styles.notFound}>
    <Text style={styles.big}>Hindi makita ang kuwento.</Text>
    <Text style={styles.body}>Bumalik sa library at pumili ng isa pang kuwento.</Text>
    <Pressable accessibilityRole="button" onPress={()=>router.replace('/children-stories' as any)} style={styles.mainButton}><Text style={styles.buttonText}>Story Library</Text></Pressable>
  </View>;
  const safePage=Math.min(page,story.pages.length-1);
  const finishQuiz=choice===activeQuestion?.answer;
  const lastQuestion=questionIndex===questions.length-1;
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
      <StoryArt story={story} page={lesson?0:safePage} compact={Boolean(lesson)} animate={!bedtime&&!quiz}/>
      <View style={[styles.pageCard,bedtime&&styles.darkCard]}>
        <Text style={[styles.chapter,bedtime&&styles.light]}>{quiz?`STORY CHECK · ${questionIndex+1} / ${questions.length}`:lesson?(language==='tl'?'BUONG KUWENTO':'FULL STORY'):`PAGE ${safePage+1} / ${story.pages.length}`}</Text>
        {quiz ? <>
          <Text style={[styles.question,bedtime&&styles.light]}>{localize(activeQuestion.prompt,language)}</Text>
          {activeQuestion.choices.map((answer,index)=>{
            const correct=finishQuiz&&index===activeQuestion.answer;
            const incorrect=choice===index&&!finishQuiz;
            return <Pressable key={index} accessibilityRole="button" disabled={finishQuiz}
              onPress={()=>submit(index)} style={[styles.answer,correct&&styles.correct,incorrect&&styles.incorrect]}>
              <Text style={styles.answerText}>{String.fromCharCode(65+index)}. {localize(answer,language)}</Text>
            </Pressable>;
          })}
          {choice!==null?<Text accessibilityRole="text" style={[styles.feedback,bedtime&&styles.light]}>{finishQuiz
            ?(lastQuestion?(language==='tl'?'⭐ Magaling! Natapos mo ang lahat ng tanong.':'⭐ Wonderful! All questions complete.'):(language==='tl'?'⭐ Tama! Susunod na tanong.':'⭐ Correct! Next question.'))
            :(language==='tl'?'Subukan muli. Kaya mo iyan!':'Try again. You can do it!')}</Text>:null}
        </> : lesson ? <>
          {!!lesson.retellingNotice && <Text style={[styles.tip,bedtime&&styles.light]}>{localize(lesson.retellingNotice,language)}</Text>}
          <Text style={[styles.storyText,styles.longStoryText,bedtime&&styles.light]}>{localize(lesson.narrative,language).trim().replace(/\n\s*\n/g,'\n\n')}</Text>
          <Text style={[styles.tip,bedtime&&styles.light]}>{language==='tl'?'Basahin o pakinggan ang buong kuwento kasama ang guro o nakatatanda.':'Read or listen to the full story with a teacher or grown-up.'}</Text>
          <View style={[styles.lessonPanel,bedtime&&styles.darkLesson]}>
            <Text style={[styles.lessonHeading,bedtime&&styles.light]}>🌱 {language==='tl'?'MORAL LESSON · ARAL SA PAG-UUGALI':'MORAL LESSON'}</Text>
            <Text style={[styles.lessonBody,bedtime&&styles.light]}>{localize(lesson.moral,language)}</Text>
          </View>
          <View style={[styles.lessonPanel,bedtime&&styles.darkLesson]}>
            <Text style={[styles.lessonHeading,bedtime&&styles.light]}>✝ {language==='tl'?'SPIRITUAL LESSON · ESPIRITUWAL NA ARAL':'SPIRITUAL LESSON'}</Text>
            <Text style={[styles.lessonBody,bedtime&&styles.light]}>{localize(lesson.spiritual,language)}</Text>
            <Text style={[styles.reference,bedtime&&styles.light]}>{language==='tl'?'Bible reference':'Bible passage'}: {lesson.reference}</Text>
          </View>
          <View style={[styles.lessonPanel,bedtime&&styles.darkLesson]}>
            <Text style={[styles.lessonHeading,bedtime&&styles.light]}>🙏 {language==='tl'?'PANALANGIN':'CLOSING PRAYER'}</Text>
            <Text style={[styles.lessonBody,bedtime&&styles.light]}>{localize(lesson.prayer,language)}</Text>
          </View>
          <View style={[styles.lessonPanel,bedtime&&styles.darkLesson]}>
            <Text style={[styles.lessonHeading,bedtime&&styles.light]}>💬 {language==='tl'?'TALAKAYAN SA KLASE':'CLASS DISCUSSION'}</Text>
            {lesson.discussion.map((item,i)=><Text key={i} style={[styles.discussion,bedtime&&styles.light]}>{i+1}. {localize(item,language)}</Text>)}
          </View>
        </> : <>
          <Text style={[styles.storyText,bedtime&&styles.light]}>{localize(story.pages[safePage].text,language)}</Text>
          <Text style={[styles.tip,bedtime&&styles.light]}>👆 {language==='tl'?'Basahin o pakinggan kasama ang nakatatanda.':'Read or listen with a grown-up.'}</Text>
        </>}
        <Pressable accessibilityRole="button" onPress={speak} style={[styles.audioButton,bedtime&&styles.darkAudio]}>
          <MaterialCommunityIcons name={audioState.status==='playing'?'pause-circle-outline':audioState.status==='paused'?'play-circle-outline':audioState.status==='preparing'?'close-circle-outline':'volume-high'} size={22} color="#FFFFFF"/>
          <Text style={styles.audioText}>{
            audioState.status==='playing'?(language==='tl'?'I-pause':'Pause'):
            audioState.status==='paused'?(language==='tl'?'Ipagpatuloy':'Resume'):
            audioState.status==='preparing'?(language==='tl'?'Kinukuha ang boses · Kanselahin':'Preparing voice · Cancel'):
            (language==='tl'?'Pakinggan ang kuwento':'Read to me')
          }</Text>
        </Pressable>
        {(audioState.status==='playing'||audioState.status==='paused')?
          <Pressable accessibilityRole="button" onPress={stop} style={[styles.stopAudioButton,bedtime&&styles.darkStopAudio]}>
            <MaterialCommunityIcons name="stop-circle-outline" size={19} color={bedtime?'#F2FFFF':'#1D6254'}/>
            <Text style={[styles.stopAudioText,bedtime&&styles.light]}>{language==='tl'?'Itigil ang audio':'Stop audio'}</Text>
          </Pressable> : null}
        {audioNotice ? <Text accessibilityRole="alert" style={[styles.audioWarning,bedtime&&styles.light]}>{audioNotice}</Text> : null}
      </View>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" disabled={!quiz&&!lesson&&safePage===0}
          onPress={()=>{if(quiz){setQuiz(false);setQuestionIndex(0);setChoice(null);}else if(lesson){stop();router.back();}else jump(safePage-1);}}
          style={[styles.secondaryButton,!quiz&&!lesson&&safePage===0&&styles.disabled]}>
          <MaterialCommunityIcons name="chevron-left" size={20} color="#1B6053"/>
          <Text style={styles.secondaryText}>{quiz?(language==='tl'?'Balik sa kuwento':'Back to story'):lesson?(language==='tl'?'Mga kuwento':'Story library'):(language==='tl'?'Bumalik':'Previous')}</Text>
        </Pressable>
        {quiz&&finishQuiz&&lastQuestion ?
          <Pressable accessibilityRole="button" onPress={()=>{stop();router.replace('/children-stories' as any)}} style={styles.mainButton}>
            <Text style={styles.buttonText}>{language==='tl'?'Tapos na ✓':'Finished ✓'}</Text>
          </Pressable>
        : <Pressable accessibilityRole="button" onPress={()=>{
            if(quiz){if(finishQuiz)setQuestionIndex(i=>Math.min(questions.length-1,i+1));setChoice(null);}
            else if(lesson){setQuiz(true);setQuestionIndex(0);setChoice(null);}
            else if(safePage===story.pages.length-1){setQuiz(true);setQuestionIndex(0);setChoice(null);}
            else jump(safePage+1);
          }} style={styles.mainButton}>
            <Text style={styles.buttonText}>{quiz
              ?finishQuiz?(language==='tl'?'Susunod na tanong':'Next question'):(language==='tl'?'Subukan muli':'Try again')
              :lesson?(language==='tl'?`Sagutan ang ${questions.length} tanong`:`Answer ${questions.length} questions`)
              :safePage===story.pages.length-1?(language==='tl'?'Maikling tanong':'Story question'):(language==='tl'?'Susunod':'Next')}</Text>
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
  longStoryText:{fontSize:20,lineHeight:34,fontWeight:'500'},
  lessonPanel:{backgroundColor:'#F1F8EF',borderRadius:14,padding:15,gap:9,borderWidth:1,borderColor:'#D6E8D9'},
  darkLesson:{backgroundColor:'#314A58',borderColor:'#465967'},
  lessonHeading:{fontSize:13,fontWeight:'900',letterSpacing:.6,color:'#205C4A'},
  lessonBody:{fontSize:17,lineHeight:28,color:'#2E5045'},
  reference:{fontSize:13,fontWeight:'800',color:'#417965'},
  discussion:{fontSize:16,lineHeight:25,color:'#2E5045'},
  question:{fontSize:23,lineHeight:31,color:'#203F37',fontWeight:'900'},
  tip:{fontSize:13,lineHeight:20,color:'#69857B'},
  answer:{padding:15,borderWidth:1,borderColor:'#CFE1D6',borderRadius:13,backgroundColor:'#F7FAF7'},
  correct:{borderColor:'#52A77F',backgroundColor:'#D8F3E2'},
  incorrect:{borderColor:'#CD7B78',backgroundColor:'#FFE8E4'},
  answerText:{color:'#205043',fontSize:16,fontWeight:'700'},
  feedback:{fontSize:16,fontWeight:'900',color:'#267E5D'},
  audioButton:{backgroundColor:'#297F67',padding:14,borderRadius:15,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:10},
  darkAudio:{backgroundColor:'#366B80'},audioText:{color:'#FFFFFF',fontSize:15,fontWeight:'900'},
  stopAudioButton:{paddingVertical:11,paddingHorizontal:14,borderRadius:13,borderColor:'#C6DDD0',borderWidth:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:7,backgroundColor:'#F1F8F4'},
  darkStopAudio:{backgroundColor:'#314A58',borderColor:'#526B77'},stopAudioText:{color:'#1D6254',fontWeight:'800',fontSize:13},
  audioWarning:{fontSize:13,lineHeight:20,color:'#8D3A31',fontWeight:'700'},
  footer:{flexDirection:'row',justifyContent:'space-between',gap:9,alignItems:'center'},
  mainButton:{backgroundColor:'#267861',paddingHorizontal:18,paddingVertical:15,borderRadius:14,flexDirection:'row',gap:4,alignItems:'center',justifyContent:'center',minHeight:48},
  buttonText:{color:'white',fontWeight:'900',fontSize:14},
  secondaryButton:{flexDirection:'row',alignItems:'center',paddingHorizontal:11,paddingVertical:12,borderWidth:1,borderColor:'#C1DBCD',borderRadius:14,backgroundColor:'white'},
  secondaryText:{color:'#246355',fontWeight:'800',fontSize:13},disabled:{opacity:.4},notFound:{flex:1,justifyContent:'center',alignItems:'center',padding:25,gap:14,backgroundColor:'#F5F9F6'},
  big:{fontSize:23,fontWeight:'900',color:'#26453B'},body:{fontSize:14,color:'#6A7B72',textAlign:'center'}
});
