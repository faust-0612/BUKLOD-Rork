/* Kingdom badge trials: meaningful, zero-credit challenges unlocked only by
 * server-claimed collectibles. Completion is local practice, not a new badge,
 * BP transaction, server achievement, or entitlement.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import type { CharacterCollectibleItem, CharacterCollectibleRewardKind } from '@/lib/buklodCharacterCollectibles';

type Question = { question: string; answers: readonly [string,string,string,string]; correct: number; why: string };
type Trial = { name: string; ability: string; questions: readonly [Question,Question,Question] };
const TRIALS: Record<CharacterCollectibleRewardKind, Trial> = {
  expression: {
    name: 'Empathy Path', ability: 'Practice understanding emotions and offering support.',
    questions: [
      { question:'A teammate looks discouraged after a mistake. What helps most?',
        answers:['Mock the mistake','Ask how they feel and listen','Ignore them','Spread the story'], correct:1,
        why:'Listening without judgment helps people recover.' },
      { question:'Someone celebrates an accomplishment. A good response is:',
        answers:['Compare your score','Change the topic','Congratulate them sincerely','Undermine the effort'], correct:2,
        why:'Recognition strengthens cooperation.' },
      { question:'An angry friend needs space. Your best first step is:',
        answers:['Raise your voice','Post their messages','Force an explanation','Respect space and offer to talk later'], correct:3,
        why:'Respect and calm communication protect trust.' },
    ],
  },
  speech: {
    name:'Wisdom Dialogue', ability:'Practice truthful, safe communication and constructive decisions.',
    questions: [
      { question:'Before forwarding a surprising claim, you should:',
        answers:['Share immediately','Verify reliable evidence','Remove the date','Guess the source'], correct:1,
        why:'Checking a source prevents accidental misinformation.' },
      { question:'A team disagrees about a plan. Best response:',
        answers:['Listen and compare reasons','Silence dissent','Insult others','Hide the facts'], correct:0,
        why:'Respectful discussion produces stronger decisions.' },
      { question:'A friend tells you a private concern. You should:',
        answers:['Publish it','Tell everyone','Protect their privacy unless urgent safety help is needed','Use it for attention'], correct:2,
        why:'Confidentiality builds trust; urgent danger may warrant seeking help.' },
    ],
  },
  profile_frame: {
    name:'Guardian Path', ability:'Practice safety, observation, and good judgment.',
    questions:[
      { question:'A path splits at an unmarked dangerous crossing. Choose:',
        answers:['Run forward','Follow strangers blindly','Use the safer marked route','Ignore warning signs'], correct:2,
        why:'A safe marked route reduces avoidable risk.' },
      { question:'You notice a damaged bridge. Your best action is:',
        answers:['Cross quickly','Warn others and report it','Remove the signs','Race friends across'], correct:1,
        why:'Early warning protects the whole community.' },
      { question:'Your team is lost. What should you do first?',
        answers:['Panic','Separate without contact','Throw away supplies','Regroup and verify your location'], correct:3,
        why:'Coordinated orientation prevents further risk.' },
    ],
  },
  visual_effect: {
    name:'Lightkeeper Trial', ability:'Practice patterns, planning, and persistence.',
    questions:[
      { question:'Choose the next number: 2, 4, 8, 16, ...',
        answers:['18','24','32','64'], correct:2, why:'Each number doubles.' },
      { question:'You have 3 lanterns for 5 checkpoints. Best strategy:',
        answers:['Prioritize high-risk checkpoints','Use all at one point','Leave every lantern unlit','Choose randomly'], correct:0,
        why:'Resources are best allocated by need and risk.' },
      { question:'A puzzle fails on the first try. What helps most?',
        answers:['Quit permanently','Repeat randomly','Blame someone else','Review the clues and adjust'], correct:3,
        why:'Reviewing evidence supports better strategies.' },
    ],
  },
  title_badge: {
    name:'Legacy Leadership', ability:'Practice service, accountability, and shared success.',
    questions:[
      { question:'A leader notices unequal workload. The best response:',
        answers:['Ignore it','Redistribute work fairly','Reward only friends','Blame the quietest'], correct:1,
        why:'Fair work and clear responsibilities strengthen teams.' },
      { question:'A plan fails. Responsible leadership means:',
        answers:['Hide the outcome','Blame volunteers','Own the issue and improve the plan','Erase feedback'], correct:2,
        why:'Accountability turns setbacks into learning.' },
      { question:'Your team succeeds together. Best recognition:',
        answers:['Credit every contributor','Claim all the credit','Mock beginners','Exclude quiet members'], correct:0,
        why:'Shared recognition reinforces cooperation.' },
    ],
  },
};

type Props = {
  userId: string;
  item: CharacterCollectibleItem;
  characterName: string;
  onClose: () => void;
};
export default function KingdomBadgeTrials({ userId, item, characterName, onClose }: Props) {
  const key = 'buklod:kingdom:badge-trial:v1:' + userId + ':' + item.collectibleId;
  const keyRef = useRef(key);
  keyRef.current = key;
  const [answered, setAnswered] = useState<number[]>([-1,-1,-1]);
  const [phase, setPhase] = useState<'loading'|'ready'|'saving'|'mastered'>('loading');
  const [notice, setNotice] = useState('');
  const trial = TRIALS[item.rewardKind];
  useEffect(() => {
    let live = true;
    setAnswered([-1,-1,-1]); setPhase('loading'); setNotice('');
    void AsyncStorage.getItem(key).then(value => {
      if (live && keyRef.current === key) setPhase(value === 'mastered' ? 'mastered' : 'ready');
    }).catch(() => {
      if (live && keyRef.current === key) {
        setPhase('ready'); setNotice('Local progress unavailable. You may still practice.');
      }
    });
    return () => { live = false; };
  }, [key]);

  const score = trial.questions.filter((q,i) => answered[i] === q.correct).length;
  const complete = async () => {
    if (phase !== 'ready' || answered.some(v => v < 0)) return;
    if (score !== 3) {
      setNotice('You scored ' + score + '/3. Review the explanations and try again to master this badge.');
      void playBuklodGameFeedback('failure');
      return;
    }
    setPhase('saving');
    try {
      await AsyncStorage.setItem(key,'mastered');
      if (keyRef.current !== key) return;
      setPhase('mastered');
      setNotice('Local Badge Trial mastered: ' + trial.name + '. This is a non-credit achievement.');
      void playBuklodGameFeedback('success');
    } catch {
      if (keyRef.current === key) {
        setPhase('ready'); setNotice('Could not save this local trial. You may retry.');
      }
    }
  };
  if (!item.redeemedAt || !item.collectibleId) return null;

  return <View style={s.panel}>
    <View style={s.top}>
      <MaterialCommunityIcons name="shield-star-outline" size={27} color="#eed49a"/>
      <View style={{ flex:1 }}>
        <Text style={s.label}>{characterName.toUpperCase()} • CLAIMED ITEM UNLOCK</Text>
        <Text style={s.title}>{trial.name}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close badge trial" onPress={onClose}
        style={s.close}><MaterialCommunityIcons name="close" size={22} color="#fff0cb"/></Pressable>
    </View>
    <Text style={s.description}>{trial.ability} Your claimed badge grants access to this extra challenge.</Text>
    <Text style={s.disclaimer}>No additional BP, XP, money or spendable Shards. Mastery is recorded locally on this device.</Text>
    {phase === 'loading' ? <ActivityIndicator color="#f2d28b"/> : null}
    {phase === 'mastered' ? <View style={s.finished}>
      <MaterialCommunityIcons name="check-decagram" size={35} color="#a6ebc4"/>
      <Text style={s.success}>LOCAL TRIAL MASTERED • 3/3</Text>
      <Pressable accessibilityRole="button" style={s.button} onPress={() => {
        setAnswered([-1,-1,-1]); setPhase('ready'); setNotice('');
      }}><Text style={s.buttonText}>PRACTICE AGAIN</Text></Pressable>
    </View> : null}
    {phase === 'ready' || phase === 'saving' ? <View style={s.content}>
      {trial.questions.map((q,i) => <View key={i} style={s.question}>
        <Text style={s.questionText}>{i+1}. {q.question}</Text>
        {q.answers.map((answer,j)=><Pressable key={j} accessibilityRole="button"
          accessibilityState={{selected:answered[i]===j}}
          disabled={phase !== 'ready'} onPress={()=>{setNotice('');setAnswered(current=>current.map((v,k)=>k===i?j:v));}}
          style={[s.option,answered[i]===j&&s.selected]}>
          <Text style={s.optionText}>{String.fromCharCode(65+j)}. {answer}</Text>
        </Pressable>)}
        {answered[i]>=0 && notice ? <Text style={s.explanation}>{q.why}</Text> : null}
      </View>)}
      <Pressable accessibilityRole="button" disabled={phase!=='ready'||answered.some(v=>v<0)}
        onPress={()=>void complete()} style={[s.button,(phase!=='ready'||answered.some(v=>v<0))&&s.disabled]}>
        <Text style={s.buttonText}>{phase==='saving'?'SAVING...':'VERIFY BADGE TRIAL'}</Text>
      </Pressable>
      {notice && score!==3 ? <Pressable accessibilityRole="button" onPress={()=>{setAnswered([-1,-1,-1]);setNotice('');}}
        style={s.retry}><Text style={s.retryText}>RETRY ALL THREE</Text></Pressable> : null}
    </View> : null}
    {notice ? <Text accessibilityRole="alert" style={s.notice}>{notice}</Text> : null}
  </View>;
}

const s=StyleSheet.create({
  panel:{backgroundColor:'#133749',padding:14,borderRadius:18,borderWidth:1,borderColor:'#d8b778',gap:12},
  top:{flexDirection:'row',alignItems:'center',gap:9},
  label:{fontSize:10,fontWeight:'900',color:'#e2c78e',letterSpacing:1},
  title:{fontSize:21,fontWeight:'900',color:'#fff0d4'},
  close:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  description:{fontSize:13,color:'#e3f0eb',lineHeight:19},
  disclaimer:{fontSize:11,color:'#bccdd1',lineHeight:16},
  content:{gap:14},question:{backgroundColor:'#1e4855',borderRadius:12,padding:12,gap:8},
  questionText:{fontSize:14,fontWeight:'800',lineHeight:20,color:'#fff5dd'},
  option:{padding:11,borderRadius:9,borderWidth:1,borderColor:'#5b8a8b',backgroundColor:'#244f5c'},
  selected:{borderColor:'#f6d58d',borderWidth:2,backgroundColor:'#315b5b'},
  optionText:{fontSize:12,lineHeight:18,color:'#f0f6f0'},
  explanation:{fontSize:11,color:'#e7cf98',lineHeight:17},
  button:{backgroundColor:'#f2d18f',borderRadius:12,minHeight:45,alignItems:'center',justifyContent:'center',paddingHorizontal:12},
  buttonText:{fontSize:12,fontWeight:'900',color:'#273d44'},
  retry:{padding:10,alignItems:'center',borderWidth:1,borderColor:'#e7c684',borderRadius:10},
  retryText:{color:'#f3d58f',fontWeight:'900',fontSize:12},
  disabled:{opacity:.45},
  finished:{alignItems:'center',gap:13,padding:16},
  success:{fontWeight:'900',fontSize:15,color:'#abebc9'},
  notice:{fontSize:12,lineHeight:18,color:'#fee1ba'},
});
