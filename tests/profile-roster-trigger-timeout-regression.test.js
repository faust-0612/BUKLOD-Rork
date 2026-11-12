const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20261112090000_optimize_roster_sync_profile_save_timeout.sql'), 'utf8');

describe('profile-save Classroom roster trigger optimization', () => {
  test('skips the all-profile competitor scan unless a fuzzy match is possible', () => {
    expect(sql).toContain('elsif v_score >= 0.97 then');
    expect(sql).toContain('v_second := 0;');
    expect(sql).not.toContain('    else\\n      select coalesce(max(public.buklod_classroom_roster_name_similarity_v1(');
  });
  test('retains exact identity match, review, and enrollment safeguards', () => {
    const invariants = [
      'SECURITY DEFINER', "SET search_path TO ''", 'PROFILE_SYNC_USERNAME_EXACT',
      'PROFILE_SYNC_OFFICIAL_TOKEN_EXACT', 'PROFILE_SYNC_OFFICIAL_STRICT_FUZZY',
      'and v_score >= 0.97', 'and (v_score-v_second) >= 0.15',
      'insert into public.buklod_education_enrollments',
      'update public.buklod_classroom_roster_intents_v1',
      'exception when others then',
    ];
    for (const fragment of invariants) expect(sql).toContain(fragment);
  });
});
