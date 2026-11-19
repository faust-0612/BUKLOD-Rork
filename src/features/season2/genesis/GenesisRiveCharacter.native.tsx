import React from 'react';
import {View} from 'react-native';
import {Fit,RiveView,useRiveFile} from '@rive-app/react-native';

type Props={approvedRiveUri?:string|null;active:boolean;width:number;height:number;fallback?:React.ReactNode};
function RiggedCharacter({uri,width,height}:{uri:string;width:number;height:number}){
  const {riveFile,isLoading,error}=useRiveFile({uri});
  if(isLoading||error||!riveFile)return null;
  return <RiveView file={riveFile} autoPlay fit={Fit.Contain} style={{width,height}}/>;
}
/** Real state-machine ready .riv rigs only: no fake bobbing of low-res thumbnails. */
export default function GenesisRiveCharacter({approvedRiveUri,active,width,height,fallback}:Props){
  const uri=String(approvedRiveUri??'').trim();
  const safe=uri.startsWith('https://')&&/\.riv(?:\?|$)/i.test(uri);
  return <View style={{width,height,alignItems:'center',justifyContent:'center'}}>
    {active&&safe ? <RiggedCharacter uri={uri} width={width} height={height}/> : fallback??null}
  </View>;
}
