type BulletinRequest = {
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
};

type NewsItem = {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function xmlDecode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function tag(item: string, name: string) {
  const match = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? clean(xmlDecode(match[1])) : '';
}

function sourceName(item: string) {
  const match = item.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
  return match ? clean(xmlDecode(match[1])) : null;
}

function parseGoogleNewsFeed(xml: string): NewsItem[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return blocks
    .map(block => {
      const source = sourceName(block);
      let title = tag(block, 'title');
      if (source && title.endsWith(` - ${source}`)) {
        title = title.slice(0, -(source.length + 3));
      }
      const url = tag(block, 'link');
      const pubDate = tag(block, 'pubDate');
      const parsedDate = pubDate ? new Date(pubDate) : null;
      return {
        title: clean(title),
        url: clean(url),
        source,
        publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
      };
    })
    .filter(item => Boolean(item.title && item.url));
}

async function fetchGoogleNews(query: string, limit = 5) {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-PH');
  url.searchParams.set('gl', 'PH');
  url.searchParams.set('ceid', 'PH:en');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BUKLOD Community Bulletin/1.0',
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
  });
  if (!response.ok) throw new Error(`Google News RSS HTTP ${response.status}`);
  const xml = await response.text();
  return parseGoogleNewsFeed(xml).slice(0, limit);
}

function weatherLabel(code: number) {
  if (code === 0) return 'Clear';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([85, 86].includes(code)) return 'Snow showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Weather update';
}

async function fetchWeather(latitude: number, longitude: number) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m');
  url.searchParams.set('hourly', 'precipitation_probability');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
  const data = await response.json();
  const currentTime = clean(data?.current?.time);
  const times: string[] = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
  const probabilities: number[] = Array.isArray(data?.hourly?.precipitation_probability) ? data.hourly.precipitation_probability : [];
  let probability: number | null = null;
  if (currentTime && times.length) {
    const hourKey = currentTime.slice(0, 13);
    const index = times.findIndex(value => String(value).slice(0, 13) === hourKey);
    if (index >= 0 && Number.isFinite(Number(probabilities[index]))) probability = Number(probabilities[index]);
  }
  const code = Number(data?.current?.weather_code ?? -1);
  return {
    temperatureC: Number(data?.current?.temperature_2m),
    apparentTemperatureC: Number(data?.current?.apparent_temperature),
    humidityPercent: Number(data?.current?.relative_humidity_2m),
    precipitationMm: Number(data?.current?.precipitation),
    precipitationProbabilityPercent: probability,
    windKph: Number(data?.current?.wind_speed_10m),
    weatherCode: code,
    condition: weatherLabel(code),
    observedAt: currentTime || new Date().toISOString(),
    timezone: clean(data?.timezone) || 'auto',
    source: 'Open-Meteo',
  };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as BulletinRequest;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const locality = clean(body.locality).slice(0, 120);

    const weatherPromise = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? fetchWeather(latitude, longitude).catch(error => ({ error: error instanceof Error ? error.message : String(error) }))
      : Promise.resolve(null);

    const localityQuery = locality ? ` ${locality}` : '';
    const suspensionQuery = `("walang pasok" OR "classes suspended" OR "class suspension")${localityQuery} Philippines when:3d`;
    const importantQuery = `${locality || 'Philippines'} Philippines (advisory OR emergency OR weather OR traffic OR health OR government) when:2d`;

    const [weather, noClasses, news] = await Promise.all([
      weatherPromise,
      fetchGoogleNews(suspensionQuery, 6).catch(() => []),
      fetchGoogleNews(importantQuery, 6).catch(() => []),
    ]);

    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      locality: locality || null,
      weather,
      noClasses,
      news,
      sourceNote: 'News items are discovered through Google News RSS and retain the publisher name. Verify class suspensions with the school, LGU, or DepEd before acting.',
    }, {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500, headers: CORS_HEADERS });
  }
});
