import React from 'react';
import {View} from 'react-native';
export default function GenesisRiveCharacter({width,height,fallback}:{
  approvedRiveUri?:string|null;active:boolean;width:number;height:number;fallback?:React.ReactNode;
}){return <View style={{width,height}}>{fallback??null}</View>;}
