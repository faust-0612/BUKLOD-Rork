import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

type TreasurerMember = {id:string;name:string};
type TreasurerAssignment = {id:string;active:boolean};
type BankReceiver = {name:string;holder:string;number:string};
type ScopeReceiver = {
  scope_id: string;
  scope_name: string;
  scope_kind: string;
  parent_name: string | null;
  gcash_name: string;
  gcash_mobile: string;
  gcash_payment_url: string | null;
  active: boolean;
};

function normalizeMobile(value: string) {
  let digits = value.replace(/\D/g, '');

  if (digits.startsWith('63') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  }

  return digits;
}

export default function ScopeGivingSettingsScreen() {
  const params = useLocalSearchParams<{ scopeId?: string }>();

  const scopeId =
    typeof params.scopeId === 'string'
      ? params.scopeId
      : '';

  const [scope, setScope] = useState<ScopeReceiver | null>(null);
  const [bankReceiver,setBankReceiver]=useState<BankReceiver|null>(null);
  const [bankName,setBankName]=useState('');
  const [bankHolder,setBankHolder]=useState('');
  const [bankAccount,setBankAccount]=useState('');
  const [bankEnabled,setBankEnabled]=useState(true);
  const [canManageBank,setCanManageBank]=useState(false);
  const [members,setMembers]=useState<TreasurerMember[]>([]);
  const [assigned,setAssigned]=useState<TreasurerAssignment[]>([]);
  const [treasurerBusy,setTreasurerBusy]=useState<string|null>(null);
  const [gcashName, setGcashName] = useState('');
  const [gcashMobile, setGcashMobile] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!scopeId) return;

    setBusy(true);

    try {
      const { data, error } = await supabase.rpc(
        'giving_get_receiver_admin_scope',
        { p_scope_id: scopeId },
      );

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        throw new Error(
          'You do not have permission to manage Giving for this scope.',
        );
      }

      const receiver = row as ScopeReceiver;

      setScope(receiver);
      setGcashName(receiver.gcash_name || '');
      setGcashMobile(receiver.gcash_mobile || '');
      setPaymentUrl(receiver.gcash_payment_url || '');
      setActive(receiver.active !== false);
      // Additive bank module and treasurer picker: absent DEV migration is fail-closed.
      const [bankRpc,treasurerRpc]=await Promise.all([
        (supabase as any).rpc('buklod_scope_bank_dashboard_v1',{p_scope_id:scopeId}),
        (supabase as any).rpc('buklod_scope_treasurer_candidates_v1',{p_scope_id:scopeId})
      ]);
      if(!bankRpc.error&&bankRpc.data?.scope_id===scopeId){
        const bank=bankRpc.data.registered_bank as BankReceiver|null;
        setBankReceiver(bank);
        setBankName(bank?.name||'');setBankHolder(bank?.holder||'');setBankAccount(bank?.number||'');
        setBankEnabled(Boolean(bank));
        setCanManageBank(bankRpc.data.can_manage_receiver===true);
      }else{setCanManageBank(false);setBankReceiver(null);}
      if(!treasurerRpc.error&&treasurerRpc.data?.scope_id===scopeId){
        setMembers(treasurerRpc.data.members||[]);
        setAssigned(treasurerRpc.data.treasurers||[]);
      }else{setMembers([]);setAssigned([]);}
    } catch (error: any) {
      Alert.alert(
        'Giving / GCash Settings',
        error?.message || 'Could not load this scope.',
      );
    } finally {
      setBusy(false);
    }
  }, [scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!scopeId) return;

    const mobile = normalizeMobile(gcashMobile);

    if (!gcashName.trim()) {
      Alert.alert(
        'GCash receiver',
        'Enter the receiving GCash name.',
      );
      return;
    }

    if (!/^09[0-9]{9}$/.test(mobile)) {
      Alert.alert(
        'GCash mobile',
        'Enter a valid 09XXXXXXXXX mobile number.',
      );
      return;
    }

    if (
      paymentUrl.trim() &&
      !/^https:\/\//i.test(paymentUrl.trim())
    ) {
      Alert.alert(
        'Payment URL',
        'Optional payment URL must start with https://',
      );
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.rpc(
        'giving_upsert_scope_receiver',
        {
          p_scope_id: scopeId,
          p_gcash_name: gcashName.trim(),
          p_gcash_mobile: mobile,
          p_gcash_payment_url: paymentUrl.trim() || null,
          p_active: active,
        },
      );

      if (error) throw error;

      Alert.alert(
        'Saved',
        'This scope is now using the saved GCash receiver in BUKLOD Giving.',
      );

      await load();
    } catch (error: any) {
      Alert.alert(
        'Could not save',
        error?.message || 'GCash settings were not saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  const saveBank=async()=>{
    if(!canManageBank)return;
    const name=bankName.trim(),holder=bankHolder.trim(),number=bankAccount.replace(/[\\s-]/g,'');
    if(name.length<2||holder.length<2||!/^[A-Za-z0-9]{6,34}$/.test(number)){
      Alert.alert('Bank account','Enter the authorized bank name, account holder and 6–34 character account number.');return;
    }
    setBusy(true);
    try{
      const {error}=await (supabase as any).rpc('buklod_scope_bank_receiver_save_v1',{
        p_scope_id:scopeId,p_bank_name:name,p_account_name:holder,
        p_account_number:number,p_active:bankEnabled
      });
      if(error)throw error;
      Alert.alert('Bank receiver saved','Members can see this authorized bank account. No money was transferred.');
      await load();
    }catch(e:any){Alert.alert('Not saved',e?.message||'Bank receiver unavailable');}
    finally{setBusy(false);}
  };
  const toggleTreasurer=async(member:TreasurerMember,activate:boolean)=>{
    if(treasurerBusy)return;
    setTreasurerBusy(member.id);
    try{
      const {error}=await (supabase as any).rpc('buklod_scope_treasurer_authorize_v1',{
        p_scope_id:scopeId,p_user_id:member.id,p_active:activate
      });
      if(error)throw error;
      Alert.alert('Treasurer updated',activate?'Authorized for this scope only.':'Treasurer authorization revoked.');
      await load();
    }catch(e:any){Alert.alert('Authorization failed',e?.message||'Try again');}
    finally{setTreasurerBusy(null);}
  };
  return (
    <>
      <Stack.Screen
        options={{ title: 'Giving / GCash Settings' }}
      />

      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <Text style={styles.eyebrow}>EXACT BUKLOD SCOPE</Text>

          <Text style={styles.scopeName}>
            {scope?.scope_name || 'Loading...'}
          </Text>

          <Text style={styles.scopeMeta}>
            {scope?.scope_kind || ''}
            {scope?.parent_name
              ? ' - ' + scope.parent_name
              : ''}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>GCASH RECEIVER NAME</Text>

          <TextInput
            value={gcashName}
            onChangeText={setGcashName}
            placeholder="e.g. MZB Ministry Inc."
            style={styles.input}
          />

          <Text style={styles.label}>GCASH MOBILE</Text>

          <TextInput
            value={gcashMobile}
            onChangeText={setGcashMobile}
            keyboardType="phone-pad"
            placeholder="09XXXXXXXXX"
            style={styles.input}
          />

          <Text style={styles.label}>
            OPTIONAL MERCHANT / PAYMENT URL
          </Text>

          <TextInput
            value={paymentUrl}
            onChangeText={setPaymentUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://..."
            style={styles.input}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ACCEPT GIVING</Text>
              <Text style={styles.help}>
                Turn off to temporarily stop this exact scope from receiving.
              </Text>
            </View>

            <Switch
              value={active}
              onValueChange={setActive}
            />
          </View>

          <Text
            onPress={busy ? undefined : save}
            style={[
              styles.save,
              busy && styles.disabled,
            ]}>
            {busy ? 'SAVING...' : 'SAVE GCASH SETTINGS'}
          </Text>
        </View>

        {canManageBank?<View style={styles.card}>
          <Text style={styles.scopeName}>Authorized Bank Receiver</Text>
          <Text style={styles.help}>Only a scope admin may change the receiving bank. This is separate from GCash and BUKLOD-owned cash.</Text>
          <Text style={styles.label}>BANK NAME</Text>
          <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="Registered bank"/>
          <Text style={styles.label}>ACCOUNT HOLDER</Text>
          <TextInput style={styles.input} value={bankHolder} onChangeText={setBankHolder} placeholder="Name on receiving bank account"/>
          <Text style={styles.label}>ACCOUNT NUMBER</Text>
          <TextInput style={styles.input} value={bankAccount} onChangeText={setBankAccount} placeholder="Authorized account number" keyboardType="default"/>
          <View style={styles.switchRow}><Text style={styles.label}>BANK RECEIVING ACTIVE</Text>
            <Switch value={bankEnabled} onValueChange={setBankEnabled}/></View>
          <Pressable disabled={busy} onPress={()=>void saveBank()} style={[styles.save,busy&&styles.disabled]}><Text style={{color:'white',fontWeight:'900',textAlign:'center'}}>SAVE AUTHORIZED BANK</Text></Pressable>
          {bankReceiver?<Text style={styles.help}>Current bank receiver: {bankReceiver.name} · {bankReceiver.holder}</Text>:null}
        </View>:null}
        {members.length>0?<View style={styles.card}>
          <Text style={styles.scopeName}>Authorize Treasurer</Text>
          <Text style={styles.help}>Only the exact-scope admin can authorize or revoke a treasurer. Treasurer can review another member's receipt but cannot verify their own.</Text>
          {members.map(member=>{
            const active=assigned.some(item=>item.id===member.id&&item.active);
            return <View key={member.id} style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:6}}>
              <Text style={{flex:1,color:'#143D2F',fontSize:14}}>{member.name}</Text>
              <Pressable disabled={Boolean(treasurerBusy)||busy} onPress={()=>void toggleTreasurer(member,!active)}
                style={[styles.save,{minHeight:42,marginTop:0,backgroundColor:active?'#8B4242':'#176B4A',paddingHorizontal:12}]}>
                <Text style={{color:'white',fontWeight:'800'}}>{active?'REVOKE':'AUTHORIZE'}</Text>
              </Pressable>
            </View>;
          })}
        </View>:null}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Security</Text>
          <Text style={styles.noticeText}>
            Save only the public receiving name, GCash mobile, and optional HTTPS payment URL.
            Never store MPIN, OTP, wallet password, or wallet secret.
          </Text>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            How BUKLOD Giving uses this
          </Text>
          <Text style={styles.noticeText}>
            The sender only selects this Organization, Sub-organization, or Cluster in For:.
            BUKLOD Giving reads the saved receiver automatically. The sender cannot edit it.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 18,
    gap: 12,
    backgroundColor: '#F6F8F7',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDE5E1',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
  },
  eyebrow: {
    color: '#6B7972',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  scopeName: {
    color: '#153B2E',
    fontSize: 22,
    fontWeight: '900',
  },
  scopeMeta: {
    color: '#6B7972',
    fontSize: 12,
  },
  label: {
    color: '#5E6D66',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E1DD',
    backgroundColor: '#FFFFFF',
    color: '#17231E',
    paddingHorizontal: 13,
  },
  switchRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  help: {
    color: '#728078',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  save: {
    marginTop: 4,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#176B4A',
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 15,
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.55,
  },
  notice: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#EAF3EE',
  },
  noticeTitle: {
    color: '#205C43',
    fontWeight: '900',
  },
  noticeText: {
    color: '#50645A',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});