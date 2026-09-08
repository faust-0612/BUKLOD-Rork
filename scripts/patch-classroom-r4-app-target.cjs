const fs = require('fs');

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label} anchor`);
  if (source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`Ambiguous ${label} anchor`);
  return source.replace(before, after);
}

const configPath = 'app.config.js';
let config = fs.readFileSync(configPath, 'utf8');
if (config.includes('BUKLOD_CLASSROOM_APP_TARGET_R4')) throw new Error('Classroom app target patch already present');

config = replaceOnce(
  config,
  "module.exports = ({ config }) => {\n  const projectId =\n    process.env.EAS_PROJECT_ID ||\n    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||\n    '23dad7d0-389a-406e-8dec-08965dab85d8';",
  "module.exports = ({ config }) => {\n  /* BUKLOD_CLASSROOM_APP_TARGET_R4 — standalone identity without mutating Main defaults */\n  const appTarget = (process.env.BUKLOD_APP_TARGET || 'main').trim().toLowerCase();\n  const isClassroom = appTarget === 'classroom';\n  const classroomProjectId = '14100ed1-7f25-4551-9627-09d280498241';\n  const classroomGoogleServicesFile = (process.env.CLASSROOM_GOOGLE_SERVICES_FILE || '').trim();\n  const projectId = isClassroom\n    ? classroomProjectId\n    : (process.env.EAS_PROJECT_ID ||\n       process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||\n       '23dad7d0-389a-406e-8dec-08965dab85d8');",
  'project identity',
);

config = replaceOnce(
  config,
  "  const appName =\n    isStaging\n      ? 'BUKLOD Staging'\n      : 'BUKLOD';",
  "  const appName = isClassroom\n    ? (isStaging ? 'BUKLOD Classroom Staging' : 'BUKLOD Classroom')\n    : (isStaging ? 'BUKLOD Staging' : 'BUKLOD');",
  'app name',
);

config = replaceOnce(
  config,
  "  const packageId =\n    isStaging\n      ? 'org.mzbministry.buklod.staging'\n      : 'org.mzbministry.buklod';",
  "  const packageId = isClassroom\n    ? 'org.mzbministry.buklod.classroom'\n    : (isStaging ? 'org.mzbministry.buklod.staging' : 'org.mzbministry.buklod');",
  'package id',
);

config = replaceOnce(
  config,
  "  const scheme =\n    isStaging\n      ? 'buklod-staging'\n      : 'buklod';",
  "  const scheme = isClassroom\n    ? 'buklod-classroom'\n    : (isStaging ? 'buklod-staging' : 'buklod');",
  'scheme',
);

config = replaceOnce(config, "    slug: 'buklod',", "    slug: isClassroom ? 'buklod-classroom' : 'buklod',", 'slug');
config = replaceOnce(config, "    icon: './assets/release/app-icon.png',", "    icon: isClassroom ? './assets/classroom/app-icon.png' : './assets/release/app-icon.png',", 'icon');

config = replaceOnce(
  config,
  "      googleServicesFile: isStaging\n        ? './google-services.staging.json'\n        : './google-services.production.json',",
  "      // Never silently reuse Main Firebase credentials for the standalone Classroom package.\n      googleServicesFile: isClassroom\n        ? (classroomGoogleServicesFile || undefined)\n        : (isStaging ? './google-services.staging.json' : './google-services.production.json'),",
  'google services isolation',
);

config = replaceOnce(
  config,
  "        foregroundImage:\n          './assets/release/app-icon.png',",
  "        foregroundImage: isClassroom\n          ? './assets/classroom/adaptive-icon.png'\n          : './assets/release/app-icon.png',",
  'adaptive icon',
);

config = replaceOnce(
  config,
  "      favicon:\n        './assets/release/app-icon.png',",
  "      favicon: isClassroom\n        ? './assets/classroom/favicon.png'\n        : './assets/release/app-icon.png',",
  'favicon',
);

config = replaceOnce(
  config,
  "          image:\n            './assets/release/splash-icon.png',",
  "          image: isClassroom\n            ? './assets/classroom/splash-icon.png'\n            : './assets/release/splash-icon.png',",
  'splash image',
);

config = replaceOnce(
  config,
  "            image:\n              './assets/release/splash-icon.png',",
  "            image: isClassroom\n              ? './assets/classroom/splash-icon.png'\n              : './assets/release/splash-icon.png',",
  'dark splash image',
);

config = replaceOnce(
  config,
  "      appEnvironment:\n        process.env.EXPO_PUBLIC_APP_ENV ||\n        variant,",
  "      appEnvironment:\n        process.env.EXPO_PUBLIC_APP_ENV ||\n        variant,\n\n      appTarget: isClassroom ? 'classroom' : 'main',",
  'extra app target',
);

config = replaceOnce(
  config,
  "    runtimeVersion: isStaging ? '1.3.2' : '1.3.0',",
  "    runtimeVersion: isClassroom ? '1.3.0' : (isStaging ? '1.3.2' : '1.3.0'),",
  'runtime version',
);

fs.writeFileSync(configPath, config);

const easPath = 'eas.json';
const raw = fs.readFileSync(easPath, 'utf8').replace(/^\uFEFF/, '');
const eas = JSON.parse(raw);
if (eas.build['classroom-production'] || eas.build['classroom-production-apk']) throw new Error('Classroom EAS profiles already exist');
const classroomBaseEnv = {
  BUKLOD_APP_TARGET: 'classroom',
  APP_VARIANT: 'production',
  EXPO_PUBLIC_APP_ENV: 'production',
};
eas.build['classroom-preview'] = {
  distribution: 'internal',
  channel: 'classroom-preview',
  environment: 'preview',
  autoIncrement: true,
  env: {
    BUKLOD_APP_TARGET: 'classroom',
    APP_VARIANT: 'staging',
    EXPO_PUBLIC_APP_ENV: 'staging',
  },
  android: { buildType: 'apk' },
};
eas.build['classroom-production'] = {
  channel: 'classroom-production',
  environment: 'production',
  env: classroomBaseEnv,
  android: { buildType: 'app-bundle' },
};
eas.build['classroom-production-apk'] = {
  extends: 'classroom-production',
  distribution: 'internal',
  android: { buildType: 'apk' },
};
fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n');

const qaPath = '.github/workflows/classroom_r4_qa.yml';
let qa = fs.readFileSync(qaPath, 'utf8');
if (!qa.includes('Classroom app target isolation')) {
  const anchor = "      - name: Expo public config\n        run: npx expo config --type public --json > /tmp/buklod-r4-expo-config.json\n";
  const step = `${anchor}      - name: Classroom app target isolation\n        shell: bash\n        run: |\n          node <<'NODE'\n          const assert = require('node:assert/strict');\n          const factory = require('./app.config.js');\n          const clean = ['BUKLOD_APP_TARGET','APP_VARIANT','EXPO_PUBLIC_APP_ENV','EAS_PROJECT_ID','EXPO_PUBLIC_EAS_PROJECT_ID','CLASSROOM_GOOGLE_SERVICES_FILE'];\n          for (const key of clean) delete process.env[key];\n          const main = factory({ config: { extra: {} } });\n          assert.equal(main.name, 'BUKLOD');\n          assert.equal(main.slug, 'buklod');\n          assert.equal(main.android.package, 'org.mzbministry.buklod');\n          assert.equal(main.extra.eas.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');\n          assert.equal(main.icon, './assets/release/app-icon.png');\n          process.env.BUKLOD_APP_TARGET = 'classroom';\n          const classroom = factory({ config: { extra: {} } });\n          assert.equal(classroom.name, 'BUKLOD Classroom');\n          assert.equal(classroom.slug, 'buklod-classroom');\n          assert.equal(classroom.scheme, 'buklod-classroom');\n          assert.equal(classroom.android.package, 'org.mzbministry.buklod.classroom');\n          assert.equal(classroom.extra.eas.projectId, '14100ed1-7f25-4551-9627-09d280498241');\n          assert.equal(classroom.android.googleServicesFile, undefined);\n          assert.equal(classroom.icon, './assets/classroom/app-icon.png');\n          assert.equal(classroom.android.adaptiveIcon.foregroundImage, './assets/classroom/adaptive-icon.png');\n          assert.equal(classroom.web.favicon, './assets/classroom/favicon.png');\n          assert.equal(classroom.extra.appTarget, 'classroom');\n          const eas = require('./eas.json');\n          assert.equal(eas.build['classroom-production'].env.BUKLOD_APP_TARGET, 'classroom');\n          assert.equal(eas.build['classroom-production-apk'].extends, 'classroom-production');\n          console.log('CLASSROOM_APP_TARGET_ISOLATION=PASS');\n          NODE\n`;
  if (!qa.includes(anchor)) throw new Error('QA Expo config anchor missing');
  qa = qa.replace(anchor, step);
}
fs.writeFileSync(qaPath, qa);

console.log('CLASSROOM_APP_TARGET_PATCH=APPLIED');
