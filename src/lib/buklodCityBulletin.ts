import { supabase } from '@/lib/supabase';

export type BuklodBulletinNewsItem = {
  title: string;
  url: string;
  source?: string | null;
  publishedAt?: string | null;
};

export type BuklodBulletinWeather = {
  temperatureC?: number | null;
  apparentTemperatureC?: number | null;
  humidityPercent?: number | null;
  precipitationMm?: number | null;
  precipitationProbabilityPercent?: number | null;
  windKph?: number | null;
  weatherCode?: number | null;
  condition?: string | null;
  observedAt?: string | null;
  timezone?: string | null;
  source?: string | null;
  error?: string | null;
};

export type BuklodCityBulletin = {
  generatedAt?: string | null;
  locality?: string | null;
  weather?: BuklodBulletinWeather | null;
  noClasses: BuklodBulletinNewsItem[];
  news: BuklodBulletinNewsItem[];
  sourceNote?: string | null;
};

function asNewsItems(value: unknown): BuklodBulletinNewsItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? '').trim();
      const url = String(row.url ?? '').trim();
      if (!title || !url) return null;
      return {
        title,
        url,
        source: row.source ? String(row.source) : null,
        publishedAt: row.publishedAt ? String(row.publishedAt) : null,
      };
    })
    .filter(Boolean) as BuklodBulletinNewsItem[];
}

export async function getBuklodCityBulletin(input: {
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
}): Promise<BuklodCityBulletin> {
  const { data, error } = await supabase.functions.invoke('buklod-city-bulletin', {
    body: {
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      locality: input.locality ?? null,
    },
  });
  if (error) throw error;
  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok === false) throw new Error(String(payload.error ?? 'Bulletin service unavailable.'));
  return {
    generatedAt: payload.generatedAt ? String(payload.generatedAt) : null,
    locality: payload.locality ? String(payload.locality) : null,
    weather: payload.weather && typeof payload.weather === 'object' ? payload.weather as BuklodBulletinWeather : null,
    noClasses: asNewsItems(payload.noClasses),
    news: asNewsItems(payload.news),
    sourceNote: payload.sourceNote ? String(payload.sourceNote) : null,
  };
}
