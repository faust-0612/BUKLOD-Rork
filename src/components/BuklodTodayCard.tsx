import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  loadAnsweredBuklodTodayIds,
  loadBuklodToday,
  publishBuklodTodayAnswer,
  recordBuklodTodayEngagement,
  triggerBuklodTodayGenerationIfNeeded,
  type BuklodTodayItem,
} from '@/lib/buklodDailyEngagement';

function iconFor(type: BuklodTodayItem['item_type']) {
  if (type === 'POLL') return 'poll';
  if (type === 'CHALLENGE') return 'flag-checkered';
  if (type === 'TRENDING_SUMMARY') return 'trending-up';
  if (type === 'TRIVIA') return 'lightbulb-on-outline';
  return 'comment-question-outline';
}

export default function BuklodTodayCard({
  onRespond,
  onPosted,
}: {
  onRespond?: () => void;
  onPosted?: () => void;
}) {
  const [items, setItems] = useState<BuklodTodayItem[]>([]);
  const [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pendingRefresh, setPendingRefresh] = useState<{
    items: BuklodTodayItem[];
    fallback: boolean;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const answeredIds = await loadAnsweredBuklodTodayIds();
      const first = await loadBuklodToday();
      if (!alive) return;
      setAnswered(answeredIds);
      setItems(first.items.slice(0, 4));
      setFallback(first.fallback);
      for (const item of first.items.slice(0, 4)) {
        void recordBuklodTodayEngagement(item.id, 'VIEW');
      }

      if (first.generationNeeded) {
        const generated = await triggerBuklodTodayGenerationIfNeeded();
        if (generated && alive) {
          const next = await loadBuklodToday();
          if (!alive) return;
          setPendingRefresh({ items: next.items.slice(0, 4), fallback: next.fallback });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => items.slice(0, 4), [items]);
  const active = visible.length ? visible[activeIndex % visible.length] : null;
  const alreadyAnswered = active ? answered.has(active.id) : false;

  const hasDraft = Object.entries(answers).some(
    ([id, answer]) => !answered.has(id) && answer.length > 0,
  );
  const interactionActive = focusedId !== null || busyId !== null || hasDraft;

  useEffect(() => {
    if (!pendingRefresh || interactionActive) return;
    const nextIndex = pendingRefresh.items.findIndex(item => item.id === active?.id);
    setItems(pendingRefresh.items);
    setFallback(pendingRefresh.fallback);
    setActiveIndex(Math.max(0, nextIndex));
    setPendingRefresh(null);
  }, [active?.id, interactionActive, pendingRefresh]);

  useEffect(() => {
    if (visible.length <= 1 || interactionActive) return;
    const timer = setInterval(() => {
      setActiveIndex(current => (current + 1) % visible.length);
    }, 30_000);
    return () => clearInterval(timer);
  }, [activeIndex, interactionActive, visible.length]);

  useEffect(() => {
    if (activeIndex >= visible.length) setActiveIndex(0);
  }, [activeIndex, visible.length]);

  const submitAnswer = async (item: BuklodTodayItem, answer: string) => {
    if (busyId || answered.has(item.id)) return;
    setBusyId(item.id);
    try {
      await publishBuklodTodayAnswer(item, answer);
      setAnswered(current => new Set(current).add(item.id));
      setSelected(current => ({ ...current, [item.id]: answer }));
      setFocusedId(current => current === item.id ? null : current);
      onPosted?.();
      Alert.alert(
        'Posted sa Wall',
        'Na-share na ang sagot mo sa Community Wall.',
      );
    } catch (error: any) {
      Alert.alert(
        'Hindi na-post',
        error?.message || 'Subukan ulit. Hindi nabura ang sagot mo.',
      );
    } finally {
      setBusyId(null);
    }
  };

  if (!active) return null;

  const isPoll = Array.isArray(active.options) && active.options.length > 0;
  const isQuestion =
    !isPoll &&
    (active.item_type === 'QUESTION' ||
      /tanong ng bayan/i.test(active.title) ||
      active.item_type === 'CONVERSATION_STARTER' ||
      active.item_type === 'CHALLENGE');

  return (
    <View style={s.shell}>
      <View style={s.head}>
        <View>
          <Text style={s.eyebrow}>BUKLOD TODAY</Text>
          <Text style={s.sub}>
            Tanong ng Bayan · Daily Pulse · araw-araw bago
          </Text>
        </View>
        <View style={s.counterWrap}>
          {fallback ? <Text style={s.fallback}>SAFE FALLBACK</Text> : null}
          <Text style={s.counter}>
            {(activeIndex % visible.length) + 1}/{visible.length}
          </Text>
        </View>
      </View>

      <View key={active.id} style={s.card}>
        <View style={s.titleRow}>
          <MaterialCommunityIcons
            name={iconFor(active.item_type) as any}
            size={18}
            color="#1E6B45"
          />
          <Text style={s.title}>{active.title}</Text>
          {active.source_kind === 'REAL_TRENDING' ? (
            <Text style={s.real}>REAL ACTIVITY</Text>
          ) : null}
        </View>
        <Text style={s.body}>{active.body}</Text>

        {isPoll ? (
          <View style={s.options}>
            {active.options.map(option => {
              const optionSelected = selected[active.id] === option;
              return (
                <Pressable
                  key={option}
                  disabled={alreadyAnswered || busyId === active.id}
                  onPress={() => void submitAnswer(active, option)}
                  style={[
                    s.option,
                    optionSelected && s.optionOn,
                    alreadyAnswered && !optionSelected && s.optionDim,
                  ]}
                >
                  <Text
                    style={[
                      s.optionText,
                      optionSelected && s.optionTextOn,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {isQuestion ? (
          <TextInput
            value={answers[active.id] ?? ''}
            onFocus={() => setFocusedId(active.id)}
            onBlur={() => setFocusedId(current => current === active.id ? null : current)}
            onChangeText={value =>
              setAnswers(current => ({ ...current, [active.id]: value }))
            }
            editable={!alreadyAnswered && busyId !== active.id}
            multiline
            maxLength={500}
            placeholder="Isulat ang sagot mo… (i-post agad sa Wall)"
            placeholderTextColor="#8A9A90"
            style={s.answerInput}
          />
        ) : null}

        <View style={s.footerRow}>
          <Pressable
            disabled={
              alreadyAnswered ||
              busyId === active.id ||
              (isQuestion && !(answers[active.id] ?? '').trim()) ||
              isPoll
            }
            onPress={() => {
              if (alreadyAnswered || isPoll) return;
              if (isQuestion) {
                void submitAnswer(active, answers[active.id] ?? '');
                return;
              }
              void recordBuklodTodayEngagement(active.id, 'ENGAGE');
              onRespond?.();
            }}
            style={[
              s.respond,
              (alreadyAnswered || busyId === active.id || isPoll) && s.respondDone,
            ]}
          >
            {busyId === active.id ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={s.respondText}>
                {alreadyAnswered
                  ? 'Posted sa Wall'
                  : isPoll
                    ? 'Pindutin ang option → auto-post'
                    : 'Sumagot → Post sa Wall'}
              </Text>
            )}
          </Pressable>
          {visible.length > 1 ? (
            <Pressable
              accessibilityLabel="Next BUKLOD Today card"
              onPress={() => {
                setFocusedId(null);
                setActiveIndex(current => (current + 1) % visible.length);
              }}
              style={s.next}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color="#1E6B45"
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  shell: { marginBottom: 12, gap: 8 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#173C2C',
  },
  sub: { marginTop: 1, fontSize: 10, color: '#6E7C74' },
  fallback: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: '#7B6A2D',
  },
  counterWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  counter: { fontSize: 8, fontWeight: '900', color: '#728077' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDE7E1',
    backgroundColor: '#FFFFFF',
    padding: 13,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { flex: 1, fontSize: 13, fontWeight: '900', color: '#173C2C' },
  real: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#21704A',
  },
  body: { marginTop: 7, fontSize: 13, lineHeight: 19, color: '#43554B' },
  options: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFE0D6',
    backgroundColor: '#F8FBF9',
  },
  optionOn: { backgroundColor: '#E4F3EA', borderColor: '#76A98D' },
  optionDim: { opacity: 0.55 },
  optionText: { fontSize: 11, fontWeight: '800', color: '#365648' },
  optionTextOn: { color: '#145D3A' },
  answerInput: {
    marginTop: 10,
    minHeight: 74,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5E4DB',
    backgroundColor: '#F7FBF8',
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: '#24382E',
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  footerRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  respond: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#1E6B45',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  respondDone: { backgroundColor: '#6F8B7B' },
  respondText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },
  next: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#D5E4DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
