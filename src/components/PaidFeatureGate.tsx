import React from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {usePaidFeature} from '@/hooks/usePaidFeature';

export function PaidFeatureGate({featureCode,children}:{featureCode:string;children:React.ReactNode}){
  const {loading,hasAccess}=usePaidFeature(featureCode);
  if(loading) return <View style={s.box}><ActivityIndicator/></View>;
  if(hasAccess) return <>{children}</>;
  return <View style={s.box}>
    <Text style={s.title}>Premium feature</Text>
    <Text>Subscribe to unlock this feature.</Text>
    <Pressable style={s.button} onPress={()=>router.push('/premium' as any)}>
      <Text style={s.buttonText}>VIEW PLANS</Text>
    </Pressable>
  </View>;
}
const s=StyleSheet.create({
  box:{margin:16,padding:20,gap:10,borderRadius:18,borderWidth:1,borderColor:'#ddd',alignItems:'center'},
  title:{fontSize:18,fontWeight:'800'},
  button:{paddingHorizontal:18,paddingVertical:11,borderRadius:999,backgroundColor:'#0E4F20'},
  buttonText:{color:'#fff',fontWeight:'800'}
});
