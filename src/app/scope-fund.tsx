import React, {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {formatMinorPhp} from '@/lib/buklodCommunityContributionEconomy';
import {parseScopeContributionMinor,normalizeScopeGcashReference} from '@/lib/buklodScopeFundAmounts';

type Report = {id:string;amount_minor:number;purpose:string;reference:string;status:string;
 created_at:string;own_report:boolean;submitted_by:string|null;review_note:string|null};
type Dashboard = {scope_id:string;scope_type:string;available_fund_minor:number;reserved_fund_minor:number;
 spent_fund_minor:number;manual_received_minor:number;buklod_allocation_received_minor:number;
 registered_gcash:{name:string;mobile:string}|null;can_review:boolean;reports:Report[]};
const pesos=(minor:number)=>formatMinorPhp(minor);
const stringParam=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]||'':value||'';

export default function BuklodScopeFundScreen() {
  const params=useLocalSearchParams<{scopeId?:string|string[]}>();
  const scopeId=stringParam(params.scopeId);
  const generation=useRef(0);
  const submitLock=useRef(false);
  const [fund,setFund]=useState<Dashboard|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [amount,setAmount]=useState('');
  const [reference,setReference]=useState('');
  const [purpose,setPurpose]=useState<'GENERAL'|'PROJECT'|'EMERGENCY'>('GENERAL');
  const [note,setNote]=useState('');
  const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});

  const load=useCallback(async()=>{
    const n=++generation.current;setLoading(true);
    try{
      if(!scopeId)throw new Error('Receiving scope missing');
      const {data,error:rpcError}=await (supabase as any).rpc(
        'get_buklod_scope_gcash_fund_dashboard_v1',{p_scope_id:scopeId});
      if(rpcError)throw rpcError;
      if(data?.scope_id!==scopeId)throw new Error('Scope mismatch');
      if(n===generation.current){setFund(data as Dashboard);setError('');}
    }catch(e:any){if(n===generation.current){setError(e?.message||'Unable to load fund');setFund(null);}}
    finally{if(n===generation.current)setLoading(false)}
  },[scopeId]);
  useEffect(()=>{
    void load();
    const sub=AppState.addEventListener('change',state=>{if(state==='active')void load()});
    return ()=>{++generation.current;sub.remove()};
  },[load]);

  const submit=async()=>{
    if(submitLock.current)return;
    const minor=parseScopeContributionMinor(amount);
    const ref=normalizeScopeGcashReference(reference);
    if(minor==null){Alert.alert('Amount','Enter a valid amount from ₱1 to ₱1,000,000 (2 decimals maximum).');return;}
    if(!ref){Alert.alert('GCash reference','Enter the actual completed transfer reference (6-80 letters/numbers).');return;}
    if(!fund?.registered_gcash){Alert.alert('Unavailable','This scope has no registered receiving GCash.');return;}
    submitLock.current=true;setBusy(true);
    try{
      const {error:rpcError}=await (supabase as any).rpc(
        'report_buklod_scope_gcash_contribution_v1',
        {p_scope_id:scopeId,p_amount_php:minor/100,p_reference:ref,p_purpose:purpose,p_note:note.trim()||null});
      if(rpcError)throw rpcError;
      setAmount('');setReference('');setNote('');
      Alert.alert('Contribution reported','Pending independent verification against the receiving GCash transaction history. Reporting is not a payment.');
      await load();
    }catch(e:any){Alert.alert('Report not saved',e?.message||'Check the connection and retry.');}
    finally{setBusy(false);submitLock.current=false;}
  };
  const review=async(r:Report,approve:boolean)=>{
    if(submitLock.current)return;
    const reviewNote=(reviewNotes[r.id]||'').trim();
    if(reviewNote.length<12){Alert.alert('Verification evidence','Enter at least 12 characters explaining the GCash transaction match or rejection.');return;}
    Alert.alert(approve?'Confirm verified cash':'Reject report',
      approve?'Confirm this exact reference and amount were independently matched in the receiving GCash account.':'Mark this report as rejected?',
      [{text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>{void (async()=>{
        if(submitLock.current)return;
        submitLock.current=true;setBusy(true);
        try{
          const {error:rpcError}=await (supabase as any).rpc(
            'review_buklod_scope_gcash_contribution_v1',
            {p_report_id:r.id,p_approve:approve,p_review_note:reviewNote});
          if(rpcError)throw rpcError;
          await load();
          Alert.alert('Saved',approve?'Verified local GCash receipt recorded; BUKLOD-funded cash was not increased.':'Contribution report rejected.');
        }catch(e:any){Alert.alert('Review failed',e?.message||'Try again');}
        finally{submitLock.current=false;setBusy(false)}
      })();}}]);
  };
  return <><Stack.Screen options={{title:'Cluster / Organization Fund'}}/>
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Community Fund</Text>
      <Text style={s.helper}>Separate funds for the selected Cluster or Organization. Verified local GCash is held by the receiving scope, not in BUKLOD payout custody.</Text>
      {loading?<ActivityIndicator color="#176B49"/>:null}
      {error?<Text style={s.warning}>{error} · Refresh to retry.</Text>:null}
      <Pressable onPress={()=>void load()} style={s.smallButton}><Text style={s.smallButtonText}>REFRESH FUND</Text></Pressable>
      {fund?<><View style={s.card}>
        <Text style={s.label}>AVAILABLE BUKLOD-FUNDED CASH</Text>
        <Text style={s.total}>{pesos(fund.available_fund_minor)}</Text>
        <View style={s.line}><Text style={s.label}>Reserved</Text><Text style={s.value}>{pesos(fund.reserved_fund_minor)}</Text></View>
        <View style={s.line}><Text style={s.label}>Spent</Text><Text style={s.value}>{pesos(fund.spent_fund_minor)}</Text></View>
        <View style={s.line}><Text style={s.label}>BUKLOD finalized allocation (historical)</Text><Text style={s.value}>{pesos(fund.buklod_allocation_received_minor)}</Text></View>
        <View style={s.line}><Text style={s.label}>Verified local GCash receipts (externally held)</Text><Text style={s.value}>{pesos(fund.manual_received_minor)}</Text></View>
      </View>
      <View style={s.card}>
        <Text style={s.title}>Manual contribution · registered GCash</Text>
        {fund.registered_gcash ? <>
          <Text style={s.helper}>Send money directly to this registered scope receiver, then report the completed transaction below.</Text>
          <Text style={s.receiver}>{fund.registered_gcash.name}</Text>
          <Text style={s.receiver}>{fund.registered_gcash.mobile}</Text>
          <Pressable style={s.smallButton} onPress={()=>void Clipboard.setStringAsync(fund.registered_gcash!.mobile)}>
            <Text style={s.smallButtonText}>COPY REGISTERED GCASH NUMBER</Text>
          </Pressable>
          <Text style={s.label}>AMOUNT (PHP)</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 100.00" style={s.input}/>
          <Text style={s.label}>ACTUAL GCASH TRANSACTION REFERENCE</Text>
          <TextInput value={reference} onChangeText={setReference} autoCapitalize="characters" placeholder="After sending GCash" style={s.input}/>
          <Text style={s.label}>PURPOSE</Text>
          <View style={s.options}>
            {(['GENERAL','PROJECT','EMERGENCY'] as const).map(p=><Pressable key={p} onPress={()=>setPurpose(p)}
              style={[s.option,purpose===p&&s.selected]}><Text style={purpose===p?s.selectedText:s.optionText}>{p}</Text></Pressable>)}
          </View>
          <Text style={s.label}>NOTE (OPTIONAL)</Text>
          <TextInput value={note} onChangeText={setNote} multiline maxLength={240} placeholder="What is this contribution for?" style={[s.input,s.multi]}/>
          <Pressable disabled={busy} style={[s.primary,busy&&s.faded]} onPress={()=>void submit()}>
            <Text style={s.primaryText}>{busy?'SAVING…':'REPORT MY GCASH CONTRIBUTION'}</Text>
          </Pressable>
          <Text style={s.warning}>A report does not transfer money or increase BUKLOD-funded cash. The officer must independently match actual receiving GCash history. Do not send MPIN or OTP.</Text>
        </> : <>
          <Text style={s.warning}>This scope does not have an active registered GCash receiver. Manual contribution reporting is disabled.</Text>
          {fund.can_review?<Pressable style={s.smallButton} onPress={()=>router.push({pathname:'/scope-giving-settings',params:{scopeId}} as any)}>
            <Text style={s.smallButtonText}>SET UP REGISTERED GCASH</Text>
          </Pressable>:null}
        </>}
      </View>
      <View style={s.card}>
        <Text style={s.title}>{fund.can_review?'GCash contribution reports · finance review':'My contribution reports'}</Text>
        <Text style={s.helper}>REPORTED = not verified, VERIFIED = counted in fund, REJECTED = not counted.</Text>
        {fund.reports.length===0?<Text style={s.helper}>No reports yet.</Text>:fund.reports.map(r=><View key={r.id} style={s.report}>
          <View style={s.line}><Text style={s.value}>{pesos(r.amount_minor)}</Text><Text style={r.status==='VERIFIED'?s.good:s.warning}>{r.status}</Text></View>
          <Text style={s.helper}>{r.purpose} · {new Date(r.created_at).toLocaleDateString()}</Text>
          <Text style={s.helper}>GCash ref: {r.reference}</Text>
          {r.review_note?<Text style={s.helper}>Review: {r.review_note}</Text>:null}
          {fund.can_review&&r.status==='REPORTED'&&!r.own_report ? <>
            <TextInput style={[s.input,s.multi]} multiline
              placeholder="Evidence from actual receiver GCash history / rejection reason"
              value={reviewNotes[r.id]||''} onChangeText={t=>setReviewNotes(x=>({...x,[r.id]:t}))}/>
            <View style={s.options}>
              <Pressable disabled={busy} onPress={()=>void review(r,true)} style={[s.option,s.selected]}>
                <Text style={s.selectedText}>VERIFY MATCH</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={()=>void review(r,false)} style={s.option}>
                <Text style={s.optionText}>REJECT</Text>
              </Pressable>
            </View>
          </> : null}
          {fund.can_review&&r.status==='REPORTED'&&r.own_report
            ? <Text style={s.warning}>Another authorized reviewer must verify your own report.</Text>:null}
        </View>)}
      </View></>:null}
    </ScrollView>
  </>;
}
const s=StyleSheet.create({
  page:{backgroundColor:'#F3F8F5',padding:15,paddingBottom:64,gap:14},
  heading:{color:'#164B35',fontSize:24,fontWeight:'900'},
  helper:{color:'#63766A',fontSize:13,lineHeight:19},
  card:{backgroundColor:'#FFF',borderRadius:16,padding:15,gap:11,borderWidth:1,borderColor:'#D9E7DF'},
  label:{fontSize:12,fontWeight:'800',color:'#496553'},
  title:{fontSize:17,fontWeight:'900',color:'#19543B'},
  total:{fontSize:29,fontWeight:'900',color:'#145B3D'},
  line:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},
  value:{fontSize:14,fontWeight:'800',color:'#194B37',flexShrink:1},
  receiver:{fontSize:19,fontWeight:'900',color:'#174C38'},
  input:{fontSize:16,minHeight:49,borderColor:'#C8DACE',borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:8,color:'#1C3E2D'},
  multi:{minHeight:70,textAlignVertical:'top'},
  options:{flexDirection:'row',gap:7,flexWrap:'wrap'},
  option:{borderRadius:9,padding:11,borderWidth:1,borderColor:'#97BBA5',backgroundColor:'#F8FBF9'},
  selected:{backgroundColor:'#176B49',borderColor:'#176B49'},
  selectedText:{color:'#FFF',fontSize:12,fontWeight:'900'},
  optionText:{color:'#176B49',fontSize:12,fontWeight:'900'},
  primary:{backgroundColor:'#176B49',borderRadius:11,alignItems:'center',padding:15,minHeight:51},
  primaryText:{color:'#FFF',fontWeight:'900',fontSize:13,textAlign:'center'},
  smallButton:{alignSelf:'flex-start',padding:11,borderRadius:10,backgroundColor:'#E2F2E8'},
  smallButtonText:{color:'#1B6443',fontWeight:'900',fontSize:12},
  warning:{fontSize:12,lineHeight:18,color:'#8D602A'},
  good:{color:'#0E7B50',fontSize:12,fontWeight:'900'},
  report:{gap:8,borderTopWidth:1,borderColor:'#E6EEE9',paddingTop:10},
  faded:{opacity:0.6}
});