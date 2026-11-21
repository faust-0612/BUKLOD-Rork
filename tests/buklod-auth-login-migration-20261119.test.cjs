const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const load=p=>fs.readFileSync(p,'utf8');
const login=load('src/app/(auth)/login.tsx');
const register=load('src/app/(auth)/register.tsx');
const wizard=load('src/components/LegacyLoginContactMigration.tsx');
const handler=load('supabase/functions/buklod-legacy-contact-migrate/index.ts');
const migration=load('supabase/migrations/20261119221000_buklod_retire_username_login_migration_v1.sql');
test('login screen defaults only email/mobile, but legacy users can recover',()=>{
 assert.match(login,/LEGACY USERNAME RECOVERY/);
 assert.match(login,/!legacyUsernameMode/);
 assert.match(login,/\/account\/security/);
 assert.match(register,/type LoginMethod = 'mobile' \| 'email'/);
 assert.doesNotMatch(register,/loginMethod ===\s*'username'/);
});
test('contact recovery verifies existing owner and destination before same UID migration',()=>{
 assert.match(handler,/auth\.getUser\(token\)/);
 assert.match(handler,/auth\.signInWithPassword/);
 assert.match(handler,/reauth\?\.user\?\.id!==user\.id/);
 assert.match(handler,/sixDigit\(\)/);
 assert.match(handler,/attempts>=5/);
 assert.match(handler,/admin\.auth\.admin\.updateUserById\(user!\.id/);
 assert.match(handler,/p_user_id:user!\.id/);
 assert.match(wizard,/invoke\('finalize'\)/);
});
test('database denies direct contacts and old-client username signup',()=>{
 assert.match(migration,/before insert on auth\.users/);
 assert.match(migration,/revoke all on public\.buklod_login_contact_challenges_v1/);
 assert.match(migration,/service_role/);
 assert.match(migration,/external_reminders_enabled boolean not null default false/);
});
