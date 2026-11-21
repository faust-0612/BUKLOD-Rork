/**
 * Offline-first announcer for BUKLOD Empire Arena.
 * expo-speech uses only the local device voice service; no cloud API is
 * invoked by this module. If Android has no speech engine/voice installed,
 * battle sound effects stay playable and gameplay is never blocked.
 */
import * as Speech from 'expo-speech';
import {AppState,Platform} from 'react-native';
import {isBuklodGameSoundEnabled,getBuklodGameSoundVolume} from '@/lib/buklodSounds';
import {subscribeBuklodAudioFocus} from '@/lib/buklodAudioFocus';
import {setArenaVoiceDucking} from '@/features/games/runtime/rorkAudio';
// @ts-ignore - deterministic pure JS event score.
import {selectArenaAnnouncement} from './arenaVoiceDirector.mjs';

let focused=false;
let mutedByCompetingAudio=false;
let speechBusy=false;
let lastVoiceAt=0;
let announcedPriority=0;
let unsubscribeFocus:(()=>void)|null=null;
let voiceAvailable=true;
let speechGeneration=0;

function endSpeech(generation?:number){
  // Old onStopped callbacks must never silence the next urgent announcement.
  if(generation!==undefined && generation!==speechGeneration)return;
  speechBusy=false;announcedPriority=0;
  setArenaVoiceDucking(false);
}
export function setArenaVoiceFocus(active:boolean){
  if(!active){
    focused=false;
    unsubscribeFocus?.();unsubscribeFocus=null;
    speechGeneration++;
    endSpeech();
    void Speech.stop().catch(()=>undefined);
    return;
  }
  focused=true;
  mutedByCompetingAudio=false;
  voiceAvailable=true;
  unsubscribeFocus?.();
  unsubscribeFocus=subscribeBuklodAudioFocus(owner=>{
    if(owner!=='buklod-empire-arena'){
      mutedByCompetingAudio=true;
      speechGeneration++;
      endSpeech();
      void Speech.stop().catch(()=>undefined);
    }
  });
}
/** Immediately silence an ongoing announcement when the member disables
 * voice, rather than waiting until the current spoken sentence finishes. */
export function stopArenaVoiceAnnouncements(){
  speechGeneration++;
  endSpeech();
  void Speech.stop().catch(()=>undefined);
}

export function playArenaVoiceAnnouncements(cues:readonly {id:string}[], enabled=true):boolean {
  if(!enabled||!focused||mutedByCompetingAudio||!voiceAvailable||
    AppState.currentState!=='active'||!isBuklodGameSoundEnabled()||Platform.OS==='web')return false;
  const now=Date.now();
  const next=selectArenaAnnouncement(cues,lastVoiceAt,now);
  if(!next)return false;
  if(speechBusy&&next.priority<=announcedPriority)return false;
  // No continuous speech queue. A major Seal/tower alert may interrupt a
  // lesser line; normal hits can never interrupt their own announcements.
  if(speechBusy)void Speech.stop().catch(()=>undefined);
  const generation=++speechGeneration;
  lastVoiceAt=now;speechBusy=true;announcedPriority=next.priority;
  setArenaVoiceDucking(true);
  try {
    Speech.speak(next.text,{
      language:'en-US',
      pitch:0.94,
      rate:1.08,
      volume:Math.max(0,Math.min(.42,getBuklodGameSoundVolume()*.38)),
      useApplicationAudioSession:false,
      onDone:()=>endSpeech(generation),
      onStopped:()=>endSpeech(generation),
      onError:()=>{if(generation===speechGeneration)voiceAvailable=false;endSpeech(generation);},
    });
    return true;
  }catch{
    // Graceful failure for Android without installed/offline TTS engine.
    endSpeech(generation);return false;
  }
}
