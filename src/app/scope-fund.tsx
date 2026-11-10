import React, {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {formatMinorPhp} from '@/lib/buklodCommunityContributionEconomy';
import {parseScopeContributionMinor,normalizeScopeGcashReference} from '@/lib/buklodScopeFundAmounts';

type Report = {id:string;amount_minor:number;purpose:string;reference:string;status:string;
 created_at:string;own_report:boolean;submitted_by:string|null;review_note:string|null};
type BankReport = {id:string;amount_minor:number;purpose:string;reference:string;status:string;created_at:string;own_report:boolean;review_note:string|null};
type BankDashboard = {scope_id:string;registered_bank:{name:string;holder:string;number:string}|null;can_review:boolean;can_manage_receiver:boolean;manual_received_minor:number;reports:BankReport[]};
type Dashboard = {scope_id:string;scope_type:string;available_fund_minor:number;reserved_fund_minor:number;
 spent_fund_minor:number;manual_received_minor:number;buklod_allocation_received_minor:number;
 registered_gcash:{name:string;mobile:string}|null;can_review:boolean;reports:Report[]};
const pesos=(minor:number)=>formatMinorPhp(minor);
const stringParam=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]||'':value||'';

export function BuklodScopeFundScreen({mode='fund'}:{mode?:'fund'|'contribute'|'reports'}) {
  const params=useLocalSearchParams<{scopeId?:string|string[]}>();
  const scopeId=stringParam(params.scopeId);
  const generation=useRef(0);
  const submitLock=useRef(false);
  const [fund,setFund]=useState<Dashboard|null>(null);
  const [bank,setBank]=useState<BankDashboard|null>(null);
  const [bankAmount,setBankAmount]=useState('');
  const [bankReference,setBankReference]=useState('');
  const [bankNote,setBankNote]=useState('');
  const [bankPurpose,setBankPurpose]=useState<'GENERAL'|'PROJECT'|'EMERGENCY'>('GENERAL');
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
      if(mode!=='fund'){
        const {data:bankData,error:bankError}=await (supabase as any).rpc(
          'buklod_scope_bank_dashboard_v1',{p_scope_id:scopeId});
        // Bank receiver is additive. An unapplied migration must not break existing GCash.
        if(n===generation.current)setBank(!bankError&&bankData?.scope_id===scopeId?bankData as BankDashboard:null);
      }
    }catch(e:any){if(n===generation.current){setError(e?.message||'Unable to load fund');setFund(null);setBank(null);}}
    finally{if(n===generation.current)setLoading(false)}
  },[scopeId,mode]);
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
  const submitBank=async()=>{
    if(submitLock.current)return;
    const minor=parseScopeContributionMinor(bankAmount);
    const ref=normalizeScopeGcashReference(bankReference);
    if(minor===null||!ref){Alert.alert('Bank report','Enter a valid amount and the completed bank transaction reference.');return;}
    if(!bank?.registered_bank){Alert.alert('No bank receiver','This scope has no admin-authorized bank account.');return;}
    submitLock.current=true;setBusy(true);
    try{
      const {error:reportError}=await (supabase as any).rpc('buklod_scope_bank_report_v1',{
        p_scope_id:scopeId,p_amount_php:minor/100,p_reference:ref,p_purpose:bankPurpose,p_note:bankNote.trim()||null
      });
      if(reportError)throw reportError;
      setBankAmount('');setBankReference('');setBankNote('');
      await load();
      Alert.alert('Bank contribution reported','Pending independent verification using the receiving bank transaction history. This report did not transfer money.');
    }catch(e:any){Alert.alert('Bank report not saved',e?.message||'Please try again.');}
    finally{submitLock.current=false;setBusy(false);}
  };
  const reviewBank=async(r:BankReport,approve:boolean)=>{
    if(submitLock.current)return;
    const noteText=(reviewNotes['bank:'+r.id]||'').trim();
    if(noteText.length<12){Alert.alert('Verification evidence','Enter at least 12 characters documenting the actual bank transaction match or rejection.');return;}
    Alert.alert(approve?'Verify bank receipt':'Reject bank report','Confirm against the exact authorized receiving bank statement.',[
      {text:'Cancel',style:'cancel'},
      {text:'Confirm',onPress:()=>{void (async()=>{
        if(submitLock.current)return;
        submitLock.current=true;setBusy(true);
        try{
          const {error:reviewError}=await (supabase as any).rpc('buklod_scope_bank_review_v1',{
            p_report_id:r.id,p_approve:approve,p_review_note:noteText
          });
          if(reviewError)throw reviewError;
          await load();
          Alert.alert('Saved',approve?'Verified external bank receipt recorded. BUKLOD cash balance unchanged.':'Report rejected.');
        }catch(e:any){Alert.alert('Review failed',e?.message||'Try again.');}
        finally{submitLock.current=false;setBusy(false);}
      })();}}
    ]);
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
  const openGcash=async()=>{
    const registered=fund?.registered_gcash;
    if(!registered)return;
    try {
      // Confirm that the receiver is still authorized immediately before handoff.
      const {data:fresh,error:freshError}=await (supabase as any).rpc(
        'get_buklod_scope_gcash_fund_dashboard_v1',{p_scope_id:scopeId});
      if(freshError||fresh?.scope_id!==scopeId||
        fresh?.registered_gcash?.mobile!==registered.mobile||
        fresh?.registered_gcash?.name!==registered.name){
        Alert.alert('Receiver changed or not verified','Refresh this scope before sending. Do not use a cached account.');
        return;
      }
      await Clipboard.setStringAsync(registered.mobile);
      await Linking.openURL('gcash://');
    } catch {
      Alert.alert('GCash number copied','Open GCash > Send > Express Send. Paste the authorized recipient number, verify the name, then confirm the amount. BUKLOD does not send money.');
    }
  };
  const openReports=()=>router.push({pathname:'/scope-contribution-reports',params:{scopeId}} as any);
  return <><Stack.Screen options={{title:mode==='fund'?'Community Fund':mode==='contribute'?'Contribute':'Contribution Reports'}}/>
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>{mode==='fund'?'Community Fund':mode==='contribute'?'Contribute to this Community':'Contribution Reports'}</Text>
      <Text style={s.helper}>Separate funds for the selected Cluster or Organization. Verified local GCash is held by the receiving scope, not in BUKLOD payout custody.</Text>
      {loading?<ActivityIndicator color="#176B49"/>:null}
      {error?<Text style={s.warning}>{error} · Refresh to retry.</Text>:null}
      <Pressable onPress={()=>void load()} style={s.smallButton}><Text style={s.smallButtonText}>REFRESH FUND</Text></Pressable>
      {fund?<>{mode==='fund'?<View style={s.card}>
        <Text style={s.label}>AVAILABLE BUKLOD-FUNDED CASH</Text>
        <Text style={s.total}>{pesos(fund.available_fund_minor)}</Text>
        <View style={s.line}><Text style={s.label}>Reserved</Text><Text style={s.value}>{pesos(fund.reserved_fund_minor)}</Text></View>
        <View style={s.line}><Text style={s.label}>Spent</Text><Text style={s.value}>{pesos(fund.spent_fund_minor)}</Text></View>
        <View style={s.line}><Text style={s.label}>BUKLOD finalized allocation (historical)</Text><Text style={s.value}>{pesos(fund.buklod_allocation_received_minor)}</Text></View>
        <View style={s.line}><Text style={s.label}>Verified local GCash receipts (externally held)</Text><Text style={s.value}>{pesos(fund.manual_received_minor)}</Text></View>
      </View>:null}
      {mode==='contribute'||mode==='reports'?<View style={s.card}>
        <Text style={s.title}>{mode==='contribute'?'Send to registered GCash':'Report a completed GCash transfer'}</Text>
        {fund.registered_gcash ? <>
          <Text style={s.helper}>Send money directly to this registered scope receiver, then report the completed transaction below.</Text>
          <Text style={s.receiver}>{fund.registered_gcash.name}</Text>
          <Text style={s.receiver}>{fund.registered_gcash.mobile}</Text>
          <Pressable style={s.smallButton} onPress={()=>void Clipboard.setStringAsync(fund.registered_gcash!.mobile)}>
            <Text style={s.smallButtonText}>COPY REGISTERED GCASH NUMBER</Text>
          </Pressable>
          {mode==='contribute'?<>
            <Pressable style={s.primary} onPress={()=>void openGcash()}><Text style={s.primaryText}>OPEN GCASH · COPY NUMBER FIRST</Text></Pressable>
            <Text style={s.helper}>Use GCash Send → Express Send; paste the copied receiver number, check recipient name and amount. Opening the app is not a payment.</Text>
            <Pressable style={s.smallButton} onPress={openReports}><Text style={s.smallButtonText}>ALREADY SENT? REPORT THE TRANSFER</Text></Pressable>
          </>:<>
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
          </>}
        </> : <>
          <Text style={s.warning}>This scope does not have an active registered GCash receiver. Manual contribution reporting is disabled.</Text>
          {fund.can_review?<Pressable style={s.smallButton} onPress={()=>router.push({pathname:'/scope-giving-settings',params:{scopeId}} as any)}>
            <Text style={s.smallButtonText}>SET UP REGISTERED GCASH</Text>
          </Pressable>:null}
        </>}
      </View>:null}
      {mode==='contribute'?<View style={s.card}>
        <Text style={s.title}>Bank transfer · authorized account</Text>
        {bank?.registered_bank?<View style={{gap:10}}>
          <Text style={s.label}>BANK</Text><Text style={s.receiver}>{bank.registered_bank.name}</Text>
          <Text style={s.label}>ACCOUNT HOLDER</Text><Text style={s.value}>{bank.registered_bank.holder}</Text>
          <Text style={s.label}>ACCOUNT NUMBER</Text><Text selectable style={s.receiver}>{bank.registered_bank.number}</Text>
          <Pressable style={s.smallButton} onPress={()=>void (async()=>{
            const receiver=bank.registered_bank;
            if(!receiver)return;
            try{
              const {data:fresh,error:freshError}=await (supabase as any).rpc('buklod_scope_bank_dashboard_v1',{p_scope_id:scopeId});
              if(freshError||fresh?.scope_id!==scopeId||fresh?.registered_bank?.number!==receiver.number||
                fresh?.registered_bank?.name!==receiver.name||fresh?.registered_bank?.holder!==receiver.holder){
                Alert.alert('Receiver changed or not verified','Refresh before sending. The bank account must still be authorized.');
                return;
              }
              await Clipboard.setStringAsync(receiver.number);
              Alert.alert('Account copied','Verify the bank and recipient name in your banking app before sending.');
            }catch{Alert.alert('Verification unavailable','Unable to verify the current authorized bank account. Try again online.');}
          })()}><Text style={s.smallButtonText}>VERIFY & COPY AUTHORIZED BANK ACCOUNT</Text></Pressable>
          <Text style={s.helper}>Open your banking app manually. Verify the registered bank and account name before sending. No automatic transfer or universal bank app deep link is available.</Text>
          <Pressable style={s.smallButton} onPress={openReports}><Text style={s.smallButtonText}>ALREADY TRANSFERRED? REPORT BANK PAYMENT</Text></Pressable>
        </View>:<Text style={s.warning}>No active authorized bank account for this scope. Ask the scope admin to register one.</Text>}
        {bank?.can_manage_receiver?<Pressable style={s.smallButton} onPress={()=>router.push({pathname:'/scope-giving-settings',params:{scopeId}} as any)}>
          <Text style={s.smallButtonText}>ADMIN · MANAGE BANK ACCOUNT / TREASURERS</Text></Pressable>:null}
      </View>:null}
      {mode==='reports'?<View style={s.card}>
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
      </View>:null}
      {mode==='reports'?<View style={s.card}>
        <Text style={s.title}>Bank transfer report</Text>
        {bank?.registered_bank?<View style={{gap:10}}>
          <Text style={s.helper}>Authorized bank: {bank.registered_bank.name} · {bank.registered_bank.holder} · {bank.registered_bank.number}</Text>
          <Text style={s.label}>AMOUNT (PHP)</Text>
          <TextInput value={bankAmount} onChangeText={setBankAmount} keyboardType="decimal-pad" placeholder="e.g. 100.00" style={s.input}/>
          <Text style={s.label}>ACTUAL COMPLETED BANK REFERENCE</Text>
          <TextInput value={bankReference} onChangeText={setBankReference} autoCapitalize="characters" placeholder="From your bank transaction receipt" style={s.input}/>
          <Text style={s.label}>PURPOSE</Text>
          <View style={s.options}>{(['GENERAL','PROJECT','EMERGENCY'] as const).map(p=><Pressable key={p} onPress={()=>setBankPurpose(p)} style={[s.option,bankPurpose===p&&s.selected]}><Text style={bankPurpose===p?s.selectedText:s.optionText}>{p}</Text></Pressable>)}</View>
          <TextInput value={bankNote} onChangeText={setBankNote} maxLength={240} placeholder="Optional description" style={s.input}/>
          <Pressable disabled={busy} style={[s.primary,busy&&s.faded]} onPress={()=>void submitBank()}><Text style={s.primaryText}>{busy?'SAVING…':'REPORT COMPLETED BANK TRANSFER'}</Text></Pressable>
        </View>:<Text style={s.warning}>Bank reporting unavailable until an authorized receiver is registered.</Text>}
        <Text style={s.warning}>No automatic money movement or cash credit; actual bank receipt must be verified by independent authorized finance personnel.</Text>
      </View>:null}
      {mode==='reports'?<View style={s.card}>
        <Text style={s.title}>{bank?.can_review?'Bank contribution reports · finance review':'My bank reports'}</Text>
        {bank?.reports?.length?bank.reports.map(r=><View key={r.id} style={s.report}>
          <View style={s.line}><Text style={s.value}>{pesos(r.amount_minor)}</Text><Text style={r.status==='VERIFIED'?s.good:s.warning}>{r.status}</Text></View>
          <Text style={s.helper}>Bank reference: {r.reference} · {new Date(r.created_at).toLocaleDateString()}</Text>
          {r.review_note?<Text style={s.helper}>Review: {r.review_note}</Text>:null}
          {bank.can_review&&r.status==='REPORTED'&&!r.own_report?<View style={{gap:9}}>
            <TextInput multiline style={[s.input,s.multi]} placeholder="Actual bank statement evidence / rejection reason" value={reviewNotes['bank:'+r.id]||''} onChangeText={v=>setReviewNotes(x=>({...x,['bank:'+r.id]:v}))}/>
            <View style={s.options}><Pressable disabled={busy} style={[s.option,s.selected]} onPress={()=>void reviewBank(r,true)}><Text style={s.selectedText}>VERIFY MATCH</Text></Pressable>
              <Pressable disabled={busy} style={s.option} onPress={()=>void reviewBank(r,false)}><Text style={s.optionText}>REJECT</Text></Pressable></View>
          </View>:null}
          {bank.can_review&&r.status==='REPORTED'&&r.own_report?<Text style={s.warning}>Independent treasurer/admin review required.</Text>:null}
        </View>):<Text style={s.helper}>No bank reports available for this scope.</Text>}
      </View>:null}</>:null}
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