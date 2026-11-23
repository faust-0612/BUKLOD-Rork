/** Original offline Genesis opening cue, after login + consent + cinematic handoff.
 * One play per app session; PTT, calls and other audio-focus owners take priority.
 */
import {useEffect,useState} from 'react';
import {AppState,Platform} from 'react-native';
import {createAudioPlayer,type AudioPlayer} from 'expo-audio';
import {getBuklodSoundSettings,isBuklodGameSoundEnabled,getBuklodGameSoundVolume} from '@/lib/buklodSounds';
import {subscribeBuklodAudioFocus,isBuklodPttVoiceActive,subscribeBuklodPttVoiceActivity} from '@/lib/buklodAudioFocus';

const GENESIS_ENTRY_CUE=require('../../../../assets/sounds/buklod-genesis-opening-20261120.wav');
let playedInSession=false;
export function useGenesisEntryAudio(eligible:boolean):boolean{
  const [ambienceReady,setAmbienceReady]=useState(false);
  useEffect(()=>{
    if(!eligible){setAmbienceReady(false);return;}
    if(playedInSession||Platform.OS==='web'){setAmbienceReady(true);return;}
    playedInSession=true;
    let live=true;
    let finished=false;
    let interrupted=false;
    let started=false;
    let player:AudioPlayer|null=null;
    let playbackSubscription:{remove:()=>void}|null=null;
    let deadline:ReturnType<typeof setTimeout>|null=null;
    const cleanup=()=>{
      if(deadline){clearTimeout(deadline);deadline=null;}
      playbackSubscription?.remove();
      playbackSubscription=null;
      const old=player;
      player=null;
      if(old){
        try{old.pause();}catch{/* optional music */}
        try{old.remove();}catch{/* optional music */}
      }
    };
    const finish=()=>{
      if(finished)return;
      finished=true;
      cleanup();
      if(live&&!interrupted)setAmbienceReady(true);
    };
    const focus=subscribeBuklodAudioFocus(owner=>{
      if(owner==='genesis-entry')return;
      interrupted=true;
      finish();
    });
    // Short entrance cue yields immediately; the subsequent map score keeps time
    // and ducks during PTT rather than pause/restart looping.
    const pttActivity=subscribeBuklodPttVoiceActivity(active=>{if(active)finish();});
    const background=AppState.addEventListener('change',state=>{
      if(state!=='active'){interrupted=true;finish();}
    });
    const playReady=()=>{
      if(!live||finished||started||!player||!player.isLoaded||
          AppState.currentState!=='active'||!isBuklodGameSoundEnabled())return;
      started=true;
      try{player.play();}catch{finish();}
    };
    void getBuklodSoundSettings().then(()=>{
      if(!live||finished)return;
      if(AppState.currentState!=='active'){interrupted=true;finish();return;}
      if(!isBuklodGameSoundEnabled()||isBuklodPttVoiceActive()){finish();return;}
      try{
        const created=createAudioPlayer(GENESIS_ENTRY_CUE,{updateInterval:200});
        player=created;
        created.loop=false;
        created.volume=Math.min(.33,getBuklodGameSoundVolume());
        playbackSubscription=created.addListener('playbackStatusUpdate',status=>{
          if(status.didJustFinish){finish();return;}
          if(status.isLoaded)playReady();
        });
        deadline=setTimeout(finish,3300); // never block map entrance on codec trouble
        playReady();
      }catch{finish();}
    }).catch(finish);
    return()=>{
      live=false;
      cleanup();
      focus();
      pttActivity();
      background.remove();
    };
  },[eligible]);
  return eligible&&ambienceReady;
}
