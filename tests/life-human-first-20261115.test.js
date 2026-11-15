const fs = require('node:fs');
const path = require('node:path');
const source = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('BUKLOD LIFE human-first completion privacy contract', () => {
  test('LIFE starts with practical needs and exposes twelve distinct support entries', () => {
    const home = source('src/app/life/index.tsx');
    const support = source('src/app/life/support.tsx');
    const guide = source('src/lib/buklodLifeGuide.ts');
    const concerns = [...guide.matchAll(/\{ key:'([^']+)', label:/g)].map(x => x[1]);
    expect(new Set(concerns).size).toBe(12);
    expect(home).toContain('BUKLOD_LIFE_CONCERNS.map(');
    expect(home).toContain("'/life/support'");
    expect(support).toContain('topic.practical[lang]');
    expect(support).toContain('setRequested(true)');
    expect(support).toContain('activeScope?.show_faith_content');
  });

  test('not a religious-only Wall: faith routes voluntary and opt-out respected', () => {
    const home = source('src/app/life/index.tsx');
    const topic = source('src/app/life/topic.tsx');
    const guide = source('src/app/life/guide.tsx');
    expect(home).toContain('showFaithContent && (');
    const tabs = source('src/components/BuklodLifeTabs.tsx');
    expect(tabs).toContain("'Share'");
    expect(tabs).not.toContain("'Share Jesus'");
    expect(topic).toContain('showFaithContent && stage >= 1');
    expect(topic).toContain('<Redirect href="/life" />');
    expect(guide).toContain('<BuklodFaithRouteBoundary>');
    expect(guide).toContain('setAllowed(true)');
    expect(guide).toContain('No pressure');
  });

  test('no navigation tap creates remote spiritual status, notification or cash incentive', () => {
    const topic = source('src/app/life/topic.tsx');
    const invite = source('src/app/life/invite.tsx');
    const guide = source('src/app/life/guide.tsx');
    const sql = source('supabase/migrations/20261115125000_buklod_life_no_inferred_milestones.sql');
    expect(topic).not.toContain('markMyBuklodLifeStage');
    expect(invite).not.toContain('markMyBuklodLifeStage');
    expect(topic).toContain('saveBuklodLifePrivateProgress');
    expect(guide).toContain('no labels');
    expect(sql).not.toContain('insert into public.notifications');
    expect(sql).toContain('Backwards-compatible no-op');
    expect(sql).toContain("'recent_activity', '[]'::jsonb");
  });

  test('sensitive checkpoints use device secure storage and never plaintext fallback', () => {
    const privateProgress = source('src/lib/buklodLifePrivateProgress.ts');
    expect(privateProgress).toContain("from 'expo-secure-store'");
    expect(privateProgress).toContain('getItemAsync');
    expect(privateProgress).toContain('deleteItemAsync');
    expect(privateProgress).not.toContain("from '@react-native-async-storage/async-storage'");
    const impact = source('src/app/life/impact.tsx');
    expect(impact).toContain('loadBuklodLifePrivateProgress');
    expect(impact).toContain('clearBuklodLifePrivateProgress');
    expect(impact).not.toContain('faith_journeys_started');
  });

  test('gospel has a six-part reference registry and ten authored question references', () => {
    const content = source('src/lib/buklodLifeContent.ts');
    const scripture = source('src/lib/buklodLifeScripture.ts');
    const topic = source('src/app/life/topic.tsx');
    const match = scripture.match(/export const BUKLOD_LIFE_GOSPEL_REFERENCES = \[([\s\S]*?)\] as const;/);
    expect(match).toBeTruthy();
    expect((match[1].match(/reference:/g) || []).length).toBe(6);
    expect((scripture.match(/'1 Corinthians 15:3–8, 14'/g) || []).length).toBe(1);
    expect(content).toContain('Bakit hindi sapat ang pagiging mabuting tao?');
    expect(content).toContain('Why do Christians believe Jesus rose from the dead?');
    expect(topic).toContain('BUKLOD_LIFE_QUESTION_REFERENCES');
    expect(topic).toContain('BUKLOD_LIFE_GOSPEL_REFERENCES');
  });

  test('registration honors LIFE invite opt-in but preserves normal Wall destination', () => {
    const reg = source('src/app/(auth)/register.tsx');
    expect(reg).toContain("params.life === '1'");
    expect(reg).toContain("'/life/invite'");
    expect(reg).toContain("router.replace('/(tabs)/buklod')");
    const invite = source('src/app/life/invite.tsx');
    expect(invite).toContain("'/(tabs)/buklod'");
    expect(invite).toContain('Maaari mong balikan ang LIFE');
  });

  test('impact masks legacy inferred spiritual metrics until privacy migration is live', () => {
    const impact = source('src/lib/buklodLifeImpact.ts');
    expect(impact).toContain('Do not expose legacy third-party spiritual milestones');
    expect(impact).toContain('people_reached: cached.people_reached');
  });
});
