import React from 'react';
import {View} from 'react-native';
import {Fit,RiveView,useRiveFile} from '@rive-app/react-native';
import {getGenesisApprovedRig} from './genesisAssetRegistry';
type Props={rigId?:string|null;active:boolean;width:number;height:number;fallback?:React.ReactNode};
function ApprovedRig({uri,width,height,fallback}:{uri:string;width:number;height:number;fallback?:React.ReactNode}){
  const {riveFile,isLoading,error}=useRiveFile({uri});
  if(isLoading||error||!riveFile)return <>{fallback??null}</>;
  return <RiveView file={riveFile} autoPlay fit={Fit.Contain} style={{width,height}}/>;
}
/**
 * Only manifest-approved, high-resolution state-machine rigs may animate.
 * A missing asset shows the supplied still artwork; no fake floating image.
 */
export default function GenesisRiveCharacter({rigId,active,width,height,fallback}:Props){
  const approved=getGenesisApprovedRig(rigId);
  return <View style={{width,height,alignItems:'center',justifyContent:'center'}}>
    {active&&approved?<ApprovedRig uri={approved.uri} width={width} height={height} fallback={fallback}/>:fallback??null}
  </View>;
}
