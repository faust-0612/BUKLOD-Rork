import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  BUKLOD_PLANNED_LANGUAGE_NAMES,
  type BuklodLanguagePreference,
} from '@/i18n/catalog';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';

export default function LanguagePreferenceScreen() {
  const {
    preference,
    languageName,
    availableLanguages,
    setPreference,
    t,
  } = useBuklodI18n();

  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return availableLanguages;
    return availableLanguages.filter(item =>
      item.englishName.toLowerCase().includes(needle) ||
      item.nativeName.toLowerCase().includes(needle),
    );
  }, [availableLanguages, query]);

  const apply = async (next: BuklodLanguagePreference) => {
    if (saving) return;
    setSaving(true);
    try {
      await setPreference(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          style={styles.back}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#24483A"
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('language.title')}</Text>
          <Text style={styles.subtitle}>{t('language.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.currentCard}>
          <Text style={styles.eyebrow}>{t('language.current')}</Text>
          <Text style={styles.current}>{languageName}</Text>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('language.search')}
          accessibilityLabel={t('language.search')}
          style={styles.search}
        />

        <Pressable
          disabled={saving}
          onPress={() => void apply('device')}
          style={[
            styles.row,
            preference === 'device' && styles.rowSelected,
          ]}
        >
          <MaterialCommunityIcons
            name="cellphone-cog"
            size={20}
            color="#275D45"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>
              {t('language.useDevice')}
            </Text>
            <Text style={styles.rowMeta}>{t('language.device')}</Text>
          </View>
          {preference === 'device' ? (
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color="#275D45"
            />
          ) : null}
        </Pressable>

        <Text style={styles.sectionTitle}>{t('language.choose')}</Text>

        {rows.map(item => {
          const selected = preference === item.code;
          return (
            <Pressable
              key={item.code}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => void apply(item.code)}
              style={[
                styles.row,
                selected && styles.rowSelected,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.nativeName}</Text>
                {item.nativeName !== item.englishName ? (
                  <Text style={styles.rowMeta}>{item.englishName}</Text>
                ) : null}
              </View>
              {selected ? (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color="#275D45"
                />
              ) : null}
            </Pressable>
          );
        })}

        <View style={styles.pendingCard}>
          <MaterialCommunityIcons
            name="translate"
            size={22}
            color="#6B766F"
          />
          <Text style={styles.pendingText}>
            {t('language.additionalPending')}
          </Text>
          <Text style={styles.planned}>
            {BUKLOD_PLANNED_LANGUAGE_NAMES.join(' • ')}
          </Text>
        </View>

        <Text style={styles.syncNote}>{t('language.synced')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E9E4',
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5F0',
  },
  title: { fontSize: 22, fontWeight: '900', color: '#21362B' },
  subtitle: { marginTop: 2, fontSize: 11, lineHeight: 16, color: '#6F7C75' },
  content: { padding: 16, paddingBottom: 120, gap: 9 },
  currentCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#EAF3ED',
    borderWidth: 1,
    borderColor: '#D6E6DC',
  },
  eyebrow: { fontSize: 9, fontWeight: '900', color: '#6A7A71', letterSpacing: 1 },
  current: { marginTop: 4, fontSize: 20, fontWeight: '900', color: '#275D45' },
  search: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E3DD',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: '#23372C',
  },
  sectionTitle: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '900',
    color: '#5F7067',
    letterSpacing: 0.8,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DDE6E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  rowSelected: {
    borderColor: '#79A68E',
    backgroundColor: '#EDF7F1',
  },
  rowTitle: { fontSize: 14, fontWeight: '900', color: '#263A30' },
  rowMeta: { marginTop: 2, fontSize: 10.5, color: '#748078' },
  pendingCard: {
    marginTop: 8,
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F0F2F1',
  },
  pendingText: { fontSize: 11, lineHeight: 17, color: '#606D66' },
  planned: { fontSize: 10, lineHeight: 16, color: '#87918C' },
  syncNote: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    color: '#7A867F',
  },
});
