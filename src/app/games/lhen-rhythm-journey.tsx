import React from 'react';
import {RhythmJourneyGameV1} from '@/features/games/lhen/RhythmJourneyGameV1';
import {MelodyMemoryGameV1,BeatComposerGameV1} from '@/features/games/lhen/MusicCityGameV1';
import {KingdomInteriorCenter,type KingdomInteriorOption} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import {BuklodGameStage} from '@/features/games/runtime/BuklodGameStage';
const GAME_ID='lhen-rhythm-journey';
const OPTIONS:readonly KingdomInteriorOption[]=[
 {id:'lhen-melody-memory',title:'Melody Memory',
  descriptionEn:'Remember three original note patterns with visual cues',
  descriptionTl:'Tandaan ang tatlong note pattern na may visual cues',
  kind:'pilot',render:finish=><MelodyMemoryGameV1 onFinish={finish}/>},
 {id:'lhen-beat-composer',title:'Beat Composer',
  descriptionEn:'Reproduce three eight-step rhythm patterns',
  descriptionTl:'Bumuo ng tatlong 8-step rhythm pattern',
  kind:'pilot',render:finish=><BeatComposerGameV1 onFinish={finish}/>},
 {id:GAME_ID,title:'Rhythm Journey',
  descriptionEn:'Original rhythm timing game',
  descriptionTl:'Orihinal na laro ng ritmo',
  kind:'existing',render:(_finish,originalFinish)=><RhythmJourneyGameV1 onFinish={originalFinish}/>},
];
export default function LhenRhythmJourneyScreen(){
 return <BuklodGameStage biome="music" gameId={GAME_ID}>
  <KingdomInteriorCenter character="Lhen"
   subtitleEn="Experience rhythm timing, remember note patterns or build a new beat."
   subtitleTl="Subukan ang ritmo, tandaan ang melody o bumuo ng bagong beat."
   options={OPTIONS}/>
 </BuklodGameStage>;
}
