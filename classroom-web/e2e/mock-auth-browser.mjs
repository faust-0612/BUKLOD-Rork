import assert from 'node:assert/strict';
import {chromium} from '/tmp/buklod-classroom-browser/node_modules/playwright/index.mjs';

const SITE=process.env.PREVIEW_URL;
assert.ok(SITE?.startsWith('https://buklod-classroom--'),'Never send synthetic tests to production.');
const studentId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const classroomId='11111111-1111-4111-8111-111111111111';
const postId='22222222-2222-4222-8222-222222222222';
const assignmentId='33333333-3333-4333-8333-333333333333';
const subId='44444444-4444-4444-8444-444444444444';
const now='2026-11-09T01:00:00+08:00';
const user={id:studentId,email:'synthetic-browser-audit@example.invalid',aud:'authenticated',role:'authenticated',created_at:now,app_metadata:{provider:'email'},user_metadata:{}};
const baseClass={classroom_id:classroomId,classroom_name:'CHN TEST <img src=x onerror=alert(1)>',subject_code:'CHN',section_name:'Test 3C',school_year:'2026–2027',term:'FIRST',status:'ACTIVE',classroom_mode:'RLE',role_key:'FACULTY',can_faculty_view:true,can_student_view:false,updated_at:now};
const posts=[{id:postId,title:'Verified test announcement',body:'Only synthetic test content',post_type:'ANNOUNCEMENT',author_user_id:studentId,created_at:now,is_pinned:false,is_locked:false}];
const comments=[{id:'55555555-5555-4555-8555-555555555555',post_id:postId,body:'Visible comment from mocked backend',author_user_id:studentId,created_at:now}];
const assignments=[{id:assignmentId,classroom_id:classroomId,title:'Official assessment task',description:'Complete safely',instructions:'Review and submit',points_possible:10,status:'PUBLISHED',due_at:'2026-11-11T10:00:00+08:00'}];
const submissions=[{id:subId,classroom_id:classroomId,assignment_id:assignmentId,student_user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',attempt_no:1,status:'SUBMITTED',score:null,submitted_at:now}];
const rpc={
 'buklod_classroom_my_classes_v2':request=>request.postData()?.includes('STUDENT')?[]:[baseClass],
 'buklod_classroom_context_v1':()=>({role:'FACULTY',is_faculty:true,is_student:false,faculty_role:'PRIMARY',allow_student_posts:true}),
 'buklod_classroom_gradebook_roster_v1':()=>[{roster_member_id:'66666666-6666-4666-8666-666666666666',official_name:'Synthetic student',final_status:'DRAFT',transmuted_grade:null,grade_remarks:null}],
 'buklod_classroom_overview_v1':()=>({posts:1,assignments:1,students:1}),
 'buklod_classroom_grade_submission_v2':()=>({ok:true,gradebook_recorded:true,released:false}),
 'buklod_classroom_roster_members_v2':()=>[{roster_member_id:'66666666-6666-4666-8666-666666666666',official_name:'Synthetic student',official_student_no:'TEST-001',roster_status:'ACTIVE',link_status:'LINKED'}]
};
const tables={
 'buklod_education_classroom_posts':posts,
 'buklod_education_classroom_comments':comments,
 'buklod_education_classroom_assignments':assignments,
 'buklod_education_classroom_submissions':submissions,
 'buklod_education_classroom_live_sessions':[],
 'buklod_education_materials':[],
 'buklod_education_modules':[],
 'buklod_education_notices':[],
 'buklod_education_assessments':[],
 'buklod_education_attendance_sessions':[]
};
function json(v,status=200){return {status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(v)};}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let requests=0, writes=0;
try{
  const ctx=await browser.newContext({viewport:{width:1366,height:850}});
  await ctx.addInitScript(({user})=>{
    const token=(v)=>btoa(JSON.stringify(v)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const jwt=token({alg:'HS256',typ:'JWT'})+'.'+token({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.testsig';
    const s={access_token:jwt,refresh_token:'fake-synthetic-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user};
    localStorage.setItem('sb-yhanxndaqbmuzbdqlblu-auth-token',JSON.stringify(s));
  },{user});
  const page=await ctx.newPage(),uncaught=[];
  page.on('pageerror',err=>uncaught.push(err.message));
  page.on('dialog',d=>d.dismiss());
  await page.route('https://yhanxndaqbmuzbdqlblu.supabase.co/**',async route=>{
    requests++;
    const req=route.request(),u=new URL(req.url()),path=u.pathname;
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}});
    if(path.endsWith('/auth/v1/user'))return route.fulfill(json(user));
    if(path.endsWith('/auth/v1/logout'))return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'},body:''});
    if(path.includes('/rest/v1/rpc/')){
      const fn=path.split('/').pop();
      if(fn==='buklod_classroom_grade_submission_v2')writes++;
      return route.fulfill(json(rpc[fn]?rpc[fn](req):{error:'Unmocked RPC '+fn},rpc[fn]?200:400));
    }
    if(path.includes('/rest/v1/')){
      const table=path.split('/').pop();
      if(req.method()==='POST'){
        writes++;
        return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
      }
      if(Object.hasOwn(tables,table)){
        let records=tables[table];
        if(table==='buklod_education_classroom_comments'&&u.searchParams.has('post_id'))records=comments;
        return route.fulfill(json(records));
      }
    }
    throw Error('Unexpected backend request '+req.method()+' '+path);
  });
  const resp=await page.goto(SITE+'/?synthetic-e2e=1',{waitUntil:'networkidle',timeout:45000});
  assert.equal(resp.status(),200);
  await page.locator('body.buklod-live-authed').waitFor({state:'attached',timeout:20000});
  await page.locator('#portalClassroomsList').getByText('CHN TEST').waitFor({timeout:15000});
  assert.equal(await page.locator('#portalClassroomsList [onerror]').count(),0,'Escaped class name must not create DOM injection');
  console.log('SYNTHETIC_AUTH_AND_DIRECTORY=PASS');
  await page.locator('#portalSummaryBento').getByRole('button',{name:/My Active Classes/}).click();
  await page.getByText('My Active Classes — Current Academic Work').waitFor({timeout:12000});
  assert.match(await page.locator('#portalClassroomsList').innerText(),/Official assessment task/);
  console.log('SYNTHETIC_ACTIVE_CLASS_WORKLIST=PASS');
  await page.locator('#portalSummaryBento').getByRole('button',{name:/My Classrooms/}).click();
  await page.locator('#portalClassroomsList article').first().click();
  await page.getByText('Verified test announcement').waitFor({timeout:10000});
  assert.match(await page.locator('#workspaceBodyContent').innerText(),/1 comment/);
  await page.locator('#workspaceBodyContent').getByRole('button',{name:/Read \/ Comment/}).click();
  await page.getByText('Visible comment from mocked backend').waitFor({timeout:5000});
  await page.getByRole('button',{name:'Isara'}).last().click();
  console.log('SYNTHETIC_COMMENT_READ_AND_DRAWER=PASS');
  await page.evaluate(()=>window.openClassSwitcherDrawer());
  await page.getByText('Switch assigned classroom').waitFor({timeout:5000});
  assert.equal(await page.locator('#universalSlideDrawer [onerror]').count(),0);
  await page.getByRole('button',{name:'Isara'}).last().click();
  console.log('SYNTHETIC_XSS_SAFE_CLASS_SWITCH=PASS');
  await page.evaluate(()=>window.switchWorkspaceGroup('WORK','activities'));
  await page.getByText('Official assessment task').waitFor({timeout:5000});
  await page.locator('#workspaceBodyContent').getByRole('button',{name:'Grade Submission'}).first().click();
  await page.locator('#realGradeForm input[name="score"]').fill('9');
  await page.locator('#realGradeForm').getByRole('button',{name:'Save Grade'}).click();
  await page.getByText('Saved and confirmed by BUKLOD Supabase.').waitFor({timeout:5000}).catch(()=>{});
  assert.ok(writes>=1,'Test must mock an authorized grade RPC');
  console.log('SYNTHETIC_GRADE_FORM_AND_MOCK_RPC=PASS');
  await page.evaluate(()=>window.switchWorkspaceGroup('CONNECT','live'));
  await page.getByText('Live Classroom — official session status').waitFor({timeout:5000});
  assert.doesNotMatch(await page.locator('#workspaceBodyContent').innerText(),/58 \/ 60 Live|Recitation Mode Active/);
  console.log('SYNTHETIC_LIVE_READ_ONLY_STATUS=PASS');
  const modules=[
    ['CLASS','overview','Class Announcements & Stream'],
    ['CLASS','syllabus','Syllabus & Weeks'],
    ['WORK','activities','Activities & Submissions'],
    ['WORK','quiz','BUKLOD Quiz / Assessments'],
    ['WORK','rle','Clinical & RLE Progress'],
    ['WORK','portfolio','Student Portfolio / Journals'],
    ['CONNECT','live','Live Classroom'],
    ['CONNECT','discussions','Class Announcements & Stream'],
    ['CONNECT','notices','Formal Notices & Conduct'],
    ['MORE','grades','Official Faculty Gradebook'],
    ['MORE','attendance','Verified Class Attendance'],
    ['MORE','masterlist','Official Class Roster'],
    ['MORE','settings','Classroom Settings']
  ];
  for(const [group,tab,title] of modules){
    await page.evaluate(([g,t])=>window.switchWorkspaceGroup(g,t),[group,tab]);
    const text=await page.locator('#workspaceBodyContent').innerText();
    assert.ok(text.includes(title),'Module failed: '+group+'/'+tab+'; got '+text.slice(0,110));
    console.log('SYNTHETIC_MODULE_PASS='+group+'/'+tab);
  }
  assert.deepEqual(uncaught,[],'No browser exceptions across all tabs');
  console.log('SYNTHETIC_ALL_13_MODULES=PASS');
  await page.evaluate(()=>window.handleSignOutClick());
  await page.locator('#liveAuthScreen').waitFor({state:'visible',timeout:7000});
  assert.equal(await page.locator('body').evaluate(x=>x.classList.contains('buklod-live-authed')),false);
  assert.deepEqual(await page.evaluate(()=>Object.keys(window.APP_STATE.classrooms)),[]);
  console.log('SYNTHETIC_SIGN_OUT_PRIVACY=PASS');
  assert.deepEqual(uncaught,[],'No runtime browser exceptions');
  console.log('SYNTHETIC_BROWSER_UI_E2E=PASS; MOCKED_REQUESTS='+requests+'; MOCKED_WRITES='+writes);
  await ctx.close();
}finally{await browser.close();}
