const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/*
 * BUKLOD_WEB_EAS_ENV_EXPORT_RECOVERY_R1
 *
 * The production web workflow historically ran `expo export` directly on the
 * GitHub runner. EAS production variables therefore were not guaranteed to be
 * present while Metro inlined EXPO_PUBLIC_* values. A successful hosting deploy
 * could then serve a bundle that crashed immediately with:
 *   "supabaseUrl is required"
 *
 * This post-export guard is intentionally placed in a script that the existing
 * production workflow already runs and watches. It verifies that the exported
 * browser bundle contains BOTH the production Supabase URL and publishable key.
 * If they are absent in CI, it pulls the EAS production environment, re-exports
 * web once, verifies the exact public values were inlined, then removes the
 * temporary .env.local before deployment. It never prints key values.
 */

const root = process.cwd();
const distDir = path.resolve(root, 'dist');
const target = path.join(distDir, 'index.html');
const envLocal = path.resolve(root, '.env.local');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const client = 'ca-pub-6260135521836249';
const marker = 'BUKLOD_ADSENSE_EXPORT_INJECTION_R2';
const scriptSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;

function webBundleFiles() {
  const dir = path.join(distDir, '_expo', 'static', 'js', 'web');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(dir, name));
}

function bundleContains(value) {
  if (!value) return false;
  return webBundleFiles().some((file) => {
    try {
      return fs.readFileSync(file, 'utf8').includes(value);
    } catch {
      return false;
    }
  });
}

function currentExportLooksConfigured() {
  const files = webBundleFiles();
  if (!files.length) return false;

  let hasProductionProject = false;
  let hasPublishableKey = false;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (source.includes('yhanxndaqbmuzbdqlblu')) {
      hasProductionProject = true;
    }
    if (source.includes('sb_publishable_')) {
      hasPublishableKey = true;
    }
    if (hasProductionProject && hasPublishableKey) {
      return true;
    }
  }

  return false;
}

function parseEnvValue(text, key) {
  const line = text
    .split(/\r?\n/)
    .find((row) => row.trimStart().startsWith(`${key}=`));

  if (!line) return '';
  let value = line.slice(line.indexOf('=') + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value.trim();
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }
}

function recoverProductionEnvironmentExport() {
  if (!process.env.EXPO_TOKEN) {
    throw new Error(
      'Web export is missing production Supabase config and EXPO_TOKEN is unavailable for EAS environment recovery.'
    );
  }

  console.log(
    'BUKLOD web export is missing production Supabase config; recovering from EAS production environment.'
  );

  fs.rmSync(envLocal, { force: true });

  try {
    run(
      npx,
      [
        'eas-cli@latest',
        'env:pull',
        '--environment',
        'production',
        '--path',
        '.env.local',
        '--non-interactive',
      ],
      'EAS production environment pull'
    );

    if (!fs.existsSync(envLocal) || fs.statSync(envLocal).size === 0) {
      throw new Error('EAS production environment pull did not create .env.local.');
    }

    const envText = fs.readFileSync(envLocal, 'utf8');
    const supabaseUrl = parseEnvValue(
      envText,
      'EXPO_PUBLIC_SUPABASE_URL'
    );
    const publishableKey = parseEnvValue(
      envText,
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
      throw new Error('EAS production environment has no valid public Supabase URL.');
    }
    if (!publishableKey) {
      throw new Error('EAS production environment has no Supabase publishable key.');
    }

    fs.rmSync(distDir, { recursive: true, force: true });
    run(
      npx,
      ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'],
      'Production web re-export'
    );

    if (!bundleContains(supabaseUrl) || !bundleContains(publishableKey)) {
      throw new Error(
        'Production web re-export did not inline the required Supabase public configuration.'
      );
    }

    console.log('BUKLOD web Supabase environment export verification READY.');
  } finally {
    // EAS env:pull can include sensitive non-public build variables. Keep the
    // temporary file only for the Metro re-export, never for the deploy step.
    fs.rmSync(envLocal, { force: true });
  }
}

if (!fs.existsSync(target)) {
  throw new Error(`Missing exported web HTML: ${target}`);
}

if (!currentExportLooksConfigured()) {
  recoverProductionEnvironmentExport();
}

if (!currentExportLooksConfigured()) {
  throw new Error(
    'Refusing web deploy: exported bundle is still missing production Supabase public configuration.'
  );
}

let html = fs.readFileSync(target, 'utf8');

const block = [
  `<!-- ${marker} -->`,
  `<meta name="google-adsense-account" content="${client}">`,
  `<script async src="${scriptSrc}" crossorigin="anonymous"></script>`,
].join('');

if (!html.includes(client)) {
  if (!html.includes('</head>')) {
    throw new Error('Could not locate </head> in exported web HTML.');
  }
  html = html.replace('</head>', `${block}</head>`);
  fs.writeFileSync(target, html, 'utf8');
}

const verified = fs.readFileSync(target, 'utf8');
if (!verified.includes(client)) {
  throw new Error('AdSense publisher id was not injected into dist/index.html.');
}
if (!verified.includes('google-adsense-account')) {
  throw new Error('AdSense account meta tag is missing from dist/index.html.');
}
if (!verified.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')) {
  throw new Error('AdSense loader script is missing from dist/index.html.');
}

console.log(`AdSense web-head verification READY for ${client}.`);
