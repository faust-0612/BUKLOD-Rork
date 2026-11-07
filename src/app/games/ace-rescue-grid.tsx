import React from 'react';
import {View} from 'react-native';
import {RescueGridGameV1} from '@/features/games/ace/RescueGridGameV1';
import {ChessMasterGameV1} from '@/features/games/ace/ChessMasterGameV1';
import {TowerTacticsGameV1} from '@/features/games/ace/TowerTacticsGameV1';
import {KingdomInteriorCenter,type KingdomInteriorOption} from '@/features/games/kingdom/platform/KingdomInteriorCenter';
import {BuklodGameStage} from '@/features/games/runtime/BuklodGameStage';
const GAME_ID='ace-rescue-grid';
const OPTIONS:readonly KingdomInteriorOption[]=[
 {id:'ace-chess-master',title:'Chess Master',
  descriptionEn:'Three fully legal chess matches vs local AI',
  descriptionTl:'Tatlong tunay na laro ng chess laban sa offline AI',
  kind:'pilot',render:finish=><ChessMasterGameV1 onFinish={finish}/>},
 {id:'ace-tower-tactics',title:'Tower Tactics',
  descriptionEn:'Place towers and defend three escalating waves',
  descriptionTl:'Maglagay ng tower at ipagtanggol ang kuta laban sa tatlong wave',
  kind:'pilot',render:finish=><TowerTacticsGameV1 onFinish={finish}/>},
 {id:GAME_ID,title:'Rescue Grid',
  descriptionEn:'Original emergency-grid rescue strategy',
  descriptionTl:'Orihinal na laro ng rescue grid',
  kind:'existing',render:(_finish,originalFinish)=>
   <View style={{minHeight:680,width:'100%'}}>
    <RescueGridGameV1 onFinish={originalFinish}/>
   </View>},
];
export default function AceRescueGridScreen(){
 return <BuklodGameStage biome="strategy" gameId={GAME_ID}>
  <KingdomInteriorCenter character="Ace"
   subtitleEn="Learn chess strategy, defend the fortress and lead the original rescue grid."
   subtitleTl="Magsanay sa chess, ipagtanggol ang kuta at pamunuan ang rescue grid."
   options={OPTIONS}/>
 </BuklodGameStage>;
}
