import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  loadBuklodToday,
  recordBuklodTodayEngagement,
  triggerBuklodTodayGenerationIfNeeded,
  type BuklodTodayItem,
} from '@/lib/buklodDailyEngagement';

function iconFor(type:BuklodTodayItem['item_type']){
  if(type==='POLL') return 'poll';
  if(type==='CHALLENGE') return 'flag-checkered';
  if(type==='TRENDING_SUMMARY') return 'trending-up';
  if(type==='TRIVIA') return 'lightbulb-on-outline';
  return 'comment-question-outline';
}

export default function BuklodTodayCard(){
  const [items,setItems]=useState<BuklodTodayItem[]>([]);
  const [fallback,setFallback]=useState(false);
  const [selected,setSelected]=useState<Record<string,string>>({});

  useEffect(()=>{
    let alive=true;
    void (async()=>{
      const first=await loadBuklodToday();
      if(!alive)return;
      setItems(first.items.slice(0,4));
      setFallback(first.fallback);
      for(const item of first.items.slice(0,4)) void recordBuklodTodayEngagement(item.id,'VIEW');

      if(first.generationNeeded){
        const generated=await triggerBuklodTodayGenerationIfNeeded();
        if(generated&&alive){
          const next=await loadBuklodToday();
          if(!alive)return;
          setItems(next.items.slice(0,4));
          setFallback(next.fallback);
        }
      }
    })();
    return()=>{alive=false};
  },[]);

  const visible=useMemo(()=>items.slice(0,4),[items]);
  if(!visible.length)return null;

  return (
    <View style={s.shell}>
      <View style={s.head}>
        <View>
          <Text style={s.eyebrow}>BUKLOD TODAY</Text>
          <Text style={s.sub}>Fresh daily conversation starters</Text>
        </View>
        {fallback?<Text style={s.fallback}>SAFE FALLBACK</Text>:null}
      </View>

      {visible.map(item=>(
        <View key={item.id} style={s.card}>
          <View style={s.titleRow}>
            <MaterialCommunityIcons name={iconFor(item.item_type) as any} size={18} color="#1E6B45"/>
            <Text style={s.title}>{item.title}</Text>
            {item.source_kind==='REAL_TRENDING'?<Text style={s.real}>REAL ACTIVITY</Text>:null}
          </View>
          <Text style={s.body}>{item.body}</Text>
          {Array.isArray(item.options)&&item.options.length?(
            <View style={s.options}>
              {item.options.map(option=>{
                const active=selected[item.id]===option;
                return (
                  <Pressable
                    key={option}
                    onPress={()=>{
                      setSelected(current=>({...current,[item.id]:option}));
                      void recordBuklodTodayEngagement(item.id,'ENGAGE');
                    }}
                    style={[s.option,active&&s.optionOn]}
                  >
                    <Text style={[s.optionText,active&&s.optionTextOn]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          ):null}
        </View>
      ))}
    </View>
  );
}

const s=StyleSheet.create({
  shell:{marginBottom:12,gap:8},
  head:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:8},
  eyebrow:{fontSize:13,fontWeight:'900',letterSpacing:.8,color:'#173C2C'},
  sub:{marginTop:1,fontSize:10,color:'#6E7C74'},
  fallback:{fontSize:8,fontWeight:'900',letterSpacing:.6,color:'#7B6A2D'},
  card:{borderRadius:16,borderWidth:1,borderColor:'#DDE7E1',backgroundColor:'#FFFFFF',padding:13},
  titleRow:{flexDirection:'row',alignItems:'center',gap:7},
  title:{flex:1,fontSize:13,fontWeight:'900',color:'#173C2C'},
  real:{fontSize:7,fontWeight:'900',letterSpacing:.5,color:'#21704A'},
  body:{marginTop:7,fontSize:13,lineHeight:19,color:'#43554B'},
  options:{marginTop:10,flexDirection:'row',flexWrap:'wrap',gap:7},
  option:{minHeight:34,justifyContent:'center',paddingHorizontal:11,borderRadius:10,borderWidth:1,borderColor:'#CFE0D6',backgroundColor:'#F8FBF9'},
  optionOn:{backgroundColor:'#E4F3EA',borderColor:'#76A98D'},
  optionText:{fontSize:11,fontWeight:'800',color:'#365648'},
  optionTextOn:{color:'#145D3A'},
});
