import React from 'react';
import { MissionTrailGameV1 } from '@/features/games/niel/MissionTrailGameV1';
import { WordTrailGameV1 } from '@/features/games/kingdom/platform/WordTrailGameV1';
import { KingdomInteriorCenter, type KingdomInteriorOption } from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import { BuklodGameStage } from '@/features/games/runtime/BuklodGameStage';

const GAME_ID='niel-mission-trail';
const OPTIONS:readonly KingdomInteriorOption[]=[
 {id:'niel-word-explorer',title:'Word Explorer',
  descriptionEn:'Find expedition words hidden in letter trails',
  descriptionTl:'Hanapin ang mga salitang nakatago sa letter trails',
  kind:'pilot',render:finish=><WordTrailGameV1 gameId="niel-word-explorer" onFinish={finish}/>},
 {id:GAME_ID,title:'Mission Trail',
  descriptionEn:'Original frontier mission strategy game',
  descriptionTl:'Orihinal na laro ng ekspedisyon at misyon',
  kind:'existing',render:(_finish,originalFinish)=><MissionTrailGameV1 onFinish={originalFinish}/>},
];
export default function NielMissionTrailScreen(){
 return <BuklodGameStage biome="mission" gameId={GAME_ID}>
  <KingdomInteriorCenter character="Niel"
   subtitleEn="Lead the original Mission Trail or find hidden words along the frontier."
   subtitleTl="Pamunuan ang Mission Trail o hanapin ang mga salita sa bagong paglalakbay."
   options={OPTIONS}/>
 </BuklodGameStage>;
}
