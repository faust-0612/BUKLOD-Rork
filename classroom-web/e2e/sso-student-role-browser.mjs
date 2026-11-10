import assert from 'node:assert/strict';
import { chromium } from '/tmp/buklod-classroom-browser/node_modules/playwright/index.mjs';

const url=process.env.PREVIEW_URL;
assert.ok(/^https:\/\/buklod-classroom--[a-z0-9]+\.expo\.app$/.test(url||''),'Use immutable Expo Preview only');
const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const classId='11111111-1111-4111-8111-111111111111';
const otherId='22222222-2222-4222-8222-222222222222';
const tokenHash='a'.repeat(64);
const user={
 id:userId,email:'synthetic-student@example.invalid',aud:'authenticated',
 role:'authenticated',created_at:'2026-11-10T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}
};
const base={
 classroom_id:classId,classroom_name:'STUDENT CHN Test',subject_code:'CHN',section_name:'3D',
 school_year:'2026-2027',term:'FIRST',status:'ACTIVE',classroom_mode:'LECTURE',role_key:'STUDENT',
 can_faculty_view:false,can_student_view:true
};
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'GET,POST,OPTIONS'};
const json=(body,status=200)=>({status,contentType:'application/json',headers:cors,body:JSON.stringify(body)});
function session(){
 const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.synthetic';
 return {access_token:jwt,refresh_token:'synthetic-refresh-student',expires_in:3600,token_type:'bearer',user};
}
async function run(mode,dual=false,mismatch=false){
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({viewport:{width:1180,height:820}});
  const page=await context.newPage(),unexpected=[],used=[];
  page.on('pageerror',e=>unexpected.push(e.message));
  page.on('dialog',d=>d.dismiss());
  await page.route('https://yhanxndaqbmuzbdqlblu.supabase.co/**',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;
   used.push(req.method()+' '+p);
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});
   if(p.endsWith('/auth/v1/verify')){
     const body=JSON.parse(req.postData()||'{}');
     assert.equal(body.token_hash,tokenHash);
     assert.equal(body.type,'email');
     return route.fulfill(json({...session(),user:mismatch?{...user,id:otherId}:user}));
   }
   if(p.endsWith('/auth/v1/user'))return route.fulfill(json(mismatch?{...user,id:otherId}:user));
   if(p.endsWith('/auth/v1/logout'))return route.fulfill({status:204,headers:cors,body:''});
   if(p.includes('/rest/v1/rpc/')){
    const fn=p.split('/').pop(),body=JSON.parse(req.postData()||'{}');
    if(fn==='buklod_classroom_launcher_access_v1')return route.fulfill(json({
      can_open:true,is_faculty:dual,is_student:true,default_mode:dual?'CHOOSE':'STUDENT'
    }));
    if(fn==='buklod_classroom_my_classes_v2')
      return route.fulfill(json(body.p_view==='FACULTY'?(dual?[{...base,role_key:'FACULTY',can_faculty_view:true}]:[]):[{...base,can_faculty_view:dual}]));
    if(fn==='buklod_classroom_context_v1')
      return route.fulfill(json({role:dual?'FACULTY':'STUDENT',is_student:true,is_faculty:dual}));
    if(fn==='buklod_classroom_student_released_grade_items_v2')
      return route.fulfill(json([{id:'33333333-3333-4333-8333-333333333333',title:'Released test score',
       score:8,points_possible:10,status:'RELEASED'}]));
    if(fn==='buklod_classroom_gradebook_roster_v1')
      return route.fulfill(json([{official_name:'Official synthetic student',final_status:'RELEASED',transmuted_grade:90}]));
    return route.fulfill(json({},400));
   }
   if(p.includes('/rest/v1/')){
    const name=p.split('/').pop();
    if(req.method()!=='GET')throw Error('Unexpected mutation in synthetic SSO test: '+name);
    if(['buklod_education_classroom_live_sessions','buklod_education_classroom_posts',
        'buklod_education_classroom_comments','buklod_education_classroom_assignments',
        'buklod_education_classroom_submissions','buklod_education_notices'].includes(name))
      return route.fulfill(json([]));
   }
   throw Error('Unhandled endpoint '+p);
  });
  const hash='#buklod_classroom_token_hash='+tokenHash+'&buklod_mode='+mode+'&buklod_user_id='+userId;
  await page.goto(url+'/?test=sso'+hash,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(100);
  assert.doesNotMatch(page.url(),/buklod_classroom_token_hash|buklod_user_id/,'One-time secret must be wiped from address bar');
  if(mismatch){
    await page.locator('#liveAuthScreen').waitFor({state:'visible',timeout:12000});
    assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('buklod-live-authed')),false);
    assert.ok(!used.some(x=>x.includes('buklod_classroom_my_classes_v2')),'No class query on wrong user');
    console.log('SSO_WRONG_USER_FAILS_CLOSED=PASS');
  }else{
    await page.locator('body.buklod-live-authed').waitFor({state:'attached',timeout:12000});
    assert.equal(await page.locator('#liveAuthScreen').count(),0,'No second login for Main handoff');
    assert.match(await page.locator('#portalClassroomsList').innerText(),/STUDENT CHN Test/);
    assert.equal(await page.locator('#rolePersonaSelect').inputValue(),'STUDENT');
    console.log('SSO_NO_SECOND_LOGIN_'+(dual?'DUAL':'STUDENT_ONLY')+'=PASS');
    await page.evaluate(()=>window.openSubjectClass('11111111-1111-4111-8111-111111111111','MORE','grades'));
    await page.getByText('Released test score').waitFor({timeout:9000});
    assert.ok(used.some(x=>x.includes('student_released_grade_items_v2')));
    assert.ok(!used.some(x=>x.includes('gradebook_roster_v1')),'Student View must not call faculty roster RPC');
    console.log('STUDENT_RELEASED_ONLY_GRADE_VIEW=PASS');
    await page.evaluate(()=>window.switchPersona('FACULTY'));
    if(dual){
      assert.equal(await page.locator('#rolePersonaSelect').inputValue(),'FACULTY');
      assert.match(await page.locator('#portalSummaryBento').innerText(),/MY CLASSROOMS/i);
      await page.evaluate(()=>window.openSubjectClass('11111111-1111-4111-8111-111111111111','MORE','grades'));
      await page.getByText('Official synthetic student').waitFor({timeout:9000});
      assert.ok(used.some(x=>x.includes('gradebook_roster_v1')),'Authorized Faculty switch must load faculty roster');
      console.log('DUAL_ROLE_SWITCH_WITHOUT_RELOGIN=PASS');
    }else{
      assert.equal(await page.locator('#rolePersonaSelect').inputValue(),'STUDENT');
      assert.ok(!used.some(x=>x.includes('gradebook_roster_v1')),'Student-only must never call faculty roster');
      console.log('STUDENT_ONLY_FACULTY_ESCALATION_BLOCKED=PASS');
    }
  }
  assert.deepEqual(unexpected,[],'No JS exception in synthetic SSO path');
  await context.close();
 }finally{await browser.close();}
}
await run('STUDENT',false,false);
await run('STUDENT',true,false);
await run('STUDENT',false,true);
console.log('SYNTHETIC_MAIN_CLASSROOM_SSO_E2E_ALL_PASS');
