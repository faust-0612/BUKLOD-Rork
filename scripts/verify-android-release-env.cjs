// Run in the same EAS production environment as the Android export. Never log values.
const config = require('../app.config.js')({ config: {} });
const expected = require('../release/android-native-runtime.json').active;
if (config.runtimeVersion !== expected.embeddedRuntime || config.extra?.eas?.projectId !== expected.easProjectId) {
  throw new Error('Production runtime/project configuration mismatch');
}
if (process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://yhanxndaqbmuzbdqlblu.supabase.co' ||
    !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
  throw new Error('Required approved production Supabase build bindings are missing or mismatched');
}
if (process.env.EXPO_PUBLIC_APP_ENV !== 'production') throw new Error('Production app environment required');
console.log('Android production build configuration present; values withheld.');
