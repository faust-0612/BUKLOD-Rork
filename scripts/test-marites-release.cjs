const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const root = require('node:path').resolve(__dirname, '..');
function compile(file, mocks = {}) {
  const source = fs.readFileSync(`${root}/${file}`, 'utf8');
  const result = ts.transpileModule(source, {fileName: file, reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file);
  const exports = {};
  vm.runInNewContext(result.outputText, {exports, require: name => mocks[name] || {}, console, Date, setTimeout, clearTimeout});
  return exports;
}
const {selectVisibleMaritesVideo: select, quickVideoDurationSeconds: duration} = compile('src/lib/buklodMaritesPlayback.ts');
const bounds = {x: 0, y: 100, width: 360, height: 252, windowWidth: 360, windowHeight: 800, topInset: 24, bottomInset: 64, offset: 0, cardWidth: 186, gap: 7, videos: [true, true, true]};
assert.equal(select(bounds), 0);
assert.equal(select({...bounds, y: -252}), -1);
assert.equal(select({...bounds, y: 800}), -1);
assert.equal(select({...bounds, offset: 193}), 1);
assert.equal(select({...bounds, offset: 9999}), -1);
assert.equal(select({...bounds, videos: [false, true, true]}), 1);
assert.equal(select({...bounds, y: 700}), -1);
assert.equal(select({...bounds, width: 0}), -1);
assert.equal(select({...bounds, x: NaN}), -1);
assert.equal(duration(500), 0.5);
assert.equal(duration(1000), 1);
assert.equal(duration(30000), 30);
assert.ok(duration(30001) > 30);
let cached = null;
const storage = {getItem: async () => cached, setItem: async (_, value) => {cached = value;}};
const model = compile('src/lib/buklodMaritesBoard.ts', {
  '@react-native-async-storage/async-storage': storage,
});
const now = Date.now();
const story = {id: 'local:test', user_id: 'owner', body: '', created_at: new Date(now - 1000).toISOString(), video_uri: 'file:///video.mp4'};
assert.equal(model.isActiveMaritesStory(story, now), true);
for (const age of [72*3600000, 72*3600000+1]) assert.equal(model.isActiveMaritesStory({...story, created_at: new Date(now-age).toISOString()}, now), false);
assert.equal(model.isActiveMaritesStory({...story, created_at: 'invalid'}, now), false);
assert.equal(model.isActiveMaritesStory({...story, created_at: new Date(now+1000).toISOString()}, now), false);
assert.equal(model.filterMaritesStoriesForViewer([{...story, author_only: true}], 'other').length, 0);
assert.equal(model.filterMaritesStoriesForViewer([{...story, author_only: true}], 'owner').length, 1);
assert.equal(model.mergeMaritesStories([story], [story]).length, 1);
(async () => {
  await model.saveMaritesStories([story]);
  const restored = await model.loadMaritesStories();
  assert.equal(restored[0].video_uri, story.video_uri);
  console.log('PASS: Marites viewport selection, duration boundary, 72h expiry, privacy, deduplication, video cache round-trip');
})().catch(error => {console.error(error); process.exitCode = 1;});
