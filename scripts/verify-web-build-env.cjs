// Run inside the same EAS environment as Expo export, before Metro starts.
function verifyWebBuildEnv(env) {
  for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    if (!env[name]?.trim()) throw new Error(`Missing Web build variable: ${name}`);
  }
  const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be an HTTPS project URL without credentials.');
  }
  if (env.BUKLOD_EXPECTED_SUPABASE_URL && url.origin !== env.BUKLOD_EXPECTED_SUPABASE_URL) {
    throw new Error('Web build Supabase project does not match the approved production project.');
  }
}

if (require.main === module) {
  try {
    verifyWebBuildEnv(process.env);
    console.log('Web build environment: required Supabase bindings present.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { verifyWebBuildEnv };
