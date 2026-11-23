/** BUKLOD Estate — original offline SFX + optional on-device Filipino voice.
 * Focus-owned, gated by existing sound settings. Never blocks a database action.
 * Never plays a success cue until the caller has verified success from its RPC.
 */
import {useCallback,useEffect,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {AppState} from 'react-native';
import {createAudioPlayer} from 'expo-audio';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {chooseBibleNarrationVoice} from '@/lib/buklodBibleVoiceLocale';
import {getBuklodSoundSettings,isBuklodGameSoundEnabled,getBuklodGameSoundVolume} from '@/lib/buklodSounds';
import {subscribeBuklodAudioFocus} from '@/lib/buklodAudioFocus';
export type EstateMoment='navigation'|'preview'|'customize'|'apply'|'claim'|'buy_open'|
 'buy_success'|'buy_failure'|'build_start'|'build_complete'|'contribute'|'error'|'unlock';
const CLIPS:Record<EstateMoment,number>={
 navigation:require('../../../../assets/sounds/estate-premium/navigation.wav'),
 preview:require('../../../../assets/sounds/estate-premium/preview.wav'),
 customize:require('../../../../assets/sounds/estate-premium/customize.wav'),
 apply:require('../../../../assets/sounds/estate-premium/apply.wav'),
 claim:require('../../../../assets/sounds/estate-premium/claim.wav'),
 buy_open:require('../../../../assets/sounds/estate-premium/buy_open.wav'),
 buy_success:require('../../../../assets/sounds/estate-premium/buy_success.wav'),
 buy_failure:require('../../../../assets/sounds/estate-premium/buy_failure.wav'),
 build_start:require('../../../../assets/sounds/estate-premium/build_start.wav'),
 build_complete:require('../../../../assets/sounds/estate-premium/build_complete.wav'),
 contribute:require('../../../../assets/sounds/estate-premium/contribute.wav'),
 error:require('../../../../assets/sounds/estate-premium/error.wav'),
 unlock:require('../../../../assets/sounds/estate-premium/unlock.wav'),
};
const VOLUME:Record<EstateMoment,number>={
 navigation:.29,preview:.35,customize:.40,apply:.44,claim:.51,buy_open:.34,
 buy_success:.51,buy_failure:.28,build_start:.43,build_complete:.54,
 contribute:.44,error:.29,unlock:.49,
};
const COOLDOWN:Record<EstateMoment,number>={
 navigation:140,preview:150,customize:110,apply:350,claim:1100,buy_open:450,
 buy_success:900,buy_failure:900,build_start:600,build_complete:1000,
 contribute:750,error:850,unlock:1000,
};
const SPOKEN:Partial<Record<EstateMoment,{fil:string;en:string}>>={
 apply:{fil:'Nai-save at nailapat na ang iyong disenyo.',en:'Your design has been saved and applied.'},
 claim:{fil:'Matagumpay na na-claim ang construction milestone.',en:'Your construction milestone has been claimed.'},
 buy_success:{fil:'Matagumpay ang pagbili.',en:'Your purchase has been confirmed.'},
 buy_failure:{fil:'Hindi natuloy ang pagbili.',en:'Your purchase was not completed.'},
 build_start:{fil:'Nagsimula na ang pagtatayo.',en:'Construction has started.'},
 build_complete:{fil:'Nakumpleto na ang bagong antas ng pagtatayo.',en:'Your next construction level is complete.'},
 contribute:{fil:'Matagumpay na nailipat ang iyong ambag.',en:'Your contribution was transferred successfully.'},
 unlock:{fil:'May bago kang nabuksang development milestone.',en:'A new development milestone is unlocked.'},
};
const VOICE_KEY='@buklod_estate_voice_guidance_v1';
type Player=ReturnType<typeof createAudioPlayer>;
type Feedback={emit:(event:EstateMoment)=>void;voiceEnabled:boolean;toggleVoice:()=>void;voiceAvailable:boolean};
export function useEstateFeedback():Feedback{
 const [voiceEnabled,setVoiceEnabled]=useState(false);
 const [voiceAvailable,setVoiceAvailable]=useState(true);
 const onScreen=useRef(false),blocked=useRef(false),hydrated=useRef(false);
 const players=useRef(new Map<EstateMoment,Player>());
 const pendingDecodes=useRef(new Map<EstateMoment,{remove:()=>void}>());
 const last=useRef(new Map<EstateMoment,number>());
 const speaker=useRef<{language:string;identifier?:string;fil:boolean}>({language:'en-US',fil:false});
 const voiceRef=useRef(false);
 const spokenByUs=useRef(false);
 useEffect(()=>{voiceRef.current=voiceEnabled;},[voiceEnabled]);
 useEffect(()=>{
  let active=true;
  void AsyncStorage.getItem(VOICE_KEY).then(v=>{
   if(active)setVoiceEnabled(v==='enabled');
  }).catch(()=>undefined);
  return()=>{active=false;};
 },[]);
 useFocusEffect(useCallback(()=>{
   onScreen.current=true;blocked.current=false;last.current.clear();
   // Warm only the most common short cues; remaining clips load on first request.
   for(const cue of ['navigation','preview','customize','apply','claim','build_start','build_complete'] as EstateMoment[]){
    try{if(!players.current.has(cue))players.current.set(cue,createAudioPlayer(CLIPS[cue],{updateInterval:500}));}
    catch{/* decorative audio is optional */}
   }
   void getBuklodSoundSettings().then(()=>{if(onScreen.current)hydrated.current=true;}).catch(()=>undefined);
   void Speech.getAvailableVoicesAsync().then(voices=>{
     if(!onScreen.current)return;
     const selected=chooseBibleNarrationVoice(voices,'fil-PH');
     if(selected.available&&selected.voice){
       speaker.current={language:selected.language,identifier:selected.voice.identifier,fil:true};
       setVoiceAvailable(true);
     }else{
       speaker.current={language:'en-US',fil:false};
       setVoiceAvailable(false);
     }
   }).catch(()=>{speaker.current={language:'en-US',fil:false};setVoiceAvailable(false);});
   const unsubscribe=subscribeBuklodAudioFocus(owner=>{
    if(owner==='estate-world'||!onScreen.current)return;
    blocked.current=true;
    for(const player of players.current.values()){try{player.pause();}catch{/* optional */}}
    if(spokenByUs.current){spokenByUs.current=false;void Speech.stop().catch(()=>undefined);}
   });
   const appStateSub=AppState.addEventListener('change',state=>{
     if(state==='active')return;
     for(const player of players.current.values()){try{player.pause();}catch{/* optional */}}
     if(spokenByUs.current){spokenByUs.current=false;void Speech.stop().catch(()=>undefined);}
   });
   return ()=>{
    appStateSub.remove();
    for(const subscription of pendingDecodes.current.values())subscription.remove();
    pendingDecodes.current.clear();
    onScreen.current=false;blocked.current=false;hydrated.current=false;
    unsubscribe();
    if(spokenByUs.current){spokenByUs.current=false;void Speech.stop().catch(()=>undefined);}
    for(const player of players.current.values()){
      try{player.pause();player.remove();}catch{/* player may be unready */}
    }
    players.current.clear();last.current.clear();
   };
 },[]));
 const emit=useCallback((cue:EstateMoment)=>{
   if(!onScreen.current||blocked.current||AppState.currentState!=='active')return;
   if(!isBuklodGameSoundEnabled()&&hydrated.current)return;
   const current=new Date();
   // Respect BUKLOD quiet hours, never override Android sound or call focus.
   void getBuklodSoundSettings().then(settings=>{
     if(!onScreen.current||blocked.current||AppState.currentState!=='active')return;
     if(!settings.games||(settings.quietHours&&(current.getHours()>=22||current.getHours()<7)))return;
     const now=Date.now();
     if(now-(last.current.get(cue)??0)<COOLDOWN[cue])return;
     last.current.set(cue,now);
     let player=players.current.get(cue);
     if(!player){
      try{player=createAudioPlayer(CLIPS[cue],{updateInterval:500});players.current.set(cue,player);}
      catch{return;}
     }
     const live=player;
     try{
      live.volume=Math.min(.55,Math.max(0,getBuklodGameSoundVolume()*VOLUME[cue]));
      if(live.isLoaded){
       void live.seekTo(0).then(()=>{if(onScreen.current&&!blocked.current&&AppState.currentState==='active')live.play();}).catch(()=>undefined);
      }else if(!pendingDecodes.current.has(cue)){
       // One bounded decoder listener per clip; clean up on screen blur.
       let subscription:{remove:()=>void}|null=null;
       subscription=live.addListener('playbackStatusUpdate',status=>{
        if(!status.isLoaded)return;
        subscription?.remove();pendingDecodes.current.delete(cue);
        if(onScreen.current&&!blocked.current&&AppState.currentState==='active'&&Date.now()-now<950){
          try{live.play();}catch{/* optional */}
        }
       });
       if(subscription)pendingDecodes.current.set(cue,subscription);
      }
     }catch{/* gameplay never waits for a sound effect */}
     if(['claim','build_complete','apply','contribute','buy_success','unlock'].includes(cue)){
       void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>undefined);
     }else if(cue==='error'||cue==='buy_failure'){
       void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>undefined);
     }else if(cue==='customize'||cue==='preview'){
       void Haptics.selectionAsync().catch(()=>undefined);
     }
     const spoken=SPOKEN[cue];
     if(!spoken||!voiceRef.current)return;
     try{
       if(spokenByUs.current)void Speech.stop().catch(()=>undefined);
       spokenByUs.current=true;
       const selected=speaker.current;
       Speech.speak(selected.fil?spoken.fil:spoken.en,{
        language:selected.language,voice:selected.identifier,
        pitch:1.0,rate:.94,volume:Math.min(.78,getBuklodGameSoundVolume()),
        onDone:()=>{spokenByUs.current=false;},
        onError:()=>{spokenByUs.current=false;},
        onStopped:()=>{spokenByUs.current=false;},
       });
     }catch{spokenByUs.current=false;}
   }).catch(()=>undefined);
 },[]);
 const toggleVoice=useCallback(()=>{
  setVoiceEnabled(current=>{
   const next=!current;voiceRef.current=next;
   if(!next&&spokenByUs.current){spokenByUs.current=false;void Speech.stop().catch(()=>undefined);}
   void AsyncStorage.setItem(VOICE_KEY,next?'enabled':'disabled').catch(()=>undefined);
   return next;
  });
 },[]);
 return {emit,voiceEnabled,toggleVoice,voiceAvailable};
}
