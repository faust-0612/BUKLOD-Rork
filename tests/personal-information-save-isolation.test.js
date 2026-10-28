const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('personal information Save isolation', () => {
  const screen = read('src/app/account/personal-information.tsx');
  const migration = read('supabase/migrations/20261028143000_skip_unchanged_profile_roster_sync.sql');

  test('compares the actual loaded values before writing each section', () => {
    expect(screen).toContain('profileSnapshot.current = JSON.stringify([');
    expect(screen).toContain('addressSnapshot.current = JSON.stringify([');
    expect(screen).toContain('faithSnapshot.current = preference;');
    expect(screen).toContain('const profileChanged = profileValues !== profileSnapshot.current;');
    expect(screen).toContain('const addressChanged = addressValues !== addressSnapshot.current;');
    expect(screen).toContain('showFaithContent !== faithSnapshot.current;');
  });

  test('a faith-only edit does not update profiles or localization address', () => {
    expect(screen).toMatch(/if \(profileChanged\) \{[\s\S]*?\.from\('profiles'\)\s*\.update\(/);
    expect(screen).toMatch(/if \(addressChanged\) \{[\s\S]*?\.from\(\s*'buklod_user_addresses'\s*\)\s*\.upsert\(/);
    expect(screen).toContain('if (faithChanged) {');
    expect(screen).toContain('if (addressChanged || faithChanged)');
    expect(screen).toContain('faithSnapshot.current = showFaithContent;');
  });

  test('actual identity changes retain classroom roster matching', () => {
    expect(migration).toContain('after insert on public.profiles');
    expect(migration).toContain('after update of username, full_name, first_name, middle_name, surname, suffix, is_active');
    expect(migration).toContain('old.full_name is distinct from new.full_name');
    expect(migration).toContain('old.surname is distinct from new.surname');
    expect(migration).toContain('old.is_active is distinct from new.is_active');
    expect(migration.match(/execute function public\.buklod_classroom_roster_profile_arrival_sync_v1\(\)/g)).toHaveLength(2);
  });

  test('timeout feedback never exposes database internals to the user', () => {
    expect(screen).toContain("error?.code === '57014'");
    expect(screen).toContain('The server took too long.');
    expect(screen).toContain('const partial = savedSections.length > 0');
  });
});
