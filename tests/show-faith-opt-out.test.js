const fs = require('node:fs');
const path = require('node:path');

const source = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

describe('personal Show Faith opt-out', () => {
  test('the scope resolver preserves the personal preference for all roles and scopes', () => {
    const migration = source('supabase/migrations/20261028140243_respect_personal_show_faith_opt_out.sql');
    expect(migration).toContain('v_faith_pref as show_faith_content');
    expect(migration).not.toMatch(/when s\.scope_type = 'CHURCH' then true/);
    expect(migration).not.toMatch(/faith_content_mandatory.*then true/);
  });

  test('MZB affiliation cannot force-enable the faith panel', () => {
    expect(source('src/lib/buklodScopeCapabilities.ts')).toContain(
      'faithPanel: Boolean(input.scope.show_faith_content),'
    );
    const mzb = source('src/components/BuklodMzbHomeWidgets.tsx');
    expect(mzb).toMatch(/scope\.show_faith_content\s*\?\s*\(\s*<View[^>]+>\s*<Text[^>]+>FAITH & FORMATION/);
  });

  test('all canonical faith route families are gated', () => {
    const routes = ['faith', 'bible', 'word', 'prayer', 'scope/faith-monitoring'];
    routes.forEach(route => {
      expect(source('src/app/' + route + '/_layout.tsx')).toContain(
        "export { default } from '@/components/BuklodFaithRouteBoundary'"
      );
    });
    const guard = source('src/components/BuklodFaithRouteBoundary.tsx');
    expect(guard).toContain('if (loading || !activeScope)');
    expect(guard).toContain('if (!activeScope.show_faith_content)');
    expect(guard).toContain('<Redirect href="/hub" />');
  });

  test('ungrouped prayer, share, impact and Formation entry screens also block opted-out users', () => {
    const screens = [
      'src/app/(tabs)/prayer.tsx',
      'src/app/life/share.tsx',
      'src/app/life/impact.tsx',
      'src/app/scope/buklod-lesson/index.tsx',
      'src/app/devotional/[id].tsx',
      'src/app/reflection/[id].tsx',
      'src/app/leader/bible.tsx',
    ];
    screens.forEach(screen => {
      expect(source(screen)).toContain('<BuklodFaithRouteBoundary>');
    });
  });

  test('existing user preference save refreshes scopes', () => {
    const settings = source('src/app/account/personal-information.tsx');
    expect(settings).toContain('show_faith_content:');
    expect(settings).toContain('refreshScopes(),');
  });
  test('faith notifications are suppressed in push, inbox and unread count', () => {
    const sql = source('supabase/migrations/20261028140243_respect_personal_show_faith_opt_out.sql');
    const policy = source('src/lib/buklodFaithNotificationPolicy.ts');
    const provider = source('src/providers/NotificationProvider.tsx');
    const inbox = source('src/app/notifications/index.tsx');
    expect(sql).toContain('before insert on public.notifications');
    expect(sql).toContain('p.show_faith_content is true');
    expect(policy).toContain("'formation_%'");
    expect(policy).toContain("'devotional_%'");
    expect(provider).toContain('showFaithNotifications || !isFaithNotificationKind(kind)');
    expect(provider).toContain("query=query.not('kind','ilike',pattern)");
    expect(inbox).toContain("query=query.not('kind','ilike',pattern)");
  });
  test('scoped OFF users receive motivational content instead of a blank faith section', () => {
    const home = source('src/components/BuklodScopeHomeDashboard.tsx');
    const cluster = source('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
    const portal = source('src/app/scope/index.tsx');
    const inspire = source('src/app/inspire/index.tsx');
    expect(home).toContain(': <BuklodNonFaithEncouragementDoor />');
    expect(cluster).toContain(': <BuklodNonFaithEncouragementDoor />');
    expect(portal).toContain(': <BuklodNonFaithEncouragementDoor />');
    expect(inspire).not.toContain("activeScope.scope_type !==");
    expect(inspire).toContain("if (Boolean(activeScope.show_faith_content))");
  });
});
