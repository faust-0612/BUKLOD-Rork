import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { BuklodCityPoint } from '@/lib/buklodCity';
import {
  BuklodCityBulletin,
  BuklodBulletinNewsItem,
  getBuklodCityBulletin,
} from '@/lib/buklodCityBulletin';

function formatWhen(value?: string | null) {
  if (!value) return 'Latest';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Latest';
  try {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function weatherIcon(
  code?: number | null,
): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  if (code === 0) return 'weather-sunny';
  if (code != null && [1, 2].includes(code)) return 'weather-partly-cloudy';
  if (code === 3) return 'weather-cloudy';
  if (code != null && [45, 48].includes(code)) return 'weather-fog';
  if (code != null && [95, 96, 99].includes(code)) return 'weather-lightning-rainy';
  if (
    code != null &&
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
  ) {
    return 'weather-rainy';
  }
  return 'weather-partly-cloudy';
}

function safeNumber(value: unknown, suffix = '') {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}${suffix}` : '—';
}

function NewsRow({
  item,
  accent = '#35679D',
  onError,
}: {
  item: BuklodBulletinNewsItem;
  accent?: string;
  onError: (message: string) => void;
}) {
  const open = async () => {
    if (!item.url) {
      onError('This update does not have a source link yet.');
      return;
    }
    try {
      await Linking.openURL(item.url);
    } catch {
      onError('BUKLOD could not open the source link. Please try again.');
    }
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open source: ${item.title}`}
      onPress={() => void open()}
      style={({ pressed }) => [styles.newsRow, pressed && styles.pressed]}
    >
      <View style={[styles.newsDot, { backgroundColor: accent }]} />
      <View style={styles.newsCopy}>
        <Text numberOfLines={3} style={styles.newsTitle}>
          {item.title}
        </Text>
        <Text style={styles.newsMeta}>
          {item.source || 'News source'} · {formatWhen(item.publishedAt)}
        </Text>
      </View>
      <MaterialCommunityIcons name="open-in-new" size={16} color="#7890A4" />
    </Pressable>
  );
}

export function BuklodCommunityBulletinR6({
  latitude,
  longitude,
  locality,
  localItems,
  onOpenMapItem,
}: {
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  localItems: BuklodCityPoint[];
  onOpenMapItem?: (item: BuklodCityPoint) => void;
}) {
  const { width } = useWindowDimensions();
  const mobile = width < 760;
  const [data, setData] = useState<BuklodCityBulletin | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      quiet ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const next = await getBuklodCityBulletin({ latitude, longitude, locality });
        setData(next);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Community bulletin is temporarily unavailable.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [latitude, longitude, locality],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const announcements = useMemo(() => {
    return localItems
      .filter(
        item =>
          item.kind === 'EVENT' ||
          item.kind === 'SERVICE' ||
          item.kind === 'BAYANIHAN',
      )
      .sort((a, b) => String(b.startsAt || '').localeCompare(String(a.startsAt || '')))
      .slice(0, 5);
  }, [localItems]);

  const weather = data?.weather;
  const noClasses = data?.noClasses ?? [];
  const news = data?.news ?? [];

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>COMMUNITY BULLETIN</Text>
          <Text style={styles.title}>Latest Community Updates</Text>
          <Text style={styles.subtitle}>
            {locality || data?.locality || 'Your BUKLOD community'} · weather,
            suspensions, announcements & important news
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh community bulletin"
          disabled={refreshing}
          onPress={() => void load(true)}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && !refreshing && styles.pressed,
            refreshing && styles.disabled,
          ]}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#315E87" />
          ) : (
            <MaterialCommunityIcons name="refresh" size={20} color="#315E87" />
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#177552" />
          <Text style={styles.loadingText}>Loading latest community updates…</Text>
        </View>
      ) : null}

      {error ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss bulletin error"
          onPress={() => setError(null)}
          style={styles.errorBox}
        >
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#9A4C36" />
          <Text style={styles.errorText}>{error}</Text>
          <MaterialCommunityIcons name="close" size={16} color="#9A4C36" />
        </Pressable>
      ) : null}

      {!loading ? (
        <View style={[styles.grid, mobile && styles.gridMobile]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh latest weather"
            disabled={refreshing}
            onPress={() => void load(true)}
            style={({ pressed }) => [
              styles.card,
              styles.weatherCard,
              mobile && styles.cardMobile,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#EAF4FF' }]}>
                <MaterialCommunityIcons
                  name={weatherIcon(weather?.weatherCode)}
                  size={22}
                  color="#2877DD"
                />
              </View>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardKicker}>LATEST WEATHER</Text>
                <Text style={styles.cardTitle}>{weather?.condition || 'Weather update'}</Text>
              </View>
              <MaterialCommunityIcons name="refresh" size={16} color="#7890A4" />
            </View>
            {weather && !weather.error ? (
              <>
                <Text style={styles.weatherTemp}>{safeNumber(weather.temperatureC, '°C')}</Text>
                <Text style={styles.weatherMeta}>
                  Feels like {safeNumber(weather.apparentTemperatureC, '°C')} · Humidity{' '}
                  {safeNumber(weather.humidityPercent, '%')}
                </Text>
                <View style={styles.weatherStats}>
                  <View style={styles.weatherStat}>
                    <Text style={styles.weatherStatValue}>
                      {safeNumber(weather.precipitationProbabilityPercent, '%')}
                    </Text>
                    <Text style={styles.weatherStatLabel}>Rain chance</Text>
                  </View>
                  <View style={styles.weatherStat}>
                    <Text style={styles.weatherStatValue}>
                      {safeNumber(weather.windKph, ' km/h')}
                    </Text>
                    <Text style={styles.weatherStatLabel}>Wind</Text>
                  </View>
                  <View style={styles.weatherStat}>
                    <Text style={styles.weatherStatValue}>
                      {safeNumber(weather.precipitationMm, ' mm')}
                    </Text>
                    <Text style={styles.weatherStatLabel}>Current rain</Text>
                  </View>
                </View>
                <Text style={styles.sourceLine}>
                  Updated {formatWhen(weather.observedAt)} · Source: {weather.source || 'Open-Meteo'} · tap to refresh
                </Text>
              </>
            ) : (
              <Text style={styles.emptyText}>
                {weather?.error || 'Weather is temporarily unavailable. Tap to retry.'}
              </Text>
            )}
          </Pressable>

          <View style={[styles.card, styles.suspensionCard, mobile && styles.cardMobile]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#FFF3E5' }]}>
                <MaterialCommunityIcons name="school-outline" size={22} color="#B16A14" />
              </View>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardKicker}>WALANG PASOK / CLASS SUSPENSIONS</Text>
                <Text style={styles.cardTitle}>Latest reports</Text>
              </View>
            </View>
            {noClasses.length ? (
              noClasses.slice(0, 4).map(item => (
                <NewsRow
                  key={`${item.url}-${item.title}`}
                  item={item}
                  accent="#B16A14"
                  onError={setError}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>
                No recent matching suspension report was found. This does not mean classes are automatically on.
              </Text>
            )}
            <Text style={styles.cautionText}>
              Always verify with your school, LGU, or DepEd before acting on a suspension report.
            </Text>
          </View>

          <View style={[styles.card, mobile && styles.cardMobile]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#EAF7F1' }]}>
                <MaterialCommunityIcons name="bullhorn-outline" size={22} color="#177552" />
              </View>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardKicker}>PUBLIC ANNOUNCEMENTS</Text>
                <Text style={styles.cardTitle}>BUKLOD local notices</Text>
              </View>
            </View>
            {announcements.length ? (
              announcements.map(item => (
                <Pressable
                  key={`${item.kind}-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${item.title} on the BUKLOD City map`}
                  onPress={() => onOpenMapItem?.(item)}
                  style={({ pressed }) => [styles.noticeRow, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons
                    name={
                      item.kind === 'EVENT'
                        ? 'calendar-star'
                        : item.kind === 'SERVICE'
                          ? 'hand-heart-outline'
                          : 'account-group-outline'
                    }
                    size={18}
                    color="#177552"
                  />
                  <View style={styles.newsCopy}>
                    <Text style={styles.newsTitle}>{item.title}</Text>
                    <Text style={styles.newsMeta}>
                      {item.subtitle || item.locality || item.kind}
                      {item.startsAt ? ` · ${formatWhen(item.startsAt)}` : ''}
                    </Text>
                    {item.description ? (
                      <Text numberOfLines={2} style={styles.noticeDescription}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialCommunityIcons name="map-marker-radius-outline" size={17} color="#177552" />
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No current BUKLOD event, service, or Bayanihan notice is posted for this area.
              </Text>
            )}
          </View>

          <View style={[styles.card, mobile && styles.cardMobile]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#F0EEFF' }]}>
                <MaterialCommunityIcons
                  name="newspaper-variant-outline"
                  size={22}
                  color="#7254C8"
                />
              </View>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardKicker}>IMPORTANT NEWS</Text>
                <Text style={styles.cardTitle}>Recent local/public advisories</Text>
              </View>
            </View>
            {news.length ? (
              news.slice(0, 5).map(item => (
                <NewsRow
                  key={`${item.url}-${item.title}`}
                  item={item}
                  accent="#7254C8"
                  onError={setError}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>
                No recent matching important-news item was found for this locality.
              </Text>
            )}
          </View>
        </View>
      ) : null}

      <Text style={styles.footerNote}>
        Bulletin items show source and time when available. News discovery is not an official suspension authority.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 4,
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: '#DFE8ED',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#177552',
  },
  title: { marginTop: 2, color: '#20384B', fontSize: 20, lineHeight: 25, fontWeight: '900' },
  subtitle: { marginTop: 3, color: '#708394', fontSize: 10, lineHeight: 14 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE6EC',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
  cardPressed: { opacity: 0.86 },
  loadingBox: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#6D8190', fontSize: 10 },
  errorBox: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    borderRadius: 13,
    backgroundColor: '#FFF4EF',
    borderWidth: 1,
    borderColor: '#F1D6C9',
  },
  errorText: { flex: 1, minWidth: 0, color: '#914A35', fontSize: 10, lineHeight: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridMobile: { flexDirection: 'column' },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 280,
    maxWidth: '100%',
    padding: 13,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E9EF',
  },
  cardMobile: { flexBasis: 'auto', minWidth: 0, width: '100%' },
  weatherCard: { backgroundColor: '#FBFDFF' },
  suspensionCard: { backgroundColor: '#FFFDF9' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  cardIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardHeaderCopy: { flex: 1, minWidth: 0 },
  cardKicker: { color: '#6D8190', fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.7 },
  cardTitle: { marginTop: 1, color: '#294154', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  weatherTemp: { color: '#20384B', fontSize: 34, lineHeight: 39, fontWeight: '900' },
  weatherMeta: { marginTop: 1, color: '#6D8190', fontSize: 10, lineHeight: 14 },
  weatherStats: { flexDirection: 'row', gap: 7, marginTop: 10 },
  weatherStat: { flex: 1, minWidth: 0, padding: 9, borderRadius: 12, backgroundColor: '#F3F7FA' },
  weatherStatValue: { color: '#294154', fontSize: 11, fontWeight: '900' },
  weatherStatLabel: { marginTop: 2, color: '#7A8B99', fontSize: 8, lineHeight: 11 },
  sourceLine: { marginTop: 9, color: '#8293A1', fontSize: 8, lineHeight: 11 },
  newsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E7EDF1',
  },
  newsDot: { width: 6, height: 6, borderRadius: 999 },
  newsCopy: { flex: 1, minWidth: 0 },
  newsTitle: { color: '#30495C', fontSize: 10, lineHeight: 14, fontWeight: '800' },
  newsMeta: { marginTop: 2, color: '#8293A1', fontSize: 8, lineHeight: 11 },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E7EDF1',
  },
  noticeDescription: { marginTop: 3, color: '#6E8191', fontSize: 9, lineHeight: 13 },
  emptyText: { color: '#718494', fontSize: 10, lineHeight: 15, paddingVertical: 8 },
  cautionText: {
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FFF4E5',
    color: '#8D5B1B',
    fontSize: 8,
    lineHeight: 12,
  },
  footerNote: { marginTop: 10, color: '#81919F', fontSize: 8, lineHeight: 12 },
});
