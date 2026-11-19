/**
 * Season 2 Show Faith-only read-only Daily Proverbs card for Community Wall.
 * Does not create posts, grant points, or change ad/feed lifecycle.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { AppState, Pressable, Text, View } from 'react-native';
import { useBuklodLifeLanguage } from '@/hooks/useBuklodLifeLanguage';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { dailyProverbForDate, manilaProverbsDate, millisecondsUntilNextManilaDate } from '@/lib/season2/buklodDailyProverbsR1';

type Props = { enabled?: boolean };
export default function BuklodSeason2ProverbsDailyVerse({ enabled }: Props) {
  const { activeScope } = useBuklodScope();
  const { colors } = useBuklodPresentation();
  const language = useBuklodLifeLanguage();
  const { isConnected, isInternetReachable } = useNetwork();
  const showFaith = enabled ?? Boolean(activeScope?.show_faith_content);
  const [dateKey, setDateKey] = useState(() => manilaProverbsDate());
  const [localized, setLocalized] = useState<{ key: string; verse: string } | null>(null);
  const proverb = useMemo(() => dailyProverbForDate(dateKey), [dateKey]);
  const verseKey = 'ASD:20:' + proverb.chapter + ':' + proverb.verse;
  const syncDate = useCallback(() => setDateKey(manilaProverbsDate()), []);

  useFocusEffect(useCallback(() => { syncDate(); }, [syncDate]));
  useEffect(() => {
    // Wall kept open overnight must advance; foreground restores after sleep.
    const delay = Math.min(millisecondsUntilNextManilaDate(), 24 * 60 * 60 * 1000);
    const timer = setTimeout(syncDate, delay);
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') syncDate();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [dateKey, syncDate]);

  useEffect(() => {
    if (!showFaith || language !== 'fil') return;
    let active = true;
    const cacheKey = '@buklod/season2/proverbs/asd-v1:' + verseKey;
    void AsyncStorage.getItem(cacheKey).then(cached => {
      if (active && cached?.trim()) setLocalized({ key: verseKey, verse: cached.trim() });
    }).catch(() => undefined);
    if (isConnected === false || isInternetReachable === false) {
      return () => { active = false; };
    }
    void (async () => {
      try {
        const { data, error } = await withBuklodTimeout(
          (supabase as any).rpc('get_bible_chapter', {
            p_translation_code: 'ASD',
            p_book_no: 20,
            p_chapter_no: proverb.chapter,
          }),
          6000,
          'Daily Proverbs verse',
        );
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const exact = rows.find((row: any) =>
          Number(row.verse_no) === proverb.verse &&
          Number(row.chapter_no) === proverb.chapter &&
          Number(row.book_no) === 20
        );
        const verse = typeof exact?.verse_text === 'string' ? exact.verse_text.trim() : '';
        if (!verse) return;
        if (active) {
          setLocalized({ key: verseKey, verse });
          void AsyncStorage.setItem(cacheKey, verse).catch(() => undefined);
        }
      } catch {
        // Never delay or blank the Wall for weak connectivity or missing ASD.
        // Bundled public-domain KJV remains immediately readable offline.
      }
    })();
    return () => { active = false; };
  }, [showFaith, language, verseKey, proverb.chapter, proverb.verse, isConnected, isInternetReachable]);

  if (!showFaith) return null;
  const filipino = language === 'fil';
  const hasAsd = filipino && localized?.key === verseKey;
  const verse = hasAsd ? localized!.verse : proverb.kjv;
  const reference = 'Proverbs ' + proverb.chapter + ':' + proverb.verse;
  const formattedDate = new Intl.DateTimeFormat(
    filipino ? 'fil-PH' : 'en-PH',
    { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' },
  ).format(new Date(dateKey + 'T12:00:00+08:00'));

  return (
    <View
      accessibilityLabel={'Daily Proverbs, ' + reference}
      style={{
        backgroundColor: colors.greenSoft,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 15,
        marginHorizontal: 2,
        marginTop: 6,
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 7,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <MaterialCommunityIcons name="book-open-page-variant-outline" size={19} color={colors.greenDark} />
        <Text style={{ flex: 1, fontWeight: '900', fontSize: 13, color: colors.greenDark }}>
          {filipino ? 'KAWIKAAN NG ARAW' : 'DAILY PROVERBS'}
        </Text>
        <Text style={{ fontSize: 10, color: colors.greenDark }}>{formattedDate}</Text>
      </View>
      <Text selectable style={{ color: colors.text, fontSize: 15, lineHeight: 23, fontWeight: '600' }}>
        {'“' + verse + '”'}
      </Text>
      <Text style={{ color: colors.greenDark, fontWeight: '800', fontSize: 12 }}>
        {reference + ' · ' + (hasAsd ? 'ASD' : 'KJV')}
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>
        {filipino ? proverb.lessonFil : proverb.lessonEn}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filipino ? 'Buksan ang Kawikaan sa Bibliya' : 'Read this verse in My Bible'}
        onPress={() => router.push(
          ('/bible/read?book=20&chapter=' + proverb.chapter + '&verse=' + proverb.verse +
            '&translation=' + (filipino ? 'ASD' : 'KJV')) as any
        )}
        style={{ alignSelf: 'flex-start', paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        <Text style={{ color: colors.greenDark, fontWeight: '900', fontSize: 12 }}>
          {filipino ? 'BASAHIN SA BIBLIYA' : 'READ IN MY BIBLE'}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color={colors.greenDark} />
      </Pressable>
    </View>
  );
}
