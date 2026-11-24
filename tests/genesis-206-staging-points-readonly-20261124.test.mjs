import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('src/components/points/BuklodPointsRewardsScreen.tsx','utf8');
test('Genesis shared-backend staging Points preview is fail-closed and read-only',()=>{
 assert.match(s,/const POINTS_STAGING_READ_ONLY = process\.env\.EXPO_PUBLIC_APP_ENV !== 'production'/);
 assert.match(s,/const claimAll = useCallback\(async \(\) => \{\s*if \(POINTS_STAGING_READ_ONLY\) return;/);
 assert.match(s,/\{POINTS_STAGING_READ_ONLY \? \([\s\S]*?STAGING PREVIEW[\s\S]*?\) : claimGroups\.length>0&&\(/);
 assert.match(s,/rows=\{rows\}/);
 assert.match(s,/onToggle=\{\(\) => toggleGroup\(group\.group_key\)\}/);
});
