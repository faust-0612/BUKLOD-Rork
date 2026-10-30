import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildKlEditorDraft, klEditorDraftKey, parseKlEditorDraft, hasUnsavedKlDraft,
} from '../src/lib/kabihasnang-ligaw/editorDraftRecovery.ts';
import {
  klEditorRenderSignature, klEditorCrashComponent,
} from '../src/lib/kabihasnang-ligaw/editorCrashDiagnostics.ts';

const user = '11111111-1111-4111-8111-111111111111';
const chapter = '22222222-2222-4222-8222-222222222222';
const another = '33333333-3333-4333-8333-333333333333';

test('KL local recovery is account- and chapter-isolated', () => {
  assert.notEqual(klEditorDraftKey(user, chapter), klEditorDraftKey(another, chapter));
  assert.notEqual(klEditorDraftKey(user, chapter), klEditorDraftKey(user, another));
  assert.equal(klEditorDraftKey(undefined, chapter), null);
  assert.equal(klEditorDraftKey(user, '../../escape'), null);
  const draft = buildKlEditorDraft(user, chapter, 'New title', 'Private changes', 'Old title', 'Saved text');
  assert.ok(draft);
  assert.equal(parseKlEditorDraft(JSON.stringify(draft), another, chapter), null);
  assert.equal(parseKlEditorDraft(JSON.stringify(draft), user, another), null);
  assert.deepEqual(parseKlEditorDraft(JSON.stringify(draft), user, chapter), draft);
});

test('a stale, corrupt, oversized or saved-on-server draft is not auto-restored', () => {
  const draft = buildKlEditorDraft(user, chapter, 'Title', 'Edited manuscript', 'Title', 'Saved manuscript');
  assert.ok(draft);
  assert.equal(hasUnsavedKlDraft(draft, 'Title', 'Saved manuscript'), true);
  assert.equal(hasUnsavedKlDraft(draft, 'Title', 'Edited manuscript'), false);
  assert.equal(parseKlEditorDraft('{invalid', user, chapter), null);
  assert.equal(parseKlEditorDraft(JSON.stringify({ ...draft, editedAt: Date.now()-8*86400_000 }), user, chapter), null);
  assert.equal(parseKlEditorDraft(JSON.stringify({ ...draft, manuscript: 'a'.repeat(500001) }), user, chapter), null);
});

test('render exception uses global-compatible private hash and sanitized component identifier', () => {
  assert.equal(klEditorRenderSignature(new Error('Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.')), 'RENDER_F126183A');
  assert.equal(klEditorCrashComponent('at KlSceneEffect (created by KlAdminMediaUpload)'), 'KL_SCENE_EFFECT');
  assert.equal(klEditorCrashComponent('at KlPublishingStudio'), 'KL_PUBLISHING_STUDIO');
  assert.equal(klEditorCrashComponent('username@email.com  /private/path'), 'KL_EDITOR_UNKNOWN');
});
