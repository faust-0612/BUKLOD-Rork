import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type Budget = {
  id: string;
  source_reference: string;
  amount_centavos: number;
  remaining_centavos: number;
  status: 'PENDING' | 'VERIFIED_BY_ADMIN' | 'VOID';
  recorded_at: string;
};
type Funding = {
  enabled: boolean;
  economics_enabled: boolean;
  withdrawals_enabled: boolean;
  budgets: Budget[];
  funding_verified_by_provider: false;
  requires_external_receipt_review: true;
};
type Recipient = { user_id: string; full_name: string | null; username: string | null; is_active: boolean };

function cents(text: string): number | null {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text.trim())) return null;
  const [pesos, fractions = ''] = text.trim().split('.');
  const value = Number(pesos) * 100 + Number(fractions.padEnd(2, '0'));
  return Number.isSafeInteger(value) ? value : null;
}
function money(value: number) {
  return `₱${(Number(value) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function AdminButton({ label, onPress, disabled = false }: {
  label: string; onPress: () => void; disabled?: boolean;
}) {
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{disabled}}
    onPress={onPress} style={[styles.button,disabled&&styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}
export default function BuklodFundedRewardsAdmin() {
  const [funding, setFunding] = useState<Funding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceRef, setSourceRef] = useState('');
  const [proofRef, setProofRef] = useState('');
  const [sourceAmount, setSourceAmount] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [verification, setVerification] = useState('');
  const [search, setSearch] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedUser, setSelectedUser] = useState<Recipient | null>(null);
  const [awardAmount, setAwardAmount] = useState('');
  const [reason, setReason] = useState('');
  const request = useRef<{ fingerprint: string; key: string } | null>(null);

  const rpc = useCallback(async <T,>(name: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error: nextError } = await (supabase as any).rpc(name, args);
    if (nextError) throw new Error(nextError.message || 'Secure funding operation failed');
    return data as T;
  }, []);
  const load = useCallback(async () => {
    try {
      const next = await rpc<Funding>('admin_get_buklod_pf_reward_funding_v1');
      setFunding(next); setError(null);
    } catch (e) {
      setFunding(null);
      setError(e instanceof Error ? e.message : 'Reward funding unavailable');
    }
  }, [rpc]);
  useEffect(() => { void load(); }, [load]);

  const perform = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await work();
      await load();
      Alert.alert('Funded reward', message);
    } catch (e) {
      Alert.alert('Funded reward', e instanceof Error ? e.message : 'Action failed');
    } finally { setBusy(false); }
  };

  const registerFunding = () => {
    const minor = cents(sourceAmount);
    if (minor == null || minor <= 0 || minor > 100000000 || sourceRef.trim().length < 8 || proofRef.trim().length < 8) {
      Alert.alert('Funding', 'Provide the actual funded amount, unique external transaction reference and receipt evidence.');
      return;
    }
    Alert.alert('Record pending funding?', 'This only creates a pending record. It does NOT create spendable user cash.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Record pending', onPress: () => void perform(async () => {
        await rpc('admin_register_buklod_pf_reward_funding_v1', {
          p_source_reference: sourceRef.trim(), p_evidence_reference: proofRef.trim(),
          p_amount_centavos: minor, p_note: 'Manually recorded receipt, awaiting verification',
        });
      }, 'Funding recorded as PENDING; confirm the real external receipt before marking verified.') },
    ]);
  };
  const confirmVerification = () => {
    const budget = funding?.budgets.find(b => b.id === selectedBudget);
    if (!budget || budget.status !== 'PENDING' || verification.trim().length < 8) return;
    Alert.alert('Attest external funding received?', 'Only continue after independently checking that cash actually arrived in a BUKLOD-controlled external account. A reference alone is NOT payment confirmation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'I verified the receipt', onPress: () => void perform(
        () => rpc('admin_verify_buklod_pf_reward_funding_v1', {
          p_budget_id: budget.id, p_verification_reference: verification.trim(),
        }), 'The receipt was attested. User credit is still gated until reward transfers are enabled.'),
      },
    ]);
  };
  const toggle = () => {
    if (!funding) return;
    if (!funding.enabled && !funding.economics_enabled) {
      Alert.alert('Activation blocked', 'Production economics remains OFF. Do not enable reward disbursement until the actual funding and financial release gates are verified.');
      return;
    }
    Alert.alert(funding.enabled ? 'Disable reward transfers?' : 'Enable funded reward transfers?',
      funding.enabled ? 'No new funded grants can be created after disabling.' :
        'Only externally funded, verified budgets can be spent. This does not enable withdrawals or payouts.',
      [{ text: 'Cancel', style: 'cancel' }, {
        text: funding.enabled ? 'Disable' : 'Enable',
        onPress: () => void perform(
          () => rpc('admin_set_buklod_pf_reward_transfers_enabled_v1', { p_enabled: !funding.enabled }),
          'Reward-transfer control updated.'
        ),
      }]);
  };
  const findUsers = async () => {
    if (search.trim().length < 2) return;
    setBusy(true);
    try {
      const rows = await rpc<Recipient[]>('buklod_admin_foundation_search_users_v1', { p_query: search.trim() });
      setRecipients(Array.isArray(rows) ? rows.filter(r => r.is_active).slice(0,15) : []);
      setSelectedUser(null);
    } catch (e) { Alert.alert('Search', e instanceof Error ? e.message : 'User search failed'); }
    finally { setBusy(false); }
  };
  const transfer = () => {
    const amount = cents(awardAmount);
    const budget = funding?.budgets.find(b => b.id === selectedBudget);
    if (!funding?.enabled || !funding.economics_enabled || budget?.status !== 'VERIFIED_BY_ADMIN'
      || !selectedUser || amount == null || amount < 1 || amount > 10000000
      || amount > budget.remaining_centavos || reason.trim().length < 8) {
      Alert.alert('Transfer blocked', 'Choose a verified funded budget, eligible active recipient, valid available amount and detailed reason. Transfer controls must be enabled.');
      return;
    }
    const fingerprint = [budget.id,selectedUser.user_id,amount,reason.trim()].join('|');
    if (!request.current || request.current.fingerprint !== fingerprint) {
      request.current = {
        fingerprint,
        key: `admin-funded-reward:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      };
    }
    const key = request.current.key;
    Alert.alert('Confirm a real funded reward?', `${money(amount)} will be debited from the verified reward budget and credited to the recipient's canonical AVAILABLE cash. It remains subject to withdrawal/payment controls.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm transfer', onPress: () => void perform(
        () => rpc('admin_transfer_buklod_pf_funded_reward_v1', {
          p_budget_id: budget.id, p_recipient_user_id: selectedUser.user_id,
          p_amount_centavos: amount, p_request_key: key, p_reason: reason.trim(),
        }), 'Transfer recorded once. Click New transfer before creating a different reward.'),
      },
    ]);
  };

  return <AdminGate><ScrollView contentContainerStyle={styles.page}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ BACK TO FINANCE</Text></Pressable>
    <Text style={styles.title}>SYSTEM ADMIN · FUNDED REWARDS</Text>
    <Text style={styles.body}>A cash reward must start from a real external funded amount. Points, Community QMP, preliminary AdMob revenue and Organization/Cluster funds cannot be automatically credited here. Funded rewards use the existing Profit-First cash wallet and ONE canonical withdrawal request.</Text>
    {error ? <Text style={styles.warning}>{error}</Text> : null}
    {!funding ? <ActivityIndicator color="#1E6B45"/> : <>
      <View style={styles.card}>
        <Text style={styles.heading}>Release controls</Text>
        <Text style={styles.note}>Economics: {funding.economics_enabled ? 'ON' : 'OFF'} · Funded rewards: {funding.enabled ? 'ON' : 'OFF'} · Withdrawal: {funding.withdrawals_enabled ? 'ON' : 'OFF'}</Text>
        <Text style={styles.warning}>External receipts require real manual checking. This module does not verify bank transfers automatically.</Text>
        <AdminButton label={funding.enabled ? 'DISABLE REWARD TRANSFERS' : 'ENABLE VERIFIED FUNDED TRANSFERS'} disabled={busy || (!funding.enabled && !funding.economics_enabled)} onPress={toggle}/>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>1 · Record a funding receipt (no cash credit)</Text>
        <TextInput value={sourceRef} onChangeText={setSourceRef} style={styles.input} placeholder="Unique external bank transaction reference"/>
        <TextInput value={proofRef} onChangeText={setProofRef} style={styles.input} placeholder="Private receipt / statement evidence reference"/>
        <TextInput value={sourceAmount} onChangeText={setSourceAmount} style={styles.input} keyboardType="decimal-pad" placeholder="Real funded amount in PHP"/>
        <AdminButton label="RECORD AS PENDING" disabled={busy} onPress={registerFunding}/>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>2 · Verify actual received funds</Text>
        {funding.budgets.length ? funding.budgets.map(b =>
          <Pressable key={b.id} onPress={() => setSelectedBudget(b.id)} style={[styles.budget,selectedBudget===b.id&&styles.selected]}>
            <Text style={styles.budgetTitle}>{b.source_reference} · {b.status}</Text>
            <Text style={styles.note}>{money(b.remaining_centavos)} of {money(b.amount_centavos)} remaining</Text>
          </Pressable>) : <Text style={styles.note}>No registered receipts.</Text>}
        <TextInput value={verification} onChangeText={setVerification} style={styles.input} placeholder="Separate receipt verification / reconciliation reference"/>
        <AdminButton label="ATTEST FUNDING VERIFIED" disabled={busy || !selectedBudget || funding.budgets.find(b=>b.id===selectedBudget)?.status!=='PENDING'} onPress={confirmVerification}/>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>3 · Funded cash reward to a user</Text>
        <Text style={styles.note}>Search by name or username. The system checks linked canonical financial identity and risk status before issuing funds.</Text>
        <TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Search BUKLOD user"/>
        <AdminButton label="SEARCH USER" disabled={busy || search.trim().length<2} onPress={() => void findUsers()}/>
        {recipients.map(u => <Pressable key={u.user_id} style={[styles.budget,selectedUser?.user_id===u.user_id&&styles.selected]}
          onPress={()=>{setSelectedUser(u);request.current=null;}}>
          <Text style={styles.budgetTitle}>{u.full_name || 'BUKLOD user'} {u.username ? `@${u.username}` : ''}</Text>
        </Pressable>)}
        {selectedUser ? <Text style={styles.note}>Selected: {selectedUser.full_name || selectedUser.username}</Text> : null}
        <TextInput value={awardAmount} onChangeText={setAwardAmount} style={styles.input} keyboardType="decimal-pad" placeholder="Funded reward amount in PHP"/>
        <TextInput value={reason} onChangeText={setReason} style={styles.input} multiline placeholder="Reason for the funded cash reward (audit trail)"/>
        <AdminButton label="CONFIRM FUNDED TRANSFER" disabled={busy || !funding.enabled || !funding.economics_enabled} onPress={transfer}/>
        <AdminButton label="NEW TRANSFER / RESET REPLAY KEY" disabled={busy} onPress={()=>{request.current=null;setAwardAmount('');setReason('');setSelectedUser(null);}}/>
        <Text style={styles.warning}>The same transfer request cannot be credited twice. Transfers only debit externally verified available funding and credit the canonical PF cash ledger. Payout remains subject to the existing withdrawal and processing gates.</Text>
      </View>
    </>}
  </ScrollView></AdminGate>;
}

const styles=StyleSheet.create({
  page:{padding:15,paddingBottom:90,gap:12,backgroundColor:'#F5F8F6'},
  back:{fontSize:10,fontWeight:'900',color:'#1E6B45'},
  title:{fontSize:17,fontWeight:'900',color:'#173C2C'},
  body:{fontSize:11,lineHeight:17,color:'#53685B'},
  card:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#DEE9E2',borderRadius:13,padding:13,gap:9},
  heading:{fontSize:12,fontWeight:'900',color:'#173C2C'},
  note:{fontSize:10,lineHeight:15,color:'#5D6E63'},
  warning:{fontSize:9.5,lineHeight:15,fontWeight:'700',color:'#8A621C'},
  input:{borderWidth:1,borderColor:'#D0DFD6',borderRadius:9,minHeight:42,paddingHorizontal:11,backgroundColor:'#FCFEFD',fontSize:11,color:'#173C2C'},
  button:{minHeight:42,backgroundColor:'#1E6B45',borderRadius:9,justifyContent:'center',alignItems:'center',paddingHorizontal:8},
  disabled:{backgroundColor:'#A5B3AA'},
  buttonText:{fontSize:10,fontWeight:'900',color:'#FFF',textAlign:'center'},
  budget:{borderWidth:1,borderColor:'#DAE5DD',borderRadius:9,padding:10,gap:3},
  selected:{borderColor:'#1E6B45',backgroundColor:'#ECF7F0'},
  budgetTitle:{fontSize:10.5,fontWeight:'900',color:'#244938'},
});
