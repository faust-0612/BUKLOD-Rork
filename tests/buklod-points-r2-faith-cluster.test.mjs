import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('BUKLOD Lesson portal links actual mentor teaching workflow without changing lesson access',()=>{
 const s=read('src/app/scope/buklod-lesson/index.tsx');
 assert.match(s,/BuklodScopeLessonLicensesCard/);
 assert.match(s,/BuklodLearningContent variant="embedded"/);
 assert.match(s,/\/faith\/mentor-evidence/);
 const mentor=read('src/app/faith/mentor-evidence.tsx');
 assert.match(mentor,/report_my_mentor_teaching_with_roster_r2/);
 assert.match(mentor,/attach_my_mentor_session_photo_r2/);
});
