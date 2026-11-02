import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  klSceneNumbers, nextKlSceneCount, KL_MAX_SCENE_COUNT,
  sceneEditorValues, updateSceneDraft,
} from '../src/lib/kabihasnang-ligaw/sceneDrafts.ts';

const records = [{kind:'illustration',placement:1,anchor:'Original scene',effect:'rain',intensity:25}];

test('shows three initial scenes, then adds four and five without duplicating an existing slot', () => {
  assert.deepEqual(klSceneNumbers([],3), [1,2,3]);
  assert.equal(nextKlSceneCount([],3),4);
  assert.deepEqual(klSceneNumbers([],4), [1,2,3,4]);
  assert.equal(nextKlSceneCount([...records,{kind:'illustration',placement:4}],3),5);
});

test('reopens saved higher scenes, bounds 12 and ignores audio slots', () => {
  assert.equal(klSceneNumbers([...records,{kind:'illustration',placement:8}],3).length,8);
  assert.equal(klSceneNumbers([...records,{kind:'music',placement:12}],3).length,3);
  assert.equal(klSceneNumbers([...records,{kind:'illustration',placement:30}],3).length, KL_MAX_SCENE_COUNT);
  assert.equal(nextKlSceneCount([...records,{kind:'illustration',placement:12}],3),12);
  assert.equal(nextKlSceneCount([],12),12);
});

test('scene 4 and 5 drafts do not overwrite the earlier three scenes', () => {
  let drafts=updateSceneDraft({},4,{anchor:'Unique fourth scene',side:'before',effect:'fog',intensity:40});
  drafts=updateSceneDraft(drafts,5,{anchor:'Unique fifth scene',side:'after',effect:'fireflies',intensity:80});
  assert.equal(sceneEditorValues(records,1,drafts[1]).anchor,'Original scene');
  assert.equal(sceneEditorValues(records,4,drafts[4]).anchor,'Unique fourth scene');
  assert.equal(sceneEditorValues(records,5,drafts[5]).anchor,'Unique fifth scene');
  assert.equal(sceneEditorValues(records,4,drafts[4]).intensity,40);
});

test('UI adds live + Add Scene and respects the bounded backend schema', () => {
  const ui=readFileSync('src/components/kabihasnang-ligaw/KlAdminMediaUpload.tsx','utf8');
  const studio=readFileSync('src/components/kabihasnang-ligaw/KlPublishingStudio.tsx','utf8');
  const sql=readFileSync('supabase/migrations/20261101235100_kl_dynamic_illustration_scenes.sql','utf8');
  assert.match(ui,/\+ Add Scene/);
  assert.match(ui,/sceneNumbers\.map/);
  assert.doesNotMatch(ui,/\[1, 2, 3\]\.map\(\(scene\)/);
  assert.match(studio,/2–12 illustrations/);
  assert.match(sql,/p_placement>12/);
  assert.match(sql,/BETWEEN 1 AND 12/g);
  assert.match(sql,/placement <> p_placement/);
  assert.match(sql,/paragraph_anchor = v_anchor/);
  assert.match(ui,/duplicateSavedScene/);
  assert.match(ui,/duplicateDraftScene/);
  assert.match(sql,/v_count > 12/);
  assert.match(sql,/v_count < 2/);
  assert.match(sql,/SECURITY DEFINER/g);
});
