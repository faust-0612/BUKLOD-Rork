import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type AdminSeries = {
  season_number: number;
  title: string;
  description: string;
  total_chapters: number;
  approved_chapters: number;
  released_chapters: number;
};

export default function KlSeriesAdminPanel({ selectedSeason, onChooseSeries, busy = false }: {
  selectedSeason: number;
  onChooseSeries: (seasonNumber: number) => void;
  busy?: boolean;
}) {
  const { user } = useAuth();
  const sequence = useRef(0);
  const [rows, setRows] = useState<AdminSeries[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('kl_s2_admin_series_catalog_v1');
      if (request !== sequence.current) return;
      if (error || !Array.isArray(data)) {
        setAvailable(false);
        setRows([]);
      } else {
        setAvailable(true);
        setRows((data as AdminSeries[]).filter(s =>
          Number.isInteger(s.season_number) && s.season_number >= 1 && s.season_number <= 12));
      }
    } catch {
      if (request === sequence.current) { setAvailable(false); setRows([]); }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
    return () => { sequence.current += 1; };
  }, [refresh]);

  useEffect(() => {
    const row = rows.find(s => s.season_number === selectedSeason);
    setTitle(row?.title ?? (selectedSeason === 1 ? 'Ang Lupang Hindi Namamatay' : ''));
    setDescription(row?.description ?? '');
    setNotice('');
  }, [selectedSeason, rows]);

  const save = async () => {
    if (saving || busy || !available) return;
    if (title.trim().length < 3 || title.trim().length > 120 ||
        description.trim().length > 600) {
      setNotice('Kailangan ang pamagat (3–120 karakter) at description na hanggang 600 karakter.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const { data, error } = await supabase.rpc('kl_s2_admin_save_series_v1', {
        p_season_number: selectedSeason,
        p_title: title.trim(),
        p_description: description.trim(),
      });
      if (error || (data as { ok?: boolean } | null)?.ok !== true)
        throw error ?? new Error('Hindi nakumpirma ang pag-save.');
      await refresh();
      setNotice('Na-save sa admin. Hindi nakikita ng readers ang serye hangga’t walang released na kabanata.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Hindi na-save ang serye.');
    } finally { setSaving(false); }
  };

  return (
    <View style={{ padding: 12, borderWidth: 1, borderColor: '#537263', borderRadius: 10, gap: 9 }}>
      <Text style={{ color: '#f1d39b', fontSize: 17, fontWeight: '800' }}>Mga Serye · Admin</Text>
      <Text style={{ color: '#ceded5', lineHeight: 19 }}>
        Itakda ang pamagat at description. Gumawa ng Chapter 1 sa editor sa ibaba,
        saka manuscript, illustrations, preview, approval, awtomatikong pagbuo ng 5 reading questions, at release. Walang manual quiz review.
        Pag may released na kabanata, kusang lalabas ang serye sa KL Dashboard.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {rows.map(item => (
          <Pressable accessibilityRole="button" key={item.season_number}
            disabled={busy || saving} onPress={() => onChooseSeries(item.season_number)}
            style={{ backgroundColor: selectedSeason === item.season_number ? '#446d54' : '#2a4545',
              padding: 10, borderRadius: 8, minHeight: 44 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Serye {item.season_number}</Text>
            <Text style={{ color: '#d3dfd7', fontSize: 11 }}>
              {item.released_chapters} released · {item.approved_chapters} approved · {item.total_chapters} created
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: '#fff', fontWeight: '700' }}>Serye {selectedSeason} · Pamagat</Text>
      <TextInput accessibilityLabel="Pamagat ng serye"
        style={{ color: '#fff', borderColor: '#58705f', borderWidth: 1, borderRadius: 8, padding: 10 }}
        value={title} onChangeText={setTitle} maxLength={120}
        placeholder="Pamagat ng panibagong serye" placeholderTextColor="#aeb4bb" />
      <TextInput accessibilityLabel="Paglalarawan ng serye"
        style={{ color: '#fff', borderColor: '#58705f', borderWidth: 1, borderRadius: 8,
          padding: 10, minHeight: 72, textAlignVertical: 'top' }}
        multiline maxLength={600} value={description} onChangeText={setDescription}
        placeholder="Maikling spoiler-free na paglalarawan sa reader dashboard"
        placeholderTextColor="#aeb4bb" />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || saving || !available }}
        disabled={busy || saving || !available} onPress={() => { void save(); }}
        style={{ backgroundColor: busy || saving || !available ? '#586762' : '#315d48',
          padding: 12, minHeight: 44, justifyContent: 'center', borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{saving ? 'Sine-save…' : 'I-save ang serye (private muna)'}</Text>
      </Pressable>
      {!available ? <Text style={{ color: '#f7dba9' }}>
        {loading ? 'Kinukuha ang series catalog…' :
          'Season 2 staging database pa ang kailangan para ma-save ang metadata. Hindi naapektuhan ang kasalukuyang chapter editor.'}
      </Text> : null}
      {notice ? <Text accessibilityRole="alert" style={{ color: '#f5dcad' }}>{notice}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => { void refresh(); }} disabled={loading}>
        <Text style={{ color: '#d8ecc6' }}>{loading ? 'Naglo-load…' : 'I-refresh ang mga serye'}</Text>
      </Pressable>
    </View>
  );
}
