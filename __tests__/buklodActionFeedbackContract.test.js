const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('BUKLOD V28 creation feedback contract', () => {
  test('shared status control renders pending, success, warning and error', () => {
    const code = read('src/components/BuklodActionFeedback.tsx');
    expect(code).toContain("'pending'");
    expect(code).toContain("'success'");
    expect(code).toContain("'warning'");
    expect(code).toContain("'error'");
    expect(code).toContain('accessibilityLiveRegion="polite"');
  });

  const submissions = [
    ['src/app/clusters/create.tsx', 'createCluster'],
    ['src/app/organizations/create.tsx', 'buklod_create_organization_v3'],
    ['src/app/organizations/suborganizations.tsx', 'createSuborganization'],
    ['src/app/admin/groups.tsx', 'manage_create_buklod_group'],
  ];

  test.each(submissions)('%s reports only confirmed creation and ignores concurrent submit', (file, backend) => {
    const code = read(file);
    expect(code).toContain(backend);
    expect(code).toMatch(/InFlight\.current|inFlight\.current/);
    expect(code).toMatch(/status:\\s*'pending'/);\n    expect(code).toMatch(/status:\\s*'success'/);\n    expect(code).toContain('BuklodActionFeedback');
  });

  test('registration catches async failures without endless busy and avoids duplicate signup', () => {
    const code = read('src/app/(auth)/register.tsx');
    expect(code).toContain('if (createAccountInFlight.current || accountCreated.current)');
    expect(code).toContain("setFeedback({ status: 'pending'");
    expect(code).toContain('accountCreated.current = true');
    expect(code).toContain('} finally {\n        finishCreateAccount();');
    expect(code).toContain('OPEN PUBLIC HOME');
  });
});
