import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildTradeBusiness, businessBuildLabel, businessCanList, canAffordBusinessStage,
  cancelTradeListing, claimTradeParticipationItem, listTradeItem,
  loadBuklodTradeSnapshot, loadEligibleTradeParticipation, nextBusinessRequirements,
  purchaseTradeItem, registerTradeBusiness, settleTradeRank,
  TRADE_CONSTRUCTION_STAGES, TRADE_STARTER_BP, TRADE_MIN_PARTICIPATION,
  type TradeSnapshot, type TradeSource,
} from '@/lib/buklodTradeEconomy';

type Props = { mode: 'market' | 'business' };

export default function BuklodTradeWorkspace({ mode }: Props) {
  const [snapshot, setSnapshot] = useState<TradeSnapshot | null>(null);
  const [sources, setSources] = useState<TradeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [ack, setAck] = useState(false);
  const [itemCode, setItemCode] = useState('wood');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('10');
  // Do not issue a new request key on retry after ambiguous network failure.
  const pendingKeys = useRef<Record<string, string>>({});
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const s = await loadBuklodTradeSnapshot();
    if (!mounted.current) return;
    setSnapshot(s);
    if (s.enabled) {
      const nextSources = await loadEligibleTradeParticipation();
      if (mounted.current) setSources(nextSources);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh().catch(e => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
    return () => { mounted.current = false; };
  }, [refresh]);

  const act = useCallback(async (label: string, work: () => Promise<unknown>) => {
    if (busy) return;
    setError(''); setNotice(''); setBusy(label);
    try {
      await work();
      setNotice(label + ' completed.');
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e ?? 'Could not complete action.'));
    } finally {
      if (mounted.current) setBusy('');
    }
  }, [busy, refresh]);

  const buy = useCallback((listingId: string) => {
    if (!snapshot?.viewer_id) return;
    const localKey = snapshot.viewer_id + ':' + listingId;
    const storageKey = 'buklod:trade:pending:' + localKey;
    void act('Purchase', async () => {
      // A persisted idempotency key survives app termination after an ambiguous
      // network loss. Never retry an uncertain BP payment with a new key.
      const previous = pendingKeys.current[localKey] || await AsyncStorage.getItem(storageKey);
      const requestKey = previous || Crypto.randomUUID();
      pendingKeys.current[localKey] = requestKey;
      await AsyncStorage.setItem(storageKey, requestKey);
      await purchaseTradeItem(listingId, 1, requestKey);
      await AsyncStorage.removeItem(storageKey);
      delete pendingKeys.current[localKey];
    });
  }, [act, snapshot?.viewer_id]);

  const business = snapshot?.business ?? null;
  const next = nextBusinessRequirements(business, snapshot?.requirements ?? []);
  const readyForStage = canAffordBusinessStage(next, snapshot?.inventory ?? [], snapshot?.available_bp ?? 0);
  const buildFinished = business?.level === 10 && business.construction_stage === 5;
  const stageBp = next.reduce((sum, r) => sum + r.bp_cost, 0);
  const ownedListings = snapshot?.listings.filter(l => l.is_mine) ?? [];

  return (
    <>
      <Stack.Screen options={{ title: mode === 'market' ? 'BUKLOD Marketplace' : 'BUKLOD Business' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>{mode === 'market' ? 'BUKLOD Marketplace' : 'My BUKLOD Business'}</Text>
          <Text style={styles.caption}>Permanent participation-to-trade economy · No BP minted by sales</Text>
          <View style={styles.links}>
            <Pressable onPress={() => router.push('/profile/buklod-bp-market' as any)}>
              <Text style={styles.link}>Marketplace</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/profile/buklod-bp-business' as any)}>
              <Text style={styles.link}>My Business</Text>
            </Pressable>
            <Pressable onPress={() => void act('Refresh', refresh)} disabled={!!busy}>
              <Text style={styles.link}>Refresh</Text>
            </Pressable>
          </View>
        </View>
        {loading ? <ActivityIndicator color="#147C48" /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {!snapshot && !loading ? (
          <Text style={styles.note}>The trading service is not available on this app runtime. Existing BP and inventory remain unchanged.</Text>
        ) : null}
        {snapshot && !snapshot.enabled ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Market activation pending</Text>
            <Text style={styles.body}>
              Marketplace transactions are not enabled. No preview BP balances, fictional sales,
              or unverified items can be credited.
            </Text>
            <Text style={styles.note}>
              Rules are prepared for verified participation, item escrow, atomic BP transfer,
              business construction, and delayed profit Rank qualification.
            </Text>
          </View>
        ) : null}
        {snapshot && snapshot.enabled ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Spendable BP</Text>
              <Text style={styles.balance}>{snapshot.available_bp.toLocaleString()} BP</Text>
              <Text style={styles.note}>
                Purchases spend BP, not lifetime Rank. A seller receives transferred BP;
                qualified net profit can count toward Rank only after review.
              </Text>
            </View>

            {mode === 'business' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Business establishment</Text>
                  {business ? (
                    <>
                      <Text style={styles.strong}>{business.title} · {business.category}</Text>
                      <Text style={styles.body}>{businessBuildLabel(business)}</Text>
                      <View style={styles.progress}>
                        {TRADE_CONSTRUCTION_STAGES.map((name, index) => (
                          <View key={name} style={[styles.stage, index < business.construction_stage && styles.stageDone]}>
                            <Text style={[styles.stageText, index < business.construction_stage && styles.stageTextDone]}>{index + 1}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.note}>Posts → framework → walls → roof → fittings, for every level.</Text>
                      {!buildFinished ? (
                        <>
                          {next.map(r => (
                            <Text key={r.item_code} style={styles.body}>
                              {r.item_code}: {r.quantity} needed · {snapshot.inventory.find(i => i.code === r.item_code)?.quantity ?? 0} held
                            </Text>
                          ))}
                          {next.length > 0 ? <Text style={styles.note}>Construction charge: {stageBp} BP</Text> : null}
                          <Action title={business.construction_stage === 5 ? 'Start next level' : 'Complete next construction stage'}
                            disabled={!!busy || (business.construction_stage < 5 && !readyForStage)}
                            onPress={() => void act('Construction', () => buildTradeBusiness(business.id))} />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text style={styles.note}>
                        Need {TRADE_MIN_PARTICIPATION} distinct verified participation credits,
                        at least {TRADE_STARTER_BP} available BP, an active account,
                        and completed business orientation. No Circle Rank gate.
                      </Text>
                      <TextInput placeholder="Business name" placeholderTextColor="#748276" style={styles.field}
                        value={title} onChangeText={setTitle} maxLength={70} />
                      <TextInput placeholder="Business category (any lawful category)" placeholderTextColor="#748276"
                        style={styles.field} value={category} onChangeText={setCategory} maxLength={50} />
                      <Pressable onPress={() => setAck(v => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: ack }}>
                        <Text style={styles.body}>{ack ? '☑' : '☐'} I understand: item sources must be verified, trades only transfer existing BP, and fake trades are prohibited.</Text>
                      </Pressable>
                      <Action title="Register my business" disabled={!ack || !title.trim() || !category.trim() || !!busy}
                        onPress={() => void act('Registration', () => registerTradeBusiness(title, category))} />
                    </>
                  )}
                </View>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Sell acquired inventory</Text>
                  <Text style={styles.note}>Business must finish its current construction level. Stock is held in escrow on listing.</Text>
                  <TextInput placeholder="Item code (wood, nails, stone...)" placeholderTextColor="#748276"
                    style={styles.field} value={itemCode} onChangeText={setItemCode} />
                  <View style={styles.links}>
                    <TextInput style={[styles.field, styles.smallField]} keyboardType="numeric" placeholder="Qty" value={quantity} onChangeText={setQuantity} />
                    <TextInput style={[styles.field, styles.smallField]} keyboardType="numeric" placeholder="BP each" value={unitPrice} onChangeText={setUnitPrice} />
                  </View>
                  <Action title="List inventory" disabled={!businessCanList(business) || !!busy ||
                    !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 100 ||
                    !Number.isInteger(Number(unitPrice)) || Number(unitPrice) < 1}
                    onPress={() => void act('Listing', () =>
                      listTradeItem(business!.id, itemCode.trim().toLowerCase(), Number(quantity), Number(unitPrice)))} />
                  {ownedListings.map(l => (
                    <View key={l.id} style={styles.row}>
                      <Text style={styles.rowText}>{l.item_code} · {l.quantity} units · {l.unit_price_bp} BP</Text>
                      <Action title="Cancel" disabled={!!busy} onPress={() => void act('Cancellation', () => cancelTradeListing(l.id))} />
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Shop verified inventory</Text>
                {snapshot.listings.length === 0 ? <Text style={styles.note}>No active offers yet.</Text> : null}
                {snapshot.listings.map(l => (
                  <View style={styles.row} key={l.id}>
                    <View style={styles.flex}>
                      <Text style={styles.strong}>{l.item_code} · {l.unit_price_bp} BP</Text>
                      <Text style={styles.note}>{l.business} · {l.quantity} available</Text>
                    </View>
                    <Action title={l.is_mine ? 'Your listing' : 'Buy 1'} disabled={l.is_mine || !!busy ||
                      snapshot.available_bp < l.unit_price_bp} onPress={() => buy(l.id)} />
                  </View>
                ))}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Verified item acquisition</Text>
              <Text style={styles.note}>Items are obtained from existing claimed participation records, once per event, or purchased from suppliers.</Text>
              {snapshot.inventory.map(i => (
                <Text key={i.code} style={styles.body}>{i.code}: {i.quantity} held · {i.cost_basis_bp} BP cost basis</Text>
              ))}
              {sources.slice(0, 10).map(s => (
                <View key={s.id} style={styles.row}>
                  <Text style={styles.rowText}>{s.activity_type} · {new Date(s.created_at).toLocaleDateString()}</Text>
                  <Action title="Claim item" disabled={!!busy}
                    onPress={() => void act('Claim', () => claimTradeParticipationItem(s.id))} />
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recent trades & Rank review</Text>
              {snapshot.recent_orders.length === 0 ? <Text style={styles.note}>No orders yet.</Text> : null}
              {snapshot.recent_orders.map(o => (
                <View key={o.id} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.strong}>{o.role} · {o.quantity} {o.item_code} · {o.total_bp} BP</Text>
                    <Text style={styles.note}>Profit Rank: {o.rank_state} · {o.rank_credit_bp} qualified</Text>
                  </View>
                  {o.role === 'seller' && o.rank_state === 'PENDING' && snapshot.rank_profit_enabled ? (
                    <Action title="Check" disabled={!!busy}
                      onPress={() => void act('Rank check', () => settleTradeRank(o.id))} />
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Action({ title, disabled, onPress }: { title: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1F7F3' },
  content: { padding: 12, paddingBottom: 40, gap: 9 },
  heading: { gap: 4, marginBottom: 3 },
  title: { color: '#103D2B', fontSize: 23, fontWeight: '900' },
  caption: { color: '#486B57', fontSize: 12, lineHeight: 17 },
  links: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  link: { color: '#08733A', fontWeight: '800', fontSize: 13, paddingVertical: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, gap: 9, borderWidth: 1, borderColor: '#D7E5DB' },
  sectionTitle: { color: '#173F2D', fontWeight: '900', fontSize: 16 },
  body: { color: '#2E473B', fontSize: 13, lineHeight: 18 },
  strong: { color: '#153D2B', fontSize: 14, fontWeight: '800' },
  note: { color: '#5F7467', fontSize: 12, lineHeight: 17 },
  balance: { color: '#0E783F', fontSize: 24, fontWeight: '900' },
  field: { backgroundColor: '#F8FAF8', borderColor: '#C7DACE', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9, color: '#163526', fontSize: 13 },
  smallField: { flex: 1, minWidth: 95 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8,
    borderTopColor: '#E3EAE4', borderTopWidth: 1 },
  rowText: { flex: 1, color: '#284C38', fontSize: 12 },
  flex: { flex: 1 },
  button: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#147847',
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  error: { backgroundColor: '#FFE8E8', color: '#902020', padding: 10, borderRadius: 8 },
  notice: { backgroundColor: '#E7F6EB', color: '#166336', padding: 10, borderRadius: 8 },
  progress: { flexDirection: 'row', gap: 5 },
  stage: { flex: 1, alignItems: 'center', padding: 7, backgroundColor: '#E7ECE8', borderRadius: 5 },
  stageDone: { backgroundColor: '#237C4B' },
  stageText: { color: '#526C5D', fontSize: 12, fontWeight: '800' },
  stageTextDone: { color: '#FFFFFF' },
});
