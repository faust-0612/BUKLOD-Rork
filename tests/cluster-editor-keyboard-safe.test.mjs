import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/BuklodClusterHomeCommandCenterImpl.tsx', 'utf8');
const start = source.indexOf('visible={kind!==null}');
const end = source.indexOf('</Modal>', start);
assert.ok(start >= 0 && end > start, 'Cluster Home editor Modal must exist');
const editor = source.slice(start, end);

test('Cluster editor native modal is keyboard-aware on Android and iOS', () => {
  assert.match(editor, /<KeyboardAvoidingView[\s\S]*behavior=\{Platform\.OS==='ios'\?'padding':'height'\}/);
  assert.ok(editor.indexOf('<KeyboardAvoidingView') < editor.indexOf('style={s.editorFieldsScroll}'));
  assert.ok(editor.indexOf('style={s.editorFieldsScroll}') < editor.indexOf('</KeyboardAvoidingView>'));
});

test('All fields scroll but Save remains a non-scrolling footer', () => {
  const scroll = editor.indexOf('style={s.editorFieldsScroll}');
  const scrollEnd = editor.indexOf('</ScrollView>', scroll);
  const save = editor.indexOf('accessibilityLabel="Save Cluster Home changes"');
  assert.ok(scroll >= 0 && scrollEnd > scroll && save > scrollEnd);
  for (const field of ['Title', 'Details / description', 'Type EMERGENCY', 'Location', 'Due date/time', 'Option 1', 'https://', 'Member / team name']) {
    assert.ok(editor.slice(scroll, scrollEnd).includes(field), 'Missing field: ' + field);
  }
  assert.match(editor, /keyboardShouldPersistTaps="handled"/);
  assert.match(source, /editorFieldsScroll:\{flexGrow:0,flexShrink:1,minHeight:0\}/);
  assert.match(source, /editorSave:\{minHeight:48,flexShrink:0\}/);
});

test('Save respects phone navigation inset while preserving existing persistence', () => {
  assert.match(editor, /paddingBottom:drawerBottomInset/);
  assert.match(editor, /disabled=\{saving\}/);
  assert.match(editor, /onPress=\{\(\)=>void save\(\)\}/);
  for (const table of ['buklod_cluster_home_notices', 'buklod_cluster_events', 'buklod_cluster_tasks', 'buklod_cluster_polls', 'buklod_cluster_resources', 'buklod_cluster_recognitions', 'buklod_cluster_home_settings']) {
    assert.ok(source.includes(table), 'Missing persistence table: ' + table);
  }
});

test('Emergency priority and seven editor kinds still exist', () => {
  assert.match(source, /priority:extra\.trim\(\)\.toLowerCase\(\)==='emergency'\?'EMERGENCY':'IMPORTANT'/);
  for (const kind of ['notice', 'event', 'task', 'poll', 'resource', 'recognition', 'about']) {
    assert.ok(source.includes("kind==='" + kind + "'"), 'Missing editor kind: ' + kind);
  }
});
