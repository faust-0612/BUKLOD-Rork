import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  loadBuklodToday,
  recordBuklodTodayEngagement,
  triggerBuklodTodayGenerationIfNeeded,
  type BuklodTodayItem,
} from '@/lib/buklodDailyEngagement';

/** Slow enough to read; never races a person mid-answer. */
const BUKLOD_TODAY_ROTATE_MS = 24000;

function iconFor(type: BuklodTodayItem['item_type']) {
  if (type === 'POLL') return 'poll';
  if (type === 'CHALLENGE') return 'flag-checkered';
  if (type === 'TRENDING_SUMMARY') return 'trending-up';
  if (type === 'TRIVIA') return 'lightbulb-on-outline';
  return 'comment-question-outline';
}

export default function BuklodTodayCard({
  onRespond,
}: {
  onRespond?: (draft?: string) => void;
}) {
  const [items, setItems] = useState<BuklodTodayItem[]>([]);
  const [fallback, setFallback] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const first = await loadBuklodToday();
      if (!alive) return;
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
          setItems(next.items.slice(0, 4));
          setFallback(next.fallback);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => items.slice(0, 4), [items]);
  const active = visible.length ? visible[activeIndex % visible.length] : null;
  const activeDraft = active ? drafts[active.id] ?? '' : '';
  const holdAdvance =
    writing || Boolean(activeDraft.trim().length);

  useEffect(() => {
    if (visible.length <= 1 || holdAdvance) return;
    const timer = setInterval(() => {
      setActiveIndex(current => (current + 1) % visible.length);
    }, BUKLOD_TODAY_ROTATE_MS);
    return () => clearInterval(timer);
  }, [visible.length, holdAdvance]);

  useEffect(() => {
    if (activeIndex >= visible.length) setActiveIndex(0);
  }, [activeIndex, visible.length]);

  if (!active) return null;

  const submitDraft = () => {
    const text = (drafts[active.id] ?? '').trim();
    void recordBuklodTodayEngagement(active.id, 'ENGAGE');
    onRespond?.(text || undefined);
    if (text) {
      setDrafts(current => {
        const next = { ...current };
        delete next[active.id];
        return next;
      });
    }
    setWriting(false);
  };

  return (
    <View style={s.shell}>
      <View style={s.head}>
        <View>
          <Text style={s.eyebrow}>BUKLOD TODAY</Text>
          <Text style={s.sub}>Fresh daily conversation starter</Text>
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
        <TextInput
          value={activeDraft}
          onChangeText={text =>
            setDrafts(current => ({ ...current, [active.id]: text }))
          }
          onFocus={() => setWriting(true)}
          onBlur={() => setWriting(false)}
          placeholder="Isulat ang sagot mo dito…"
          placeholderTextColor="#8A978F"
          multiline
          style={s.blank}
          accessibilityLabel="BUKLOD Today answer blank"
        />
        <View style={s.footerRow}>
          <Pressable onPress={submitDraft} style={s.respond}>
            <Text style={s.respondText}>Sumagot</Text>
          </Pressable>
          {visible.length > 1 ? (
            <Pressable
              accessibilityLabel="Next BUKLOD Today card"
              disabled={holdAdvance}
              onPress={() => {
                if (holdAdvance) return;
                setActiveIndex(current => (current + 1) % visible.length);
              }}
              style={[s.next, holdAdvance && s.nextHeld]}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={holdAdvance ? '#A7B5AD' : '#1E6B45'}
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
  blank: {
    marginTop: 10,
    minHeight: 72,
    maxHeight: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFE0D6',
    backgroundColor: '#F8FBF9',
    paddingHorizontal: 11,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#173C2C',
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
  },
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
  nextHeld: {
    borderColor: '#E2E8E4',
    backgroundColor: '#F4F7F5',
  },
});
