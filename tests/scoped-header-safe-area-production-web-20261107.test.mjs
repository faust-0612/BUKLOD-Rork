import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');
const header = read('src/components/BuklodScopedDashboardHeader.tsx');
const webWorkflow = read('.github/workflows/production_web_deploy.yml');
const androidWorkflow = read('.github/workflows/production_android_ota.yml');

test('scoped header retains native/phone safe-area and drops double inset only on wide web', () => {
  assert.ok(header.includes('  Platform,') && header.includes("from 'react-native'"));
  assert.match(header, /const insets = useSafeAreaInsets\(\)/);
  assert.match(header, /const \{ width: viewportWidth \} = useWindowDimensions\(\)/);
  assert.match(header, /const scopedTopInset = Platform\.OS === 'web' && viewportWidth >= 1200\s*\? 0 : insets\.top;/);
  assert.equal((header.match(/paddingTop: scopedTopInset/g) ?? []).length, 2,
    'Both ordinary scoped and Cluster/Organization blue headers must use the same policy');
  const top = (platform, width, inset) => platform === 'web' && width >= 1200 ? 0 : inset;
  assert.equal(top('android', 360, 28), 28);
  assert.equal(top('android', 1920, 28), 28);
  assert.equal(top('ios', 390, 47), 47);
  assert.equal(top('web', 800, 20), 20);
  assert.equal(top('web', 1199, 20), 20);
  assert.equal(top('web', 1200, 20), 0);
  assert.equal(top('web', 1920, 20), 0);
});

test('production web gate enforces semantic policy rather than retired source markup', () => {
  const verify = webWorkflow.indexOf('- name: Verify production safety anchors');
  const policy = webWorkflow.indexOf(
    'node --test tests/scoped-header-safe-area-production-web-20261107.test.mjs',
    verify,
  );
  const exportWeb = webWorkflow.indexOf('- name: Export production web with production environment');
  const deployWeb = webWorkflow.indexOf('- name: Deploy production web');
  assert.ok(verify >= 0 && policy > verify && exportWeb > policy &&
    deployWeb > exportWeb, 'The safety test must gate production export and deployment');
  assert.ok(!webWorkflow.includes("grep -F 'paddingTop: insets.top'"));
  assert.match(webWorkflow, /grep -F 'serverCanManage' 'src\/components\/BuklodClusterHomeCommandCenter\.tsx'/);
  assert.ok(webWorkflow.includes('grep -F "constrainContextToOrganization" \'src/lib/buklodClusterFormationGate.ts\''));
  assert.match(webWorkflow, /grep -F 'BUKLOD_CLASSROOM_ACCOUNT_ISOLATION_R2'/);
  assert.match(webWorkflow, /git ls-remote origin refs\/heads\/main/);
  assert.match(webWorkflow, /sha256sum -c web-rc-sha256\.txt/);
  assert.match(webWorkflow, /deploy --prod --export-dir dist --environment production/);
});

test('the independent Android OTA gate remains intact', () => {
  assert.match(androidWorkflow, /node --test tests\/scoped-header-safe-area-production-ota-20261107\.test\.mjs/);
  assert.match(androidWorkflow, /node scripts\/android-ota-rc\.cjs verify/);
  assert.match(androidWorkflow, /Publish exact frozen Android RC/);
});
