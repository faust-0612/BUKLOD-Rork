const profile = String(process.env.EAS_BUILD_PROFILE || '').trim();

if (!profile.startsWith('classroom-')) {
  console.log('CLASSROOM_EAS_PREINSTALL=SKIP_NON_CLASSROOM_PROFILE');
  process.exit(0);
}

if (process.env.BUKLOD_APP_TARGET !== 'classroom') {
  console.error(`CLASSROOM_EAS_PREINSTALL=FAIL profile=${profile} target=${process.env.BUKLOD_APP_TARGET || '<missing>'}`);
  process.exit(1);
}

console.log(`CLASSROOM_EAS_PREINSTALL=VERIFY profile=${profile}`);
require('./assert-classroom-identity.cjs');
