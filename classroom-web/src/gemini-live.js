import { createClient } from '@supabase/supabase-js';

/* BUKLOD Classroom Gemini UI backed by the single authoritative BUKLOD Supabase.
   This browser module uses only a publishable key and signed-in RLS-scoped requests.
   It deliberately refuses simulation of grades, rosters, attendance, live presence,
   role impersonation, offline sync, deletion, and completion status. */
const db = createClient('https://yhanxndaqbmuzbdqlblu.supabase.co', "sb_publishable_RWvrYHzgLMvBousgwn4dTg_QawYzwRS", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const app = window.APP_STATE;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const el = (name) => document.getElementById(name);
const isoId = value => /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(String(value||'')) ? String(value) : '';
const show = msg => window.showToast(String(msg));
const call = async result => {const x=await result; if(x.error)throw x.error; return x.data;};
const fmt = value => value ? new Date(value).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}) : 'Not scheduled';
let activeUser=null, roleByClass=new Map(), cache=new Map(), pending=false, activeRequest=0, activeFilter='all';
const isFaculty = () => roleByClass.get(app.activeClassId)?.faculty===true;
const box = (title,body) => '<section class="surface-card" style="margin-bottom:14px"><h3 style="font-size:16px;font-weight:800;margin-bottom:9px">' + esc(title) + '</h3>' + body + '</section>';
const empty = label => '<p style="color:#64748b;font-size:13px">' + esc(label) + '</p>';
const card = (label,info) => '<div style="padding:11px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;margin-bottom:9px"><strong>' +
  esc(label) + '</strong><div style="font-size:12px;color:#64748b;margin-top:4px">' + esc(info) + '</div></div>';
const button = (title,fn,args='') => '<button class="btn-soft-cyan" onclick="' + fn + '(' + args + ')">' + esc(title) + '</button>';
function safeError(error){return String(error?.message||error||'Request failed').slice(0,250);}
function current(){return cache.get(app.activeClassId)||{};}
function validClass(id){return isoId(id) && Object.hasOwn(app.classrooms,id);}
function statusCard(title){return box(title,empty('This section only displays verified BUKLOD records. Unavailable actions must be completed in the authorized BUKLOD Classroom controls.'));}
function loadingCard(){return box('Loading official Classroom data…',empty('Reading records permitted for your signed-in account.'));}
function projectCards(){
  const classes=Object.values(app.classrooms);
  const selected=classes.filter(c=>activeFilter==='active' ? c.status==='ACTIVE' || c.status==='OPEN' : true);
  el('portalClassroomsList').innerHTML=selected.length ? selected.map(c =>
    '<article class="classroom-portal-card hold-card" role="button" tabindex="0" onclick="openSubjectClass(\''+c.id+'\',\'CLASS\',\'overview\')" ' +
    'onkeydown="if(event.key===\'Enter\')openSubjectClass(\''+c.id+'\',\'CLASS\',\'overview\')" ' +
    'oncontextmenu="openCardContextMenu(event,\'class\',\''+c.id+'\',\'Classroom\')">' +
    '<div class="classroom-card-left"><div class="classroom-icon-tile">'+ window.createCanonicalLogoSVG(48,true)+'</div><div>' +
    '<div class="classroom-card-title">'+esc(c.className)+'</div><div class="classroom-card-sub">'+esc(c.section)+'</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill-badge pill-cyan">'+esc(roleByClass.get(c.id)?.faculty?'Faculty':'Student')+'</span>' +
    '<span class="pill-badge pill-slate">'+esc(c.status || 'Assigned')+'</span><span style="font-size:12px;color:#64748b">'+esc(c.semester)+'</span></div>' +
    '</div></div><div class="classroom-chevron">›</div></article>').join('') : box('No authorized classrooms',empty(activeFilter==='active'?'No active classrooms are assigned to this account.':'No enrolled or faculty classrooms were returned by BUKLOD.'));
  const first=classes[0];
  const active=classes.filter(c=>c.status==='ACTIVE'||c.status==='OPEN');
  const live=[...cache.values()].flatMap(x=>x.live||[]).filter(x=>['LIVE','ACTIVE','STARTED','IN_PROGRESS'].includes(String(x.status||'').toUpperCase()));
  const blocks=[
    ['My Classrooms',classes.length+' Assigned','portal'],
    ['My Active Classes',active.length+' Active','active'],
    ['To Do','Assignments','activities'],
    ['Upcoming','Assessments','quiz'],
    ['Notifications','Official notices','notices'],
    ['Attendance','Verified sessions','attendance'],
    ['My Released Grades','Authorized results','grades'],
    ['Clinical & RLE Progress','Verified records only','rle'],
    ['Live Now',live.length+' live sessions','live'],
    ['Continue','Open last assigned class','overview']
  ];
  el('portalSummaryBento').innerHTML=blocks.map((b)=>{
    const click=b[2]==='portal'?'showPortalHome()':b[2]==='active'?'showActiveClassrooms()':first?
      'openSubjectClass(\''+first.id+'\',\''+(['activities','quiz','rle'].includes(b[2])?'WORK':['live','notices'].includes(b[2])?'CONNECT':['grades','attendance'].includes(b[2])?'MORE':'CLASS')+'\',\''+b[2]+'\')':'showPortalHome()';
    return '<button class="surface-card" style="cursor:pointer;padding:14px 16px;text-align:left;width:100%" onclick="'+click+'"><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase">'+esc(b[0])+'</div><div style="font-size:17px;font-weight:800;margin:5px 0">'+esc(b[1])+'</div><small style="color:#0284c7">Open →</small></button>';
  }).join('');
}
window.renderPortalHome=projectCards;
window.showActiveClassrooms=()=>{activeFilter='active';window.showPortalHome();};
const originalShowPortalHome=window.showPortalHome;
window.showPortalHome=()=>{activeFilter='all';originalShowPortalHome();};
window.refreshPortalList=()=>void refreshClasses();

async function refreshClasses(){
  if(!activeUser)return;
  const results=await Promise.allSettled([
    call(db.rpc('buklod_classroom_my_classes_v2',{p_view:'STUDENT'})),
    call(db.rpc('buklod_classroom_my_classes_v2',{p_view:'FACULTY'}))
  ]);
  if(results.every(r=>r.status==='rejected'))throw results[0].reason;
  const merged=new Map();
  for(const r of results){
    if(r.status!=='fulfilled')continue;
    for(const row of r.value||[]){
      const id=isoId(row.classroom_id);
      if(!id)continue;
      const old=merged.get(id)||{};
      merged.set(id,{...old,...row,can_faculty_view:!!(old.can_faculty_view||row.can_faculty_view||row.role_key==='FACULTY'),
        can_student_view:!!(old.can_student_view||row.can_student_view||row.role_key==='STUDENT')});
    }
  }
  roleByClass=new Map();app.classrooms={};cache=new Map();
  for(const [id,row] of merged){
    roleByClass.set(id,{faculty:row.can_faculty_view,student:row.can_student_view});
    app.classrooms[id]={id,className:row.classroom_name||row.name||'Classroom',section:[row.subject_code,row.section_name].filter(Boolean).join(' · '),
      code:row.subject_code||'',classType:row.classroom_mode||'Classroom',status:String(row.status||''),
      academicYear:row.school_year||'—',semester:row.term||'—',term:row.term||'—',faculty:'Authorized BUKLOD faculty',
      schedule:'See official class schedule',venue:'See official class details',cutoff:'—',title:row.classroom_name||'Classroom',
      syllabusSummary:'Official classroom material',gradingScheme:'official',lifecycleStage:'—',
      announcements:[],modules:[],activities:[],quizzes:[],rleSkills:[],notices:[],roster:[],auditLogs:[]};
  }
  app.activeClassId=Object.keys(app.classrooms)[0]||'';
  window.injectAllCanonicalLogos();
  window.showPortalHome();
  el('portalSubRoleText').textContent='ONE IDENTITY • OFFICIAL BUKLOD RECORDS';
  const oldEmail=el('activeEmailLabel');if(oldEmail)oldEmail.textContent=activeUser.email||'Signed in';
  const create=el('createClassPortalBtn');if(create)create.style.display='none';
  const role=el('rolePersonaSelect');
  if(role){role.innerHTML='<option>Signed in · Authorized BUKLOD roles only</option>';role.disabled=true;}
  const fakeJump=document.querySelector('button[onclick*="99923b52"]');if(fakeJump)fakeJump.style.display='none';
}
async function fetchCurrent(id,tab){
  const c=app.classrooms[id];if(!c)return;
  const request=++activeRequest;
  el('workspaceBodyContent').innerHTML=loadingCard();
  const ctx=await call(db.rpc('buklod_classroom_context_v1',{p_classroom_id:id}));
  if(request!==activeRequest)return;
  const identity=Array.isArray(ctx)?ctx[0]:ctx;
  if(!identity?.role)throw Error('This account has no authorized Classroom role.');
  if(identity.role==='FACULTY'&&!roleByClass.get(id)?.faculty)throw Error('Faculty authorization was not confirmed.');
  const out={context:identity};
  const select=(table,cols)=>db.from(table).select(cols).eq('classroom_id',id);
  if(tab==='overview'||tab==='discussions'){
    out.posts=await call(select('buklod_education_classroom_posts','id,title,body,is_pinned,is_locked,created_at,author_user_id').is('deleted_at',null).order('created_at',{ascending:false}).limit(70));
  }else if(tab==='syllabus'){
    const [a,b]=await Promise.all([
      call(select('buklod_education_modules','id,module_no,title,description,term_key,status').order('module_no',{ascending:true}).limit(120)),
      call(select('buklod_education_materials','id,title,description,is_released,created_at').order('created_at',{ascending:false}).limit(100))]);
    out.modules=a;out.materials=isFaculty()?b:b.filter(m=>m.is_released);
  }else if(tab==='activities'){
    const [a,b]=await Promise.all([
      call(select('buklod_education_classroom_assignments','id,title,description,instructions,points_possible,due_at,status').order('created_at',{ascending:false}).limit(100)),
      call(select('buklod_education_classroom_submissions','id,assignment_id,student_user_id,attempt_no,status,score,faculty_feedback,submitted_at').order('submitted_at',{ascending:false}).limit(300))]);
    out.assignments=isFaculty()?a:a.filter(x=>x.status==='PUBLISHED');
    out.submissions=isFaculty()?b:b.filter(x=>x.student_user_id===activeUser.id);
  }else if(tab==='quiz'){
    out.assessments=await call(select('buklod_education_assessments','id,title,assessment_type,status,opens_at,points_possible').order('created_at',{ascending:false}).limit(80));
    if(!isFaculty())out.assessments=out.assessments.filter(x=>x.status==='PUBLISHED');
  }else if(tab==='live'){
    out.live=await call(select('buklod_education_classroom_live_sessions','id,title,status,started_at,ended_at,call_id,provider').order('created_at',{ascending:false}).limit(8));
  }else if(tab==='notices'){
    out.notices=await call(select('buklod_education_notices','id,title,body,student_user_id,requires_ack,notice_level,visible_from,expires_at,created_at').order('created_at',{ascending:false}).limit(80));
    const now=Date.now();if(!isFaculty())out.notices=out.notices.filter(x=>
      (!x.student_user_id||x.student_user_id===activeUser.id)&&
      (!x.visible_from||new Date(x.visible_from).getTime()<=now)&&
      (!x.expires_at||new Date(x.expires_at).getTime()>now));
  }else if(tab==='grades'){
    out.grades=await call(db.rpc(isFaculty()?'buklod_classroom_gradebook_roster_v1':'buklod_classroom_student_released_grade_items_v2',{p_classroom_id:id}));
  }else if(tab==='attendance'){
    out.attendance=await call(select('buklod_education_attendance_sessions','id,opened_at,closed_at,term_key').order('opened_at',{ascending:false}).limit(60));
    if(!isFaculty())out.studentAttendance=await call(db.rpc('buklod_classroom_student_attendance_v1',{p_classroom_id:id}));
  }else if(tab==='masterlist'){
    out.roster=isFaculty()?await call(db.rpc('buklod_classroom_roster_members_v2',{p_classroom_id:id})):[];
  }else if(tab==='rle'||tab==='portfolio'){
    out.health=await call(db.rpc('buklod_classroom_overview_v1',{p_classroom_id:id}));
  }
  if(request!==activeRequest)return;
  cache.set(id,{...cache.get(id),...out,loadedTab:tab});
  c.roster=isFaculty()?(out.roster||cache.get(id)?.roster||[]):[];
  const liveSessions=(out.live||[]).filter(s=>['LIVE','ACTIVE','STARTED','IN_PROGRESS'].includes(String(s.status).toUpperCase()));
  if(liveSessions.length)app.liveSession={active:true,mode:'LIVE',connectedCount:0,maxTarget:0,activeCameras:0};
}
const originalOpen=window.openSubjectClass;
window.openSubjectClass=async(id,group='CLASS',tab='overview')=>{
  if(!validClass(id)){show('Classroom access denied.');return;}
  try{app.activeClassId=id;app.activeGroup=group;app.activeSubtab=tab;await fetchCurrent(id,tab);originalOpen(id,group,tab);
    history.replaceState({},'',location.pathname+'?class='+encodeURIComponent(id)+'&group='+encodeURIComponent(group)+'&tab='+encodeURIComponent(tab));
  }catch(error){show('Could not open authorized Classroom: '+safeError(error));window.showPortalHome();}
};
const originalGroup=window.switchWorkspaceGroup;
window.switchWorkspaceGroup=async(group,tab)=>{
  if(!['CLASS','WORK','CONNECT','MORE'].includes(group))return;
  const key=tab||window.SUBTABS_BY_GROUP[group][0].id;
  app.activeGroup=group;app.activeSubtab=key;
  try{await fetchCurrent(app.activeClassId,key);originalGroup(group,key);}
  catch(err){el('workspaceBodyContent').innerHTML=box('Could not load',empty(safeError(err)));}
};
const originalSubtab=window.switchWorkspaceSubtab;
window.switchWorkspaceSubtab=async key=>{
  try{await fetchCurrent(app.activeClassId,key);originalSubtab(key);}
  catch(err){el('workspaceBodyContent').innerHTML=box('Could not load',empty(safeError(err)));}
};
const rows=(items,make)=>items?.length?items.map(make).join(''):empty('No authorized records found.');
window.renderTabOverview=c=>box('Class Announcements & Stream',
  (isFaculty()?button('+ Magpaskil ng Anunsyo','openRealPost')+'<div style="height:12px"></div>':'')+
  rows(current().posts,p=>card(p.title||'Class discussion',p.body||'')+
  button('Open / Comment','openRealComment',JSON.stringify(p.id))));
window.renderTabDiscussions=c=>window.renderTabOverview(c);
window.renderTabSyllabus=c=>box('Syllabus & Weeks',rows(current().modules,m=>card('Week '+(m.module_no||'—')+' · '+m.title,m.description)))+
  box('Official Class Materials',rows(current().materials,m=>card(m.title,m.description||'Released learning material')));
window.renderTabActivities=c=>box('Activities & Submissions',rows(current().assignments,a=>card(a.title,
  (a.instructions||a.description||'')+' · Due: '+fmt(a.due_at)+' · '+a.points_possible+' pts')+
  (!isFaculty()?button('Submit Answer','openRealSubmit',JSON.stringify(a.id)):'')+
  (isFaculty()?current().submissions.filter(x=>x.assignment_id===a.id).map(x=>
    card('Student submission · '+x.status,'Submitted '+fmt(x.submitted_at)+ ' · '+(x.score??'Not graded'))+
    button('Grade Submission','openRealGrade',JSON.stringify(x.id))).join(''):'')));
window.renderTabQuiz=c=>box('BUKLOD Quiz / Assessments',rows(current().assessments,x=>
  card(x.title,(x.status||'')+' · '+fmt(x.opens_at)+' · '+(x.points_possible??'—')+' points'))+
  empty('To take a timed assessment, use the official BUKLOD Quiz entry point. No simulated attempts or scores are created here.'));
window.renderTabLiveClassroom=c=>box('Live Classroom — official session status',
  rows(current().live?.slice(0,8),x=>card(x.title||'Class live session',
    'Status: '+(x.status||'UNKNOWN')+' · Started: '+fmt(x.started_at)+' · Provider: '+(x.provider||'BUKLOD')))+
  empty('Audio/video sessions and recitation controls operate in the authorized BUKLOD Classroom app. This web viewer does not claim to connect to a call, assign points, or mark attendance.'));
window.renderTabNotices=c=>box('Formal Notices & Conduct',rows(current().notices,x=>
  card(x.title,x.body||'Official notice')));
window.renderTabGrades=c=>box(isFaculty()?'Official Faculty Gradebook':'My Released Grades',
  isFaculty()?rows(current().grades,x=>card(x.official_name,
    'Status: '+(x.final_status||'Draft')+' · Transmuted: '+(x.transmuted_grade??'Not released')+
    ' · Remarks: '+(x.grade_remarks||'—'))):
  rows(current().grades,x=>card(x.title,'Score: '+(x.score??'—')+'/'+(x.points_possible??'—')+
    ' · Status: '+(x.status||'—')+' · '+(x.feedback||''))));
window.renderTabAttendance=c=>box('Verified Class Attendance',
  rows(current().attendance,x=>card('Session '+fmt(x.opened_at),
    'Closed: '+fmt(x.closed_at)+' · '+(x.term_key||'Term not specified')))+
  (!isFaculty()?box('My Attendance',rows(current().studentAttendance,x=>card(x.status,fmt(x.time_in)))):''));
window.renderTabMasterlist=c=>box('Official Class Roster',
  (isFaculty()?rows(current().roster,x=>card(x.official_name,(x.official_student_no||'Unassigned ID')+
  ' · '+x.roster_status+' · '+x.link_status)):empty('Student accounts cannot access the private faculty roster.'))+
  empty('Import and roster modifications require the official validated eight-step importer.'));
window.renderTabRLE=c=>statusCard('Clinical & RLE Progress');
window.renderTabPortfolio=c=>statusCard('Student Portfolio / Journals');
window.renderTabSettings=c=>box('Classroom Settings',card(c.className,
  'Status: '+c.status+' · Term: '+c.term+' · Classroom ID: '+c.id)+
  empty('Archiving, deletion, and roster changes require the authorized administrative workflow.'));

let writeBusy=false;
async function writeOnce(task){
  if(writeBusy)return;
  writeBusy=true;
  try{await task();show('Saved and confirmed by BUKLOD Supabase.');await fetchCurrent(app.activeClassId,app.activeSubtab);window.closeSlideDrawer();window.renderSubjectWorkspace();}
  catch(err){show('Not saved: '+safeError(err));}
  finally{writeBusy=false;}
}
window.openRealPost=()=>{
  if(!isFaculty())return show('Faculty access required.');
  window.openSlideDrawer('OFFICIAL POST','New Class Announcement',
    '<form id="realPostForm"><label class="field">Title<input name="title" class="form-input" maxlength="200" required></label><label class="field">Message<textarea name="body" class="form-textarea" maxlength="10000" required></textarea></label><button class="btn-primary-cyan" type="submit">Publish to Class</button></form>');
  el('realPostForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);
    void writeOnce(()=>call(db.from('buklod_education_classroom_posts').insert({
      classroom_id:app.activeClassId,author_user_id:activeUser.id,post_type:'ANNOUNCEMENT',
      title:String(f.get('title')||'').trim(),body:String(f.get('body')||'').trim()
    })));};
};
window.openRealComment=postId=>{
  const p=current().posts?.find(x=>x.id===postId);
  if(!p)return show('Post unavailable.');
  if(p.is_locked)return show('This post is locked.');
  window.openSlideDrawer('CLASS DISCUSSION',p.title||'Post',
    '<p style="margin-bottom:14px">'+esc(p.body)+'</p><form id="realCommentForm"><textarea name="body" class="form-textarea" rows="4" required maxlength="1200" placeholder="Write a comment"></textarea><button type="submit" class="btn-primary-cyan">Post Comment</button></form>');
  el('realCommentForm').onsubmit=e=>{e.preventDefault();const text=String(new FormData(e.target).get('body')||'').trim();
    if(!text)return;void writeOnce(()=>call(db.from('buklod_education_classroom_comments').insert({
      classroom_id:app.activeClassId,post_id:p.id,author_user_id:activeUser.id,body:text
    })));};
};
window.openRealSubmit=assignmentId=>{
  if(isFaculty())return show('Student submission mode required.');
  const assignment=current().assignments?.find(x=>x.id===assignmentId && x.status==='PUBLISHED');
  if(!assignment)return show('Assignment unavailable.');
  window.openSlideDrawer('OFFICIAL SUBMISSION',assignment.title,
    '<form id="realSubmitForm"><textarea name="body" class="form-textarea" rows="5" maxlength="10000" placeholder="Your answer"></textarea><label class="field">Secure HTTPS link (optional)<input name="link" class="form-input" type="url" placeholder="https://..."></label><button class="btn-primary-cyan" type="submit">Submit Answer</button></form>');
  el('realSubmitForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);
    const body=String(f.get('body')||'').trim(),link=String(f.get('link')||'').trim();
    if(!body&&!link)return show('Add an answer or HTTPS link.');
    if(link&&!/^https:\/\/[^\s]+$/i.test(link))return show('Only secure HTTPS links are allowed.');
    const prior=current().submissions?.filter(x=>x.assignment_id===assignmentId&&x.student_user_id===activeUser.id)||[];
    const attempt_no=Math.max(0,...prior.map(x=>Number(x.attempt_no)||0))+1;
    void writeOnce(()=>call(db.from('buklod_education_classroom_submissions').insert({
      classroom_id:app.activeClassId,assignment_id:assignmentId,student_user_id:activeUser.id,
      attempt_no,text_response:body||null,link_url:link||null,status:'SUBMITTED',submitted_at:new Date().toISOString()
    })));};
};
window.openRealGrade=submissionId=>{
  if(!isFaculty())return show('Faculty access required.');
  const sub=current().submissions?.find(x=>x.id===submissionId);
  const ass=current().assignments?.find(x=>x.id===sub?.assignment_id);
  if(!sub||!ass)return show('Submission unavailable.');
  window.openSlideDrawer('OFFICIAL GRADING','Grade submission',
    '<p>Maximum: '+esc(ass.points_possible)+'</p><form id="realGradeForm"><label class="field">Score<input name="score" class="form-input" type="number" min="0" max="'+esc(ass.points_possible)+'" step="0.01" required></label><label class="field">Feedback<textarea class="form-textarea" name="feedback" maxlength="4000"></textarea></label><label><input name="release" type="checkbox"> Release grade to student</label><button class="btn-primary-cyan" type="submit">Save Grade</button></form>');
  el('realGradeForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const score=Number(f.get('score'));
    if(!Number.isFinite(score)||score<0||score>Number(ass.points_possible))return show('Score outside allowed range.');
    void writeOnce(()=>call(db.rpc('buklod_classroom_grade_submission_v2',{
      p_submission_id:sub.id,p_score:score,p_feedback:String(f.get('feedback')||''),
      p_release:f.get('release')==='on'
    })));};
};

// Never impersonate other accounts or show fake successful academic transactions.
const unsupported=['confirmCreateClassroom','runEightStepRosterWizard','confirmRosterImportCommit',
  'archiveCurrentClass','attemptDeleteCurrentClass','updateStudentScore','updateStudentException',
  'setStudentAttendance','markAllAttendancePresent','setLiveTeachingMode','callRandomLiveStudent',
  'recordLiveRecitationScore','undoLastRecitationScore','autoGenerateSyllabusWeek','testIdempotentSubmission',
  'triggerQuickCheckPulse','syncQuizToGradebook','addMakeupDutyHours','toggleRleSkillCompetency',
  'saveJournalEntry','saveSpeedGraderScore','saveQuickAddItem','addAnnouncementComment',
  'pushDirectlyToGitHub','openVercelDeployDrawer','openSpeedGraderDrawer','exportGradebookCSV',
  'acknowledgeFormalNotice','advanceGradeLifecycle','changeGradingScheme','launchInteractiveQuizDrawer',
  'postClassChatMessage','sendCallAttentionAlert','submitInteractiveQuizAttempt','submitQuickAdd',
  'syncLiveAttendanceToClass','copyFullHtmlToClipboard','downloadFullHtmlFile'];
for(const name of unsupported)window[name]=()=>show('This action is not available in Classroom web until its secure backend workflow is verified. No records were changed.');
window.switchPersona=()=>show('Account roles are assigned by BUKLOD authorization, not by a browser switch.');
window.toggleOfflineMode=()=>show('Offline writes are not enabled in this web release. Reconnect before submitting work.');
window.openAuditDrawer=()=>window.openSlideDrawer('LIVE SYSTEM STATUS','Authenticated BUKLOD Classroom',
  box('Verified session',card(activeUser?.email||'Unknown',
  Object.keys(app.classrooms).length+' authorized classroom(s) · Supabase RLS protected'))+
  empty('The original prototype 15/15 badge is not an actual end-to-end production audit.'));
window.openQuickAddDrawer=type=>{if(type==='announcement'||!type)return window.openRealPost();show('Use the corresponding authorized class module to create this item.');};
window.openCreateClassroomDrawer=()=>show('Use the authorized BUKLOD Main faculty controls to create a classroom.');
window.openItemInspector=(type,id)=>type==='announcement'?window.openRealComment(id):show('Open the relevant official module for details.');
window.runContextAction=action=>{window.closeContextMenu();show(action==='open'?'Open the official classroom module.':'This context action requires a verified backend write. Nothing was modified.');};
window.handleSignOutClick=async()=>{
  try{await call(db.auth.signOut());activeUser=null;app.classrooms={};cache=new Map();document.body.classList.remove('buklod-live-authed');displayAuth();}
  catch(error){show(safeError(error));}
};

function displayAuth(errorText=''){
  el('liveAuthScreen')?.remove();
  const node=document.createElement('section');node.id='liveAuthScreen';node.innerHTML=
    '<div class="auth-wrap"><div style="font-size:34px;margin-bottom:10px">▦</div><h1>BUKLOD Classroom</h1>' +
    '<p>Sign in with your BUKLOD account to access your assigned classrooms and official academic records.</p>'+
    '<form id="liveLogin"><label>Email<input name="email" type="email" required autocomplete="username" placeholder="Your BUKLOD email"></label>'+
    '<label>Password<input name="password" type="password" required autocomplete="current-password" placeholder="Password"></label>'+
    '<p id="liveLoginError" role="alert" style="color:#be123c;font-size:12px">'+esc(errorText)+'</p>'+
    '<button type="submit">Sign in securely</button></form>'+
    '<button class="auth-secondary" id="livePasswordReset" type="button">Reset password</button></div>';
  document.body.appendChild(node);
  el('liveLogin').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),submit=e.target.querySelector('button[type=submit]');submit.disabled=true;
    try{await call(db.auth.signInWithPassword({email:String(f.get('email')||'').trim(),password:String(f.get('password')||'')}));await hydrate();}
    catch(err){el('liveLoginError').textContent=safeError(err);submit.disabled=false;}};
  el('livePasswordReset').onclick=async()=>{
    const email=prompt('Enter your BUKLOD account email for password reset.');
    if(!email)return;
    try{await call(db.auth.resetPasswordForEmail(String(email).trim(),{redirectTo:location.origin}));el('liveLoginError').textContent='Reset instructions sent if the account exists.';}
    catch(err){el('liveLoginError').textContent=safeError(err);}
  };
}
async function hydrate(){
  const {data,error}=await db.auth.getUser();
  if(error||!data?.user){displayAuth();return;}
  activeUser=data.user;
  await refreshClasses();
  el('liveAuthScreen')?.remove();
  document.body.classList.add('buklod-live-authed');
  const requested=new URLSearchParams(location.search);
  const id=requested.get('class');
  if(validClass(id))await window.openSubjectClass(id,requested.get('group')||'CLASS',requested.get('tab')||'overview');
}
const guardStyle=document.createElement('style');guardStyle.textContent=
  'body:not(.buklod-live-authed)>header,body:not(.buklod-live-authed)>main,body:not(.buklod-live-authed)>.drawer-backdrop,'+
  'body:not(.buklod-live-authed)>.slide-drawer{display:none!important}#liveAuthScreen{position:fixed;inset:0;z-index:10000;'+
  'background:#f3f8fa;display:grid;place-items:center;padding:20px;overflow:auto}'+
  '#liveAuthScreen .auth-wrap{width:min(420px,100%);background:#fff;border-radius:20px;padding:32px;border:1px solid #dbe7ed;box-shadow:0 12px 45px #0f172a14}'+
  '#liveAuthScreen h1{font-size:25px}#liveAuthScreen p{color:#64748b;margin:12px 0 20px}'+
  '#liveAuthScreen label{display:block;font-weight:650;margin:14px 0}#liveAuthScreen input{display:block;width:100%;margin-top:6px;'+
  'padding:12px;border:1px solid #cbd5e1;border-radius:12px}#liveAuthScreen button{width:100%;padding:12px;margin-top:10px;'+
  'background:#0284c7;border-radius:12px;color:#fff;font-weight:700}#liveAuthScreen .auth-secondary{background:#f0f9ff;color:#0284c7}'+
  'button:disabled{opacity:.55;cursor:not-allowed}';
document.head.appendChild(guardStyle);
const oldStatus=el('networkToggleBtn');if(oldStatus){oldStatus.title='Network status; no simulated offline queue';}
const auditBtn=document.querySelector('button[onclick="openAuditDrawer()"]');if(auditBtn)auditBtn.textContent='System Status';
for(const selector of ['button[onclick="openVercelDeployDrawer()"]','button[onclick*="99923b52"]']){
  document.querySelectorAll(selector).forEach(node=>node.style.display='none');
}
window.addEventListener('offline',()=>{const x=el('networkLabel');if(x)x.textContent='Offline · Read only';});
window.addEventListener('online',()=>{const x=el('networkLabel');if(x)x.textContent='Online · BUKLOD';});
displayAuth();
try{await hydrate();}catch(err){displayAuth('Could not load your assigned classrooms: '+safeError(err));}
