const fs=require('node:fs');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const app=fs.readFileSync('src/App.tsx','utf8');
const css=fs.readFileSync('src/index.css','utf8');
const config=JSON.parse(fs.readFileSync('app.json','utf8'));
test('upload touch area never contains full-size invisible file controls',()=>{
 assert.ok(app.includes('htmlFor="himig-source-audio"'));
 assert.ok(app.includes('htmlFor="himig-backing-audio"'));
 assert.ok(app.includes('id="himig-source-audio"'));
 assert.ok(app.includes('id="himig-backing-audio"'));
 assert.ok(css.includes('pointer-events: none;'));
 assert.ok(css.includes('touch-action: pan-y;'));
 assert.ok(!css.includes('  inset: 0;\n  opacity: 0;'));
});
test('long source recordings use cancellable cooperative preparation',()=>{
 assert.match(app,/const prepareChunk = 32768/);
 assert.match(app,/if \(ticket !== activeRef.current\) throw new Error/);
 assert.match(app,/await new Promise<void>\(resolve => window.setTimeout\(resolve, 0\)\)/);
 assert.ok(!app.includes('decodeAudioData(bytes.slice(0))'));
});
test('never redirect to BUKLOD EAS project',()=>{
 assert.equal(config.expo.owner,'faust_0612');
 assert.equal(config.expo.extra.eas.projectId,'05e7dab7-a7fd-490c-af52-a54a3609ec35');
});
