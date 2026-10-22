import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`BUKLOD City QA missing ${label}: ${text}`);
}

/*
 * BUKLOD_CITY_WEB_CONTRACT_R2
 *
 * City route pages are now compatibility redirects into Community Wall.
 * Presence / map contracts live in the shared City dashboard + map modules
 * and backend RPCs/migrations — not in the thin city.web.tsx alias.
 */
const cityWeb = read('src/app/city.web.tsx');
const cityNative = read('src/app/city.tsx');
const indexWeb = read('src/app/index.web.tsx');
const indexNative = read('src/app/index.tsx');
const cityClient = read('src/lib/buklodCity.ts');
const mapWeb = read('src/components/BuklodCityMap.web.tsx');
const cityDashboard = read('src/components/BuklodCityDashboardR6.web.tsx');
const migration = read('supabase/migrations/20260915183000_buklod_city_web_r1.sql');
const migrationB = read('supabase/migrations/20260915184500_buklod_city_web_r1b.sql');
const migrationC = read('supabase/migrations/20260915185500_buklod_city_web_r1c.sql');

requireText(indexWeb, 'BUKLOD_CITY_WEB_HOME_R1', 'web-only home marker');
requireText(indexWeb, '<Redirect href="/city" />', 'web City boot');
requireText(indexNative, 'href="/(tabs)/buklod"', 'native Community Wall boot');

requireText(cityWeb, 'Compatibility alias for old web BUKLOD City links', 'web City redirect alias');
requireText(cityWeb, '<Redirect href="/(tabs)/buklod" />', 'web City → Community Wall');
requireText(cityNative, 'Compatibility alias for old BUKLOD City links', 'native City redirect alias');
requireText(cityNative, '<Redirect href="/(tabs)/buklod" />', 'native City → Community Wall');

requireText(cityDashboard, 'Share my presence', 'opt-in people presence');
requireText(cityDashboard, "'APPROXIMATE' | 'EXACT'", 'presence precision modes');
requireText(cityDashboard, "'APPROXIMATE'", 'approximate location default');
requireText(
  cityDashboard,
  'Government categorization remains restricted to authorized system verification.',
  'government verification notice'
);

requireText(cityClient, 'buklod_city_map_snapshot_v1', 'City snapshot RPC');
requireText(cityClient, 'buklod_city_set_presence_v1', 'presence write RPC');
requireText(cityClient, 'buklod_city_set_scope_location_v1', 'scope location RPC');
requireText(mapWeb, 'OpenStreetMap contributors', 'OSM attribution');
requireText(mapWeb, 'https://{s}.tile.openstreetmap.org', 'real OSM tiles');
requireText(migration, "precision_mode text not null default 'APPROXIMATE'", 'backend approximate default');
requireText(migration, "if v_category = 'government' and not public.buklod_is_system_admin()", 'government backend guard');
requireText(migration, 'revoke all on public.buklod_city_presence from anon, authenticated', 'direct presence read revocation');
requireText(migration, 'round(p.latitude::numeric, 2)', 'approximate latitude masking');
requireText(migration, 'round(p.longitude::numeric, 2)', 'approximate longitude masking');
requireText(migrationB, "'isMember', coalesce(vs.is_member, false)", 'activity My Places membership');
requireText(migrationB, "'canManage', coalesce(vs.can_manage, false)", 'activity My Places admin visibility');
requireText(migrationC, 'revoke execute on function public.buklod_city_map_snapshot_v1() from anon', 'anonymous snapshot revoke');
requireText(migrationC, 'revoke execute on function public.buklod_city_set_presence_v1', 'anonymous presence write revoke');

if (cityNative.includes('leaflet') || cityNative.includes('openstreetmap.org')) {
  throw new Error('Native City route must not acquire the web map implementation.');
}

if (cityWeb.includes('leaflet') || cityWeb.includes('openstreetmap.org')) {
  throw new Error('Web City route alias must remain a redirect; map stays in shared components.');
}

console.log('BUKLOD City Web R1 release contract: PASS');
