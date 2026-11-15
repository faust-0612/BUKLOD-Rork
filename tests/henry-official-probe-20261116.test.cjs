const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('auditor uses documented Google-owned origin and never publishes',()=>{
 const x=fs.readFileSync('.github/workflows/buklod-henry-official-asset-source-probe-20261116.yml','utf8');
 assert.match(x,/docs\.cloud\.google\.com\/static\/translate\/images\/google-translate-attribution\.zip/);
 assert.match(x,/bible\.helloao\.org\/api\/c\/matthew-henry\//);
 assert.match(x,/npm ci --ignore-scripts/);
 assert.match(x,/eas-cli@27\.9\.0 build:view/);
 assert.doesNotMatch(x,/eas-cli@.* update --channel|eas-cli@.* build --profile|supabase db push/);
});
