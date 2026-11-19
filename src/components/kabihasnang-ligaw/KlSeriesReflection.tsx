import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';

// Series-specific, spoiler-conscious system reflection shown after all chapters.
// The member's private response is required separately; system copy earns no BP.
const SERIES_TAKEAWAYS: Record<number, string> = {
  1: 'Ipinapaalala ng Ang Lupang Hindi Namamatay na ang tunay na lakas ay makikita sa ating mga pasya, pananagutan, at pakikinig sa kapwa—hindi lamang sa kapangyarihang hawak natin.',
};
type Status = { ok?: boolean; enabled?: boolean; ready?: boolean; submitted?: boolean; reward_claimed?: boolean };
type Result = { ok?: boolean; reason?: string; new_reward?: boolean; series_points?: number };
const REASONS: Record<string, string> = {
  reflection_minimum_50: 'Sumulat ng hindi bababa sa 50 karakter.',
  reflection_needs_personal_thought: 'Magbahagi ng tunay na pagninilay sa ilang magkakaibang salita at pangungusap.',
  complete_all_chapters_first: 'Kailangan munang ma-verify ang lahat ng 30 kabanata.',
  season_not_active: 'Hindi pa aktibo ang bagong series reflection reward.',
  final_chapter_not_released: 'Hindi pa available ang huling kabanata.',
};

export default function KlSeriesReflection({
  seasonNumber, refreshToken = 0,
}: { seasonNumber: number; refreshToken?: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [reflection, setReflection] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('kl_s2_series_reflection_status_v1', {
          p_season_number: seasonNumber,
        });
        if (active && !error && data && typeof data === 'object')
          setStatus(data as Status);
      } catch { /* Do not show an unverified reward form offline. */ }
    })();
    return () => { active = false; };
  }, [seasonNumber, refreshToken]);

  // When S2 is OFF, neither the older member UI nor rewards change.
  if (!status?.ok || status.enabled !== true || !status.ready) return null;
  const claimed = status.reward_claimed === true;
  const normalized = reflection.trim().replace(/\s+/g, ' ');
  const characterCount = Array.from(normalized).length;
  const submit = async () => {
    if (busy || claimed || characterCount < 50) return;
    setBusy(true); setMessage('');
    try {
      const { data, error } = await supabase.rpc('kl_s2_submit_series_reflection_v1', {
        p_season_number: seasonNumber, p_reflection: normalized,
      });
      if (error) throw error;
      const result = data as Result | null;
      if (result?.ok && result.series_points !== undefined) {
        setStatus(previous => ({ ...previous, submitted: true, reward_claimed: true }));
        setMessage(result.new_reward
          ? 'Naaprubahan ang iyong repleksyon. +50 BP ang na-credit!'
          : 'Naaprubahan na ang iyong series completion. Walang dobleng puntos.');
      } else setMessage(REASONS[result?.reason ?? ''] ?? 'Hindi pa maaprubahan ang repleksyon. Suriin at subukan muli.');
    } catch {
      setMessage('Hindi makumpirma ang repleksyon. Suriin ang koneksiyon bago muling isumite.');
    } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 9, padding: 12, borderRadius: 12, backgroundColor: '#203b34' }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: '#f1d39b' }}>Pagninilay matapos ang serye</Text>
      <Text style={{ color: '#fff', lineHeight: 23 }}>
        {SERIES_TAKEAWAYS[seasonNumber] ??
          'Sa pagtatapos ng serye, pagnilayan ang mga pasya, pananagutan at aral na maaari mong maiugnay sa sarili at sa buhay ng tao.'}
      </Text>
      {claimed ? (
        <Text accessibilityRole="alert" style={{ color: '#c2f3d3', fontWeight: '700' }}>
          Kumpleto na ang iyong serye at naitala na ang 50 BP completion bonus.
        </Text>
      ) : (
        <>
          <Text style={{ color: '#fff' }}>
            Ano ang natutuhan mo sa buong serye? Paano ito konektado sa buhay ng tao at sa sarili mong karanasan?
          </Text>
          <TextInput
            value={reflection} onChangeText={setReflection} multiline
            maxLength={2000} editable={!busy}
            placeholder="Isulat ang personal mong pagninilay…"
            placeholderTextColor="#aebbb3"
            accessibilityLabel="Personal na repleksyon sa buong serye"
            style={{ minHeight: 112, borderRadius: 9, padding: 11,
              textAlignVertical: 'top', color: '#fff', backgroundColor: '#304c43',
              borderWidth: 1, borderColor: '#69877a' }}
          />
          <Text style={{ color: '#d6e2db' }}>{characterCount}/50 minimum na karakter · +50 BP pagkatapos maaprubahan</Text>
          <Pressable accessibilityRole="button" disabled={busy || characterCount < 50}
            onPress={() => void submit()}
            style={{ padding: 12, borderRadius: 8,
              backgroundColor: busy || characterCount < 50 ? '#54635c' : '#2f7150' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>
              {busy ? 'Sinusuri ang repleksyon…' : 'Isumite at kunin ang +50 BP'}
            </Text>
          </Pressable>
        </>
      )}
      {message ? <Text accessibilityRole="alert" style={{ color: '#e9f6e9' }}>{message}</Text> : null}
    </View>
  );
}
