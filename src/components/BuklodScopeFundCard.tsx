import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { formatMinorPhp } from '@/lib/buklodCommunityContributionEconomy';

type Fund = {
  scope_id: string;
  fund_source: string;
  available_fund_minor: number;
  reserved_fund_minor: number;
  spent_fund_minor: number;
  manual_received_minor: number;
  buklod_allocation_received_minor: number;
  registered_gcash: {name:string; mobile:string} | null;
  can_review: boolean;
};
type Props = {scopeId:string; scopeName:string};
const money = (v:number | null | undefined) => typeof v === 'number' && Number.isFinite(v)
  ? formatMinorPhp(v) : 'Unavailable';

export default function BuklodScopeFundCard({scopeId,scopeName}:Props) {
  const [fund,setFund]=useState<Fund | null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  const generation=useRef(0);

  const reload=useCallback(async()=>{
    const current=++generation.current;
    setLoading(true);
    try {
      const {data,error:rpcError}=await (supabase as any).rpc(
        'get_buklod_scope_gcash_fund_dashboard_v1',{p_scope_id:scopeId});
      if(rpcError) throw rpcError;
      if(data?.scope_id!==scopeId || data?.fund_source!=='CANONICAL_FUNDED_COMMUNITY_LEDGER') {
        throw new Error('Scope fund could not be verified');
      }
      if(current!==generation.current) return;
      setFund(data as Fund);setError('');
    }catch(e:any){
      if(current!==generation.current)return;
      setFund(null);setError(e?.message || 'Fund currently unavailable');
    }finally{if(current===generation.current)setLoading(false)}
  },[scopeId]);
  useEffect(()=>{
    setFund(null);void reload();
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active')void reload();
    });
    return ()=>{++generation.current;subscription.remove()};
  },[reload,retry]);
  const open=()=>router.push({pathname:'/scope-fund',params:{scopeId}} as any);
  return <View style={s.card} accessibilityLabel="Exact-scope community fund, separate from personal earnings">
    <View style={s.top}>
      <MaterialCommunityIcons name="bank-outline" color="#1B6544" size={22}/>
      <View style={s.flex}>
        <Text style={s.title}>{scopeName} FUND</Text>
        <Text style={s.sub}>Cluster / Organization account only</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh scope fund"
        onPress={()=>setRetry(v=>v+1)} style={s.refresh}>
        <MaterialCommunityIcons name="refresh" color="#1B6544" size={21}/>
      </Pressable>
    </View>
    {loading && !fund ? <Text style={s.note}>Loading verified fund records…</Text> : null}
    {error ? <Text style={s.warning}>{error} · Retry refresh.</Text> : null}
    {fund ? <>
      <View style={s.total}>
        <Text style={s.caption}>AVAILABLE VERIFIED FUND</Text>
        <Text style={s.amount}>{money(fund.available_fund_minor)}</Text>
        <View style={s.row}>
          <View style={s.flex}><Text style={s.caption}>Reserved</Text><Text style={s.metric}>{money(fund.reserved_fund_minor)}</Text></View>
          <View style={s.flex}><Text style={s.caption}>Spent (history)</Text><Text style={s.metric}>{money(fund.spent_fund_minor)}</Text></View>
        </View>
      </View>
      <View style={s.row}>
        <View style={s.flex}><Text style={s.caption}>BUKLOD funded allocations</Text><Text style={s.metric}>{money(fund.buklod_allocation_received_minor)}</Text></View>
        <View style={s.flex}><Text style={s.caption}>Verified manual GCash received</Text><Text style={s.metric}>{money(fund.manual_received_minor)}</Text></View>
      </View>
      {fund.registered_gcash
        ? <Text style={s.note}>Registered GCash: {fund.registered_gcash.name} · {fund.registered_gcash.mobile}</Text>
        : <Text style={s.warning}>No active registered GCash receiver. Manual contribution reporting is unavailable.</Text>}
    </> : null}
    <View style={s.row}>
      <Pressable accessibilityRole="button" onPress={open} disabled={!fund}
        style={[s.button, !fund && s.disabled]}>
        <Text style={s.buttonText}>CONTRIBUTE / REPORT</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={open} disabled={!fund}
        style={[s.button,s.outline,!fund && s.disabled]}>
        <Text style={s.outlineText}>FUND RECORDS</Text>
      </Pressable>
    </View>
    <Text style={s.note}>Reports do not increase the balance until independently verified. The fund is not a personal withdrawal wallet.</Text>
  </View>;
}
const s=StyleSheet.create({
  card:{borderRadius:17,backgroundColor:'#FFFFFF',borderColor:'#D2E4D9',borderWidth:1,padding:14,gap:12},
  top:{flexDirection:'row',alignItems:'center',gap:10},
  title:{fontSize:16,fontWeight:'900',color:'#174832'},
  sub:{fontSize:12,color:'#5E7067',marginTop:2},
  flex:{flex:1},refresh:{padding:8,backgroundColor:'#E9F6EE',borderRadius:10},
  total:{backgroundColor:'#E8F5ED',padding:14,borderRadius:13,gap:8},
  caption:{color:'#526D5D',fontSize:12,fontWeight:'700'},
  amount:{fontSize:27,color:'#14523A',fontWeight:'900'},
  row:{flexDirection:'row',gap:11},
  metric:{fontSize:17,fontWeight:'900',color:'#16503A',marginTop:3},
  note:{fontSize:12,lineHeight:18,color:'#627369'},
  warning:{fontSize:12,lineHeight:18,color:'#936229'},
  button:{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:13,paddingHorizontal:6,backgroundColor:'#176B49',borderRadius:10,minHeight:48},
  buttonText:{fontSize:11,color:'#FFF',fontWeight:'900',textAlign:'center'},
  outline:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#8BB29C'},
  outlineText:{fontSize:11,color:'#176B49',fontWeight:'900',textAlign:'center'},
  disabled:{opacity:0.5}
});