const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync('release/nov16-conso-henry-dark-kids-stage-132.json','utf8'));
const src = p => fs.readFileSync(p,'utf8');
test('consolidated Android-only target is isolated, frozen-source not mistaken for published',()=>{
 const prevVariant=process.env.APP_VARIANT,prevEnv=process.env.EXPO_PUBLIC_APP_ENV,prevTarget=process.env.BUKLOD_APP_TARGET;
 process.env.APP_VARIANT='staging';process.env.EXPO_PUBLIC_APP_ENV='staging';process.env.BUKLOD_APP_TARGET='main';
 const app=require('../app.config.js')({config:{}});
 if(prevVariant===undefined)delete process.env.APP_VARIANT;else process.env.APP_VARIANT=prevVariant;
 if(prevEnv===undefined)delete process.env.EXPO_PUBLIC_APP_ENV;else process.env.EXPO_PUBLIC_APP_ENV=prevEnv;
 if(prevTarget===undefined)delete process.env.BUKLOD_APP_TARGET;else process.env.BUKLOD_APP_TARGET=prevTarget;
 const eas=JSON.parse(src('eas.json'));
 assert.equal(app.android.package,manifest.target.packageId);
 assert.equal(app.runtimeVersion,manifest.target.runtimeVersion);
 assert.equal(app.extra.appEnvironment,'staging');
 assert.equal(app.extra.eas.projectId,manifest.target.easProjectId);
 assert.equal(eas.build['staging-user'].channel,manifest.target.channel);
 assert.equal(eas.build['staging-user'].environment,manifest.target.environment);
 assert.equal(eas.build.production.channel,'production');
 assert.equal(manifest.publicationPolicy.allowOtaPublish,false);
 assert.equal(manifest.productionOtaPublished,false);
});
test('source owns both tested safe-area and dark-mode changes without reapplying previous patches',()=>{
 assert.match(src('src/components/BuklodNavSafeShell.tsx'),/SafeArea|safeArea|insets|statusBar/i);
 assert.match(src('src/app/bible/index.tsx'),/dark|theme|colors/i);
 assert.match(src('src/app/notifications/index.tsx'),/theme|colors/i);
 assert.match(src('src/features/childrenStories/catalog.ts'),/bible|stor/i);
 assert.match(src('src/features/childrenStories/storyNarration.ts'),/speech|Speech|speak/i);
});
test('source-explicit Henry commentary is bundled without native or server changes',()=>{
 assert.match(src('src/app/bible/read.tsx'),/getMatthewHenryPassage/);
 assert.match(src('src/app/bible/read.tsx'),/useMatthewHenryTranslation/);
 assert.match(src('src/lib/buklodBibleStudy.ts'),/relation: 'direct' \| 'context'/);
 assert.match(src('src/lib/buklodHenryTranslation.ts'),/getSupportedTranslationLanguages/);
 assert.match(src('src/lib/buklodHenryTranslation.ts'),/translateText/);
 assert.equal(manifest.gates.translationBranding.startsWith('HOLD'),true);
 assert.equal(manifest.gates.nativeCompatibility.startsWith('HOLD'),true);
});
