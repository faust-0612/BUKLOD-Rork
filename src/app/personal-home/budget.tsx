import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

type BudgetKind = 'income' | 'expense';
type BudgetEntry = {
  id: string;
  kind: BudgetKind;
  amount: number;
  note: string;
  createdAt: number;
};

function money(value: number) {
  return `₱${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PersonalHomeBudgetScreen() {
  const { profile } = useAuth();
  const userId = String(profile?.id ?? 'guest');
  const monthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const storageKey = useMemo(
    () => `buklod.personal-home.budget.${userId}.${monthKey}`,
    [monthKey, userId],
  );
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [kind, setKind] = useState<BudgetKind>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((value) => {
      if (!value) return;
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) setEntries(parsed);
      } catch {
        setEntries([]);
      }
    });
  }, [storageKey]);

  const save = async (next: BudgetEntry[]) => {
    setEntries(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  };

  const add = async () => {
    const numeric = Number(String(amount).replace(/,/g, ''));
    const cleanNote = note.trim();
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Maglagay ng valid na amount na higit sa zero.');
      return;
    }
    setError('');
    const next: BudgetEntry[] = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind,
        amount: Math.round(numeric * 100) / 100,
        note: cleanNote || (kind === 'income' ? 'Income' : 'Expense'),
        createdAt: Date.now(),
      },
      ...entries,
    ].slice(0, 200);
    await save(next);
    setAmount('');
    setNote('');
  };

  const remove = async (id: string) => {
    await save(entries.filter((item) => item.id !== id));
  };

  const income = entries
    .filter((item) => item.kind === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const expenses = entries
    .filter((item) => item.kind === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expenses;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={23} color="#234434" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Budget & Money</Text>
          <Text style={styles.subtitle}>
            Personal monthly planner. Amounts come only from what you enter—no fake financial data.
          </Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={styles.income}>{money(income)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={styles.expense}>{money(expenses)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text style={[styles.balance, balance < 0 && styles.negative]}> {balance < 0 ? '-' : ''}{money(balance)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.kindRow}>
          <Pressable onPress={() => setKind('expense')} style={[styles.kindButton, kind === 'expense' && styles.kindActive]}>
            <MaterialCommunityIcons name="arrow-up-circle-outline" size={18} color={kind === 'expense' ? '#FFFFFF' : '#93483D'} />
            <Text style={[styles.kindText, kind === 'expense' && styles.kindTextActive]}>Expense</Text>
          </Pressable>
          <Pressable onPress={() => setKind('income')} style={[styles.kindButton, kind === 'income' && styles.kindActive]}>
            <MaterialCommunityIcons name="arrow-down-circle-outline" size={18} color={kind === 'income' ? '#FFFFFF' : '#2D6B4F'} />
            <Text style={[styles.kindText, kind === 'income' && styles.kindTextActive]}>Income</Text>
          </Pressable>
        </View>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor="#829083"
          style={styles.input}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note, e.g. groceries or salary"
          placeholderTextColor="#829083"
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={add} style={styles.primary}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.primaryText}>Add entry</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/points' as any)} style={styles.pointsLink}>
        <MaterialCommunityIcons name="star-circle-outline" size={22} color="#2D6B4F" />
        <View style={styles.pointsCopy}>
          <Text style={styles.pointsTitle}>Circle Points & rewards</Text>
          <Text style={styles.pointsSub}>Open the existing BUKLOD points wallet separately from this cash budget.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color="#2D6B4F" />
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>This month</Text>
        {!entries.length ? <Text style={styles.empty}>Wala pang entries ngayong buwan.</Text> : null}
        {entries.map((item) => (
          <View key={item.id} style={styles.entryRow}>
            <View style={[styles.entryIcon, item.kind === 'income' ? styles.entryIncome : styles.entryExpense]}>
              <MaterialCommunityIcons
                name={item.kind === 'income' ? 'arrow-down' : 'arrow-up'}
                size={17}
                color={item.kind === 'income' ? '#2D6B4F' : '#93483D'}
              />
            </View>
            <View style={styles.entryCopy}>
              <Text style={styles.entryNote}>{item.note}</Text>
              <Text style={styles.entryDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={item.kind === 'income' ? styles.entryAmountIncome : styles.entryAmountExpense}>
              {item.kind === 'income' ? '+' : '-'}{money(item.amount)}
            </Text>
            <Pressable onPress={() => remove(item.id)} style={styles.deleteButton} accessibilityLabel="Delete budget entry">
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#93483D" />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F0E6' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, paddingBottom: 44, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCopy: { flex: 1 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6D7CB' },
  title: { fontSize: 23, fontWeight: '900', color: '#22382C' },
  subtitle: { marginTop: 3, color: '#66756A', fontSize: 12, lineHeight: 17 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  summaryCard: { flexGrow: 1, flexBasis: 160, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#DADBCF', padding: 13 },
  summaryLabel: { color: '#758078', fontSize: 11, fontWeight: '800' },
  income: { marginTop: 5, color: '#2D6B4F', fontSize: 18, fontWeight: '900' },
  expense: { marginTop: 5, color: '#93483D', fontSize: 18, fontWeight: '900' },
  balance: { marginTop: 5, color: '#274536', fontSize: 18, fontWeight: '900' },
  negative: { color: '#93483D' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#DADBCF' },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  kindButton: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5CE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  kindActive: { backgroundColor: '#2D6B4F', borderColor: '#2D6B4F' },
  kindText: { color: '#506057', fontWeight: '900', fontSize: 12 },
  kindTextActive: { color: '#FFFFFF' },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#CFD6CF', paddingHorizontal: 12, color: '#21392B', backgroundColor: '#FBFCF9', marginTop: 8 },
  error: { marginTop: 9, color: '#A43E35', fontWeight: '700', fontSize: 12 },
  primary: { marginTop: 13, minHeight: 48, borderRadius: 14, backgroundColor: '#2D6B4F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  pointsLink: { backgroundColor: '#EDF5EE', borderRadius: 16, borderWidth: 1, borderColor: '#CADCCF', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsCopy: { flex: 1 },
  pointsTitle: { color: '#2A4937', fontWeight: '900', fontSize: 13 },
  pointsSub: { marginTop: 2, color: '#6C786F', fontSize: 10.5, lineHeight: 15 },
  sectionTitle: { color: '#22382C', fontWeight: '900', fontSize: 16, marginBottom: 6 },
  empty: { color: '#758078', fontSize: 12 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3E4DD' },
  entryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  entryIncome: { backgroundColor: '#EAF4EC' },
  entryExpense: { backgroundColor: '#FFF1EE' },
  entryCopy: { flex: 1 },
  entryNote: { color: '#2D4033', fontWeight: '800', fontSize: 12 },
  entryDate: { marginTop: 2, color: '#899088', fontSize: 9.5 },
  entryAmountIncome: { color: '#2D6B4F', fontWeight: '900', fontSize: 12 },
  entryAmountExpense: { color: '#93483D', fontWeight: '900', fontSize: 12 },
  deleteButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7F4' },
});
