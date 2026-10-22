const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('BUKLOD V28 action feedback contract', () => {
  test('shared status renders pending, success, warning, and error', () => {
    const code = read('src/components/BuklodActionFeedback.tsx');
    for (const status of ['pending', 'success', 'warning', 'error']) {
      expect(code).toContain(status);
    }
    expect(code).toContain('accessibilityLiveRegion="polite"');
  });

  test.each([
    ['src/app/clusters/create.tsx', 'createCluster'],
    ['src/app/organizations/create.tsx', 'buklod_create_organization_v3'],
    ['src/app/organizations/suborganizations.tsx', 'createSuborganization'],
    ['src/app/admin/groups.tsx', 'manage_create_buklod_group'],
  ])('%s shows server-confirmed creation and blocks double submits', (file, backend) => {
    const code = read(file);
    expect(code).toContain(backend);
    expect(code).toContain('current');
    expect(code).toContain('BuklodActionFeedback');
    expect(code).toContain('pending');
    expect(code).toContain('success');
    expect(code).toContain('error');
  });

  test('registration settles busy state and does not retry successful signup', () => {
    const code = read('src/app/(auth)/register.tsx');
    expect(code).toContain('if (createAccountInFlight.current || accountCreated.current)');
    expect(code).toContain("setFeedback({ status: 'pending'");
    expect(code).toContain('accountCreated.current = true');
    expect(code).toContain('finishCreateAccount();');
    expect(code).toContain('OPEN PUBLIC HOME');
  });
});
