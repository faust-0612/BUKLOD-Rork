import React from 'react';
import {Pressable,Text,StyleSheet} from 'react-native';
import {router} from 'expo-router';
import type {BuklodScope} from '@/lib/buklodScope';
export default function BuklodChildrenTeachingDoor({scope}:{scope:BuklodScope}){
 if(process.env.EXPO_PUBLIC_CHILDREN_TEACHING_ENABLED!=='true'||scope.scope_type!=='CLUSTER'||!scope.show_faith_content)return null;
 return <Pressable accessibilityRole="button" style={styles.door} onPress={()=>router.push({pathname:'/faith/children-teaching',params:{scopeId:scope.scope_id}} as any)}>
 <Text style={styles.title}>Children Teaching Session · +10 BP</Text><Text style={styles.sub}>Adult teacher report • Private evidence • No child names</Text></Pressable>;
}
const styles=StyleSheet.create({door:{backgroundColor:'#19563F',borderRadius:14,padding:12,marginVertical:4},title:{color:'#FFF',fontWeight:'800',fontSize:16},sub:{color:'#D8F3E0',fontSize:12,marginTop:3}});
