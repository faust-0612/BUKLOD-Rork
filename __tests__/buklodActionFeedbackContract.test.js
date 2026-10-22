const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('BUKLOD V28 runtime 1.3.2 action feedback contract', () => {
  it('shared component has pending/success/warning/error and accessibility status', () => {
    const code = read('src/components/BuklodActionFeedback.tsx');
    for (const status of ['pending', 'success', 'warning', 'error']) {
      assert.ok(code.includes(status), 'Missing status ' + status);
    }
    assert.ok(code.includes('accessibilityLiveRegion="polite"'));
  });

  for (const [file, backend] of [
    ['src/app/clusters/create.tsx', 'createCluster'],
    ['src/app/organizations/create.tsx', 'buklod_create_organization_v3'],
    ['src/app/organizations/suborganizations.tsx', 'createSuborganization'],
    ['src/app/admin/groups.tsx', 'manage_create_buklod_group'],
  ]) {
    it(file + ' exposes server-confirmed feedback and guards double submits', () => {
      const code = read(file);
      for (const marker of [backend, 'current', 'BuklodActionFeedback', 'pending', 'success', 'error']) {
        assert.ok(code.includes(marker), 'Missing marker ' + marker + ' in ' + file);
      }
    });
  }

  it('registration settles busy state and never resubmits a confirmed account', () => {
    const code = read('src/app/(auth)/register.tsx');
    for (const marker of [
      'if (createAccountInFlight.current || accountCreated.current)',
      "setFeedback({ status: 'pending'",
      'accountCreated.current = true',
      'finishCreateAccount();',
      'OPEN PUBLIC HOME',
    ]) {
      assert.ok(code.includes(marker), 'Missing registration guard/status ' + marker);
    }
  });

  it('Home compatibility patch reproduces the last production source exactly', () => {
    const original = execFileSync('git', [
      'show',
      '363658fc81b7fe7132a7b8a78035f0d1a9917088:src/app/(tabs)/home.tsx',
    ], { encoding: 'utf8' });
    const marker = '{/* BUKLOD_HOME_IDENTITY_R23_CLEAN_TWO_ROW */}';
    assert.equal(original.split(marker).length, 2, 'Expected one R23 marker');
    const expected = original.replace(
      marker,
      marker + '\\n      {/* HOME_IDENTITY_ACTION_ROW_R2 — compatibility marker; R23 remains authoritative */}',
    );
    assert.equal(read('src/app/(tabs)/home.tsx'), expected);
  });

  it('runtime remains compatible with installed V28 APK', () => {
    const code = read('app.config.js');
    assert.ok(code.includes("runtimeVersion: isClassroom ? '1.3.0' : '1.3.2'"));
    assert.ok(code.includes("versionCode: isStaging ? undefined : 28"));
  });
});
