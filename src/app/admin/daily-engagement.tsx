import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

const ALL_CATEGORIES=[
  'family','food','work','school','hobbies','relationships','pets','local_life',
  'practical_life','aspirations','entertainment','community','light_humor','wellness','learning',
] as const;

type Item={
  id:string;
  publish_date:string;
  slot:number;
  item_type:string;
  title:string;
  body:string;
  options:any[];
  category:string;
  source_kind:string;
  status:string;
};

type Config={
  enabled:boolean;
  ai_enabled:boolean;
  cards_per_day:number;
  categories:string[];
  min_trending_signal:number;
  generation_frequency:'DAILY'|'WEEKDAYS'|'MANUAL';
};

type Payload={
  config:Config;
  today:Item[];
  recent:Item[];
};

function todayManila(){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Manila',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).format(new Date());
}

export default function AdminDailyEngagementScreen(){
  const [data,setData]=useState<Payload|null>(null);
  const [busy,setBusy]=useState(false);
  const [editing,setEditing]=useState<Item|null>(null);
  const [manualDate,setManualDate]=useState(todayManila());
  const [manualSlot,setManualSlot]=useState('1');
  const [manualType,setManualType]=useState('MANUAL');
  const [manualCategory,setManualCategory]=useState('community');
  const [manualTitle,setManualTitle]=useState('');
  const [manualBody,setManualBody]=useState('');

  const load=useCallback(async()=>{
    setBusy(true);
    try{
      const {data:payload,error}=await (supabase as any).rpc(
        'admin_get_buklod_daily_engagement_v1'
      );
      if(error)throw error;
      setData(payload as Payload);
    }catch(error:any){
      Alert.alert(
        'Daily Engagement',
        String(error?.message??error??'Could not load.'),
      );
    }finally{
      setBusy(false);
    }
  },[]);

  useEffect(()=>{void load()},[load]);

  const saveConfig=async(patch:Partial<Config>)=>{
    if(!data)return;
    const next={...data.config,...patch};
    setBusy(true);
    try{
      const {error}=await (supabase as any).rpc(
        'admin_set_buklod_daily_engagement_config_v1',
        {
          p_enabled:next.enabled,
          p_ai_enabled:next.ai_enabled,
          p_cards_per_day:next.cards_per_day,
          p_categories:next.categories,
          p_min_trending_signal:next.min_trending_signal,
          p_generation_frequency:next.generation_frequency,
        }
      );
      if(error)throw error;
      await load();
    }catch(error:any){
      Alert.alert(
        'Daily Engagement',
        String(error?.message??error??'Could not save config.'),
      );
      setBusy(false);
    }
  };

  const upsert=async(item:Item)=>{
    setBusy(true);
    try{
      const {error}=await (supabase as any).rpc(
        'admin_upsert_buklod_daily_engagement_item_v1',
        {
          p_id:item.id||null,
          p_publish_date:item.publish_date,
          p_slot:Number(item.slot),
          p_item_type:item.item_type,
          p_title:item.title.trim(),
          p_body:item.body.trim(),
          p_options:Array.isArray(item.options)?item.options:[],
          p_category:item.category,
          p_status:item.status,
        }
      );
      if(error)throw error;
      setEditing(null);
      await load();
    }catch(error:any){
      Alert.alert(
        'Daily Engagement',
        String(error?.message??error??'Could not save item.'),
      );
      setBusy(false);
    }
  };

  const regenerate=async()=>{
    setBusy(true);
    try{
      const {error}=await (supabase as any).rpc(
        'admin_regenerate_buklod_daily_engagement_v1'
      );
      if(error)throw error;
      Alert.alert(
        'BUKLOD Today',
        'Today’s AI items were disabled and are ready for one controlled regeneration.',
      );
      await load();
    }catch(error:any){
      Alert.alert(
        'Daily Engagement',
        String(error?.message??error??'Could not regenerate.'),
      );
      setBusy(false);
    }
  };

  const scheduleManual=async()=>{
    if(!manualTitle.trim()||!manualBody.trim()){
      return Alert.alert('Manual card','Title and body are required.');
    }
    await upsert({
      id:'',
      publish_date:manualDate.trim(),
      slot:Math.max(1,Math.min(8,Number(manualSlot)||1)),
      item_type:manualType,
      title:manualTitle,
      body:manualBody,
      options:[],
      category:manualCategory,
      source_kind:'MANUAL',
      status:'ACTIVE',
    });
    setManualTitle('');
    setManualBody('');
  };

  const cfg=data?.config;
  const selectedCategories=useMemo(
    ()=>new Set(cfg?.categories??[]),
    [cfg?.categories],
  );

  return (
    <AdminGate>
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <View style={s.hero}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={26}
            color="#275D45"
          />
          <View style={{flex:1}}>
            <Text style={s.eyebrow}>COMMUNITY WALL</Text>
            <Text style={s.h1}>BUKLOD Today AI Control</Text>
            <Text style={s.muted}>
              One shared low-cost daily batch. Generic engagement only;
              real announcements and trends stay grounded in real data.
            </Text>
          </View>
        </View>

        {busy&&!data?<ActivityIndicator color="#275D45"/>:null}

        {cfg?(
          <>
            <View style={s.card}>
              <Text style={s.h2}>Generation controls</Text>
              <View style={s.row}>
                <Toggle
                  label="Daily layer"
                  value={cfg.enabled}
                  onPress={()=>void saveConfig({enabled:!cfg.enabled})}
                />
                <Toggle
                  label="AI generation"
                  value={cfg.ai_enabled}
                  onPress={()=>void saveConfig({ai_enabled:!cfg.ai_enabled})}
                />
              </View>

              <Text style={s.label}>Frequency</Text>
              <View style={s.chips}>
                {(['DAILY','WEEKDAYS','MANUAL'] as const).map(value=>(
                  <Pressable
                    key={value}
                    onPress={()=>void saveConfig({generation_frequency:value})}
                    style={[
                      s.chip,
                      cfg.generation_frequency===value&&s.chipOn,
                    ]}
                  >
                    <Text
                      style={[
                        s.chipText,
                        cfg.generation_frequency===value&&s.chipTextOn,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.label}>
                Cards per batch: {cfg.cards_per_day}
              </Text>
              <View style={s.row}>
                <SmallButton
                  title="−"
                  onPress={()=>void saveConfig({
                    cards_per_day:Math.max(1,cfg.cards_per_day-1),
                  })}
                />
                <SmallButton
                  title="+"
                  onPress={()=>void saveConfig({
                    cards_per_day:Math.min(5,cfg.cards_per_day+1),
                  })}
                />
                <SmallButton
                  title="REGENERATE TODAY"
                  onPress={()=>void regenerate()}
                />
              </View>

              <Text style={s.label}>Categories</Text>
              <View style={s.chips}>
                {ALL_CATEGORIES.map(category=>{
                  const on=selectedCategories.has(category);
                  return (
                    <Pressable
                      key={category}
                      onPress={()=>{
                        const next=on
                          ? (cfg.categories??[]).filter(x=>x!==category)
                          : [...(cfg.categories??[]),category];
                        if(next.length){
                          void saveConfig({categories:next});
                        }
                      }}
                      style={[s.chip,on&&s.chipOn]}
                    >
                      <Text style={[s.chipText,on&&s.chipTextOn]}>
                        {category.replaceAll('_',' ')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.h2}>Today preview</Text>
              {(data?.today??[]).length
                ? data!.today.map(item=>(
                    <View key={item.id} style={s.item}>
                      <Text style={s.itemTitle}>
                        {item.slot}. {item.title}
                      </Text>
                      <Text style={s.muted}>
                        {item.item_type} · {item.category} · {item.source_kind} · {item.status}
                      </Text>
                      <Text style={s.body}>{item.body}</Text>
                      <View style={s.row}>
                        <SmallButton
                          title="EDIT / REPLACE"
                          onPress={()=>setEditing({...item})}
                        />
                        <SmallButton
                          title={item.status==='ACTIVE'?'DISABLE':'ENABLE'}
                          onPress={()=>void upsert({
                            ...item,
                            status:item.status==='ACTIVE'?'DISABLED':'ACTIVE',
                          })}
                        />
                      </View>
                    </View>
                  ))
                : (
                    <Text style={s.muted}>
                      No generated items for today yet. The Wall will use its curated fallback.
                    </Text>
                  )}
            </View>

            {editing?(
              <View style={s.card}>
                <Text style={s.h2}>Replace / edit item</Text>
                <TextInput
                  style={s.input}
                  value={editing.title}
                  onChangeText={title=>setEditing({...editing,title})}
                  placeholder="Title"
                />
                <TextInput
                  style={[s.input,s.area]}
                  multiline
                  value={editing.body}
                  onChangeText={body=>setEditing({...editing,body})}
                  placeholder="Body"
                />
                <TextInput
                  style={s.input}
                  value={editing.category}
                  onChangeText={category=>setEditing({
                    ...editing,
                    category:category.trim().toLowerCase(),
                  })}
                  placeholder="Category"
                />
                <View style={s.row}>
                  <SmallButton
                    title="SAVE"
                    onPress={()=>void upsert(editing)}
                  />
                  <SmallButton
                    title="CANCEL"
                    onPress={()=>setEditing(null)}
                  />
                </View>
              </View>
            ):null}

            <View style={s.card}>
              <Text style={s.h2}>Schedule manual card</Text>
              <TextInput
                style={s.input}
                value={manualDate}
                onChangeText={setManualDate}
                placeholder="YYYY-MM-DD"
              />
              <View style={s.row}>
                <TextInput
                  style={[s.input,{flex:1}]}
                  value={manualSlot}
                  onChangeText={setManualSlot}
                  keyboardType="number-pad"
                  placeholder="Slot"
                />
                <TextInput
                  style={[s.input,{flex:2}]}
                  value={manualCategory}
                  onChangeText={v=>setManualCategory(v.trim().toLowerCase())}
                  placeholder="Category"
                />
              </View>
              <TextInput
                style={s.input}
                value={manualType}
                onChangeText={v=>setManualType(v.trim().toUpperCase())}
                placeholder="MANUAL"
              />
              <TextInput
                style={s.input}
                value={manualTitle}
                onChangeText={setManualTitle}
                placeholder="Title"
              />
              <TextInput
                style={[s.input,s.area]}
                multiline
                value={manualBody}
                onChangeText={setManualBody}
                placeholder="Body"
              />
              <SmallButton
                title="SCHEDULE / SAVE"
                onPress={()=>void scheduleManual()}
              />
            </View>
          </>
        ):null}
      </ScrollView>
    </AdminGate>
  );
}

function Toggle({
  label,
  value,
  onPress,
}:{
  label:string;
  value:boolean;
  onPress:()=>void;
}){
  return (
    <Pressable
      onPress={onPress}
      style={[s.toggle,value&&s.toggleOn]}
    >
      <Text style={[s.toggleText,value&&s.toggleTextOn]}>
        {label}: {value?'ON':'OFF'}
      </Text>
    </Pressable>
  );
}

function SmallButton({
  title,
  onPress,
}:{
  title:string;
  onPress:()=>void;
}){
  return (
    <Pressable onPress={onPress} style={s.button}>
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F5F8F6'},
  content:{padding:14,paddingBottom:100,gap:12},
  hero:{flexDirection:'row',gap:10,alignItems:'flex-start',padding:14,borderRadius:16,backgroundColor:'#EAF3ED'},
  eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.3,color:'#668073'},
  h1:{fontSize:21,fontWeight:'900',color:'#1D3328'},
  h2:{fontSize:14,fontWeight:'900',color:'#1D3328'},
  muted:{fontSize:10.5,lineHeight:15,color:'#68776F'},
  body:{fontSize:12,lineHeight:18,color:'#33483D'},
  card:{padding:13,borderRadius:15,borderWidth:1,borderColor:'#DBE6DF',backgroundColor:'#FFF',gap:9},
  row:{flexDirection:'row',gap:7,alignItems:'center',flexWrap:'wrap'},
  label:{fontSize:10,fontWeight:'900',color:'#4E6257'},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:6},
  chip:{paddingHorizontal:9,paddingVertical:6,borderRadius:999,borderWidth:1,borderColor:'#D6E2DA'},
  chipOn:{backgroundColor:'#275D45',borderColor:'#275D45'},
  chipText:{fontSize:8.5,fontWeight:'800',color:'#496055',textTransform:'capitalize'},
  chipTextOn:{color:'#FFF'},
  toggle:{paddingHorizontal:10,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:'#D6E2DA'},
  toggleOn:{backgroundColor:'#E2F2E8',borderColor:'#75A98C'},
  toggleText:{fontSize:9,fontWeight:'900',color:'#65736C'},
  toggleTextOn:{color:'#1B5B3D'},
  item:{padding:10,borderRadius:11,backgroundColor:'#F8FAF9',gap:5},
  itemTitle:{fontSize:11.5,fontWeight:'900',color:'#1D3328'},
  input:{minHeight:42,borderWidth:1,borderColor:'#D6E2DA',borderRadius:10,paddingHorizontal:10,backgroundColor:'#FFF',fontSize:11,color:'#24382D'},
  area:{minHeight:88,textAlignVertical:'top',paddingTop:10},
  button:{minHeight:36,paddingHorizontal:11,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#275D45'},
  buttonText:{fontSize:8.5,fontWeight:'900',color:'#FFF'},
});
