import { createClient } from '@supabase/supabase-js';
import './style.css';
import { esc, safeLink, formatDate, clampText, canRequestClassDeletion, deletionNameMatches } from './utils.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const root = document.querySelector('#app');
const db = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: {
    fetch: (input, options = {}) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);
      if (options.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      return fetch(input, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
    }
  }
}) : null;

const state = { user: null, classes: [], classId: '', context: null, overview: null,
  tab: 'overview', group: 'CLASS', data: [], additional: [], gradeCategories: [], thread: null, busy: false, loading: true,
  error: '', recover: false, seq: 0 };
const tabs = [
  ['overview', 'Overview'], ['discussions', 'Discussions'], ['chat', 'Class Messages'],
  ['activities', 'Activities'], ['materials', 'Materials'], ['attendance', 'Attendance'],
  ['grades', 'My Grades'], ['assessments', 'Assessments'], ['notices', 'Notices'],
  ['monitor', 'Class Monitor'], ['faculty', 'Faculty Tools']
];

const GROUP_TABS = Object.freeze({
  CLASS: [['overview','Overview'],['materials','Materials'],['notices','Notices']],
  WORK: [['activities','Activities'],['assessments','BUKLOD Quiz / Assessments']],
  CONNECT: [['discussions','Discussions'],['chat','Class Messages']],
  MORE: [['attendance','Attendance'],['grades','Gradebook'],['monitor','Class Monitor'],['faculty','Faculty Tools']]
});
const GROUP_LABELS = Object.freeze({CLASS:'Class',WORK:'Work',CONNECT:'Connect',MORE:'More'});
const DEFAULT_TAB = Object.freeze({CLASS:'overview',WORK:'activities',CONNECT:'discussions',MORE:'grades'});
const groupOf = tab => Object.entries(GROUP_TABS).find(([,list])=>list.some(([id])=>id===tab))?.[0]||'CLASS';
const classLink = (id,tab) => '?class='+encodeURIComponent(id)+'&group='+encodeURIComponent(groupOf(tab))+'&tab='+encodeURIComponent(tab);
const validTab = (tab,group) => tabs.some(([id])=>id===tab) ? tab : DEFAULT_TAB[group]||'overview';
const e = esc;
const norm = (v) => v == null ? '' : String(v);
const el = (tag, cls, value) => '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>' + e(norm(value)) + '</' + tag + '>';
const fmt = (x) => formatDate(x);
const noRows = (label) => '<div class="empty"><strong>Nothing to show yet</strong><p>' + e(label) + '</p></div>';
const pill = (t) => '<span class="pill">' + e(norm(t)) + '</span>';
const btn = (label, action, id, style) => '<button type="button" class="' + (style || 'quiet') +
  '" data-action="' + e(action) + '"' + (id ? ' data-id="' + e(id) + '"' : '') + '>' + e(label) + '</button>';
const field = (label, name, placeholder, required = false) => '<label class="field"><span>' + e(label) +
  '</span><input name="' + e(name) + '" placeholder="' + e(placeholder) + '"' +
  (required ? ' required' : '') + ' maxlength="200" /></label>';
const textarea = (label, name, placeholder) => '<label class="field"><span>' + e(label) +
  '</span><textarea name="' + e(name) + '" rows="3" maxlength="10000" placeholder="' + e(placeholder) + '"></textarea></label>';
const isFaculty = () => state.context?.role === 'FACULTY';
const isStudent = () => state.classes.find(c => c.classroom_id === state.classId)?.can_student_view === true;
const canDeleteClass = () => canRequestClassDeletion(state.context, state.user?.id);
function notice(message, bad = false) {
  const target = document.querySelector('#feedback');
  if (target) { target.textContent = message; target.className = 'feedback' + (bad ? ' error' : ''); }
  else if (bad) window.alert(message);
}
function errorMessage(error) {
  return error?.name === 'AbortError' ? 'Network timeout. Check your connection and retry.' :
    norm(error?.message || error || 'Request failed.');
}
async function checked(request) {
  const result = await request;
  if (result.error) throw result.error;
  return result.data;
}
function render() {
  if (!db) {
    root.innerHTML = '<div class="login-layout"><section class="login-card"><h1>BUKLOD Classroom</h1>' +
      '<p>Web configuration is incomplete. An administrator needs to configure the Classroom publishable environment.</p></section></div>';
    return;
  }
  if (state.loading) { root.innerHTML = '<div class="splash"><span class="spinner"></span> Loading BUKLOD Classroom…</div>'; return; }
  if (!state.user || state.recover) { renderAuth(); return; }
  if (!state.classId) { renderClasses(); return; }
  renderClass();
}
function renderAuth() {
  root.innerHTML = '<div class="login-layout"><section class="login-brand"><img src="/buklod-classroom-cyan.svg" class="brand-mark" alt="BUKLOD Classroom cyan logo" width="64" height="64" />' +
    '<p class="eyebrow">BUKLOD EDUCATION</p><h1>One connected classroom.</h1>' +
    '<p>Learning resources, discussions, activities, attendance, and released grades — secured by your BUKLOD account.</p>' +
    '<div class="brand-note">Same BUKLOD education records. No separate student database.</div></section>' +
    '<section class="login-card"><p class="eyebrow">ACCOUNT ACCESS</p><h2>' +
    (state.recover ? 'Set new password' : 'Sign in to Classroom') + '</h2>' +
    (state.recover
      ? '<form data-form="password">' + field('New password', 'password', 'At least 8 characters', true) +
        '<button class="primary full" type="submit">Update password</button></form>'
      : '<form data-form="login">' + field('BUKLOD email', 'email', 'you@example.com', true) +
        '<label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required /></label>' +
        '<button class="primary full" type="submit">Sign in securely</button></form>' +
        '<details class="recovery"><summary>Forgot password?</summary><form data-form="reset">' +
        field('Account email', 'email', 'you@example.com', true) +
        '<button type="submit" class="quiet">Send reset link</button></form></details>') +
    '<p class="muted">Use your existing BUKLOD account. Access to each class is controlled by official enrollment or faculty assignment.</p>' +
    '<div id="feedback" class="feedback"></div></section></div>';
}
function layout(content, title) {
  const nav = '<header class="topbar"><div class="logo"><img src="/buklod-classroom-cyan.svg" class="brand-mark small" alt="BUKLOD Classroom cyan logo" width="42" height="42" />' +
    '<span><strong>BUKLOD Classroom</strong><small>Connected Learning</small></span></div>' +
    '<div class="top-actions"><span class="account" title="Signed-in account">' + e(state.user?.email || 'BUKLOD user') +
    '</span>' + btn('My Classes', 'classes') + btn('Sign out', 'signout') + '</div></header>';
  root.innerHTML = nav + '<main class="shell"><div class="heading"><p class="eyebrow">CLASSROOM PORTAL</p><h1>' +
    e(title) + '</h1></div>' + content + '<div id="feedback" class="feedback"></div></main>';
}
function renderClasses() {
  const list = state.classes.map(c => '<button class="class-card" data-action="open-class" data-id="' + e(c.classroom_id) +
    '"><span class="class-icon">📚</span><span><strong>' + e(c.classroom_name) +
    '</strong><small>' + e([c.subject_code,c.section_name,c.term].filter(Boolean).join(' · ') || 'BUKLOD Classroom') +
    '</small><span class="role-row">' + (c.can_faculty_view ? pill('Faculty') : '') +
    (c.can_student_view ? pill('Student') : '') + '</span></span><span class="chevron">›</span></button>').join('');
  layout('<div class="cards-area"><section><div class="section-line"><h2>Your Classrooms</h2>' +
    btn('Refresh', 'refresh-classes') + '</div>' +
    (list || noRows('No active classes linked to your BUKLOD account. Ask your faculty to add you to the official roster.')) +
    '</section><aside class="side-card"><h3>Student access</h3><p>Course materials, classroom discussions, official work, attendance and released grades are shown only for your enrolled classes.</p>' +
    '<h3>Faculty access</h3><p>Assigned faculty can manage their authorized classrooms. Faculty operations remain isolated from BUKLOD Main until release approval.</p>' +
    '<p class="muted">This portal does not grant new permissions. All requests follow BUKLOD Supabase RLS and secure backend functions.</p></aside></div>',
    'My Classrooms');
}
function navClasses() {
  const group = GROUP_TABS[state.group] ? state.group : groupOf(state.tab);
  const top = '<nav class="nav-groups" aria-label="Classroom navigation">' +
    Object.keys(GROUP_TABS).map(g => '<button type="button" data-action="group" data-id="'+g+'" class="nav-group'+
      (group===g?' active':'')+'" aria-current="'+(group===g?'page':'false')+'">'+GROUP_LABELS[g]+'</button>').join('')+'</nav>';
  const visible = GROUP_TABS[group].filter(([id])=>id!=='faculty'||isFaculty());
  return top + (group==='CONNECT' ? '<p class="group-caption">Live classroom sessions remain in the authorized BUKLOD app; web messages and discussions work here.</p>' : '') +
    '<div class="tabstrip" role="tablist" aria-label="'+GROUP_LABELS[group]+' modules">' +
    visible.map(([id,label])=>'<button type="button" role="tab" aria-selected="'+(state.tab===id)+
      '" class="tab'+(state.tab===id?' active':'')+'" data-action="tab" data-id="'+id+'">'+e(label)+'</button>').join('')+'</div>';
}
function renderClass() {
  const c = state.context || {};
  const summary = '<div class="class-head"><div><div class="class-back">' +
    btn('← Back to My Classes', 'classes', null, 'back-button') + '</div><p class="eyebrow">' +
    e([c.subject_code,c.section_name,c.term].filter(Boolean).join(' · ') || 'ACTIVE CLASSROOM') +
    '</p><h2>' + e(c.name || 'Classroom') + '</h2><p>' + e(c.description || 'Your BUKLOD connected classroom') +
    '</p></div><div class="head-actions">' + pill(c.role || 'MEMBER') +
    btn('Refresh module', 'refresh-tab') +
    (canDeleteClass() ? btn('Delete Class', 'delete-class', null, 'danger-outline') : '') +
    '</div></div>';
  layout(summary + navClasses() + '<section id="module" class="module">' + (state.error ? '<div class="feedback error" role="alert">' + e(state.error) + '</div>' : '') + moduleContent() + '</section>', c.name || 'Classroom');
}
function moduleContent() {
  if (state.busy && !state.data.length) return '<div class="splash inline"><span class="spinner"></span> Loading module…</div>';
  const rows = state.data || [];
  if (state.tab === 'overview') return overviewModule();
  if (state.tab === 'discussions') return discussions(rows);
  if (state.tab === 'chat') return chat(rows);
  if (state.tab === 'activities') return activities(rows);
  if (state.tab === 'materials') return materials(rows);
  if (state.tab === 'attendance') return attendance(rows);
  if (state.tab === 'grades') return grades(rows);
  if (state.tab === 'assessments') return assessments(rows);
  if (state.tab === 'notices') return notices(rows);
  if (state.tab === 'monitor') return monitor(rows);
  if (state.tab === 'faculty') return faculty(rows);
  return noRows('This module is not available.');
}
function overviewModule() {
  const o = state.overview || {};
  const cards = [['Discussions','discussions',o.posts],['Activities','activities',o.assignments],
    ['Materials','materials',o.materials],
    ...(isFaculty() ? [['Class Members','faculty',o.students]] : []),
    ['My Grades','grades',null],['Attendance','attendance',null]].map(x =>
    '<button class="feature-card" data-action="tab" data-id="' + x[1] + '"><strong>' + e(x[0]) +
    '</strong><span>' + (x[2] == null ? 'Open module' : e(x[2]) + ' total') + ' ›</span></button>').join('');
  const live = o.live_session ? '<div class="notice-strip"><strong>Live Classroom:</strong> ' +
    e(o.live_session.title || 'Session in progress') + ' — open BUKLOD Main for native live audio/video.</div>' : '';
  return live + '<div class="feature-grid">' + cards + '</div>' +
    '<div class="info-panel"><h3>Role-scoped access</h3><p>Class enrollment, materials, marks, and faculty tools are authorized independently by the backend. Grades appear to students only when formally released.</p></div>';
}
function discussions(rows) {
  const form = (isFaculty() || state.context?.allow_student_posts) ?
    '<form data-form="post" class="compose">' + field('Title (optional)', 'title', 'Discussion title') +
    textarea('Say something to your class', 'body', 'Ask a question or share an update') +
    '<button type="submit" class="primary">Publish post</button></form>' : '';
  const posts = rows.map(p =>
    '<article class="post"><div class="post-meta"><strong>' + e(p.title || 'Class discussion') + '</strong>' +
    (p.is_pinned ? pill('Pinned') : '') + (p.is_locked ? pill('Locked') : '') +
    '<span>' + e(fmt(p.created_at)) + '</span></div><p class="prewrap">' + e(p.body || '') + '</p>' +
    (!p.is_locked ? '<form data-form="comment" data-id="' + e(p.id) + '" class="inline-form">' +
    '<input name="body" maxlength="1200" placeholder="Write a comment" required />' +
    '<button type="submit" class="quiet">Comment</button></form>' : '') +
    (state.additional.filter(c=>c.post_id===p.id).map(c=>'<div class="comment">' +
      '<span>' + (c.author_user_id===state.user.id?'You':'Class member') + ' · ' + e(fmt(c.created_at)) + '</span>' +
      '<p>' + e(c.body) + '</p></div>').join('')) + '</article>').join('');
  return '<div class="section-line"><h3>Classroom Discussions</h3>' + pill(rows.length + ' posts') + '</div>' +
    form + (posts || noRows('There are no discussion posts yet.'));
}
function chat(rows) {
  const enabled = isFaculty() || state.context?.allow_student_chat;
  const msgs = rows.map(m=>'<div class="message ' + (m.sender_user_id===state.user.id?'mine':'') + '">' +
    '<small>' + (m.sender_user_id===state.user.id?'You':'Class member') + ' · ' + e(fmt(m.created_at)) +
    '</small><p>' + e(m.body) + '</p></div>').join('');
  return '<div class="section-line"><h3>Class Messages</h3>' + pill('General class channel') + '</div>' +
    '<div class="messages">' + (msgs || noRows('No messages yet.')) + '</div>' +
    (enabled && state.thread?.id ? '<form class="inline-form" data-form="message">' +
    '<input name="body" maxlength="4000" required placeholder="Send a message to your class" />' +
    '<button type="submit" class="primary">Send</button></form>' :
    '<p class="muted">Messages are disabled or the general thread is not initialized for this classroom.</p>');
}
function activities(rows) {
  const canManage = isFaculty();
  const submissionList = state.additional;
  const forms = canManage ?
    '<details class="compose"><summary>+ Create an activity</summary><form data-form="assignment">' +
    field('Activity title', 'title', 'Title', true) +
    textarea('Instructions', 'instructions', 'What should students submit?') +
    '<label class="field"><span>Grade category</span><select name="category" required><option value="">Choose a category</option>' +
    state.gradeCategories.map(c=>'<option value="' + e(c.id) + '">' + e(c.name) + '</option>').join('') +
    '</select></label>' +
    '<label class="field"><span>Points possible</span><input type="number" name="points" required min="1" max="1000" step=".1" value="10" /></label>' +
    '<button type="submit" class="primary">Publish activity</button></form></details>' : '';
  const list = rows.map(a=>{
    const mine = submissionList.filter(s=>s.assignment_id===a.id);
    const latest = mine.length ? mine[mine.length-1] : null;
    return '<article class="post"><div class="post-meta"><strong>' + e(a.title) + '</strong>' +
      pill(a.status) + '<span>' + e(fmt(a.due_at)) + '</span></div><p class="prewrap">' +
      e(a.instructions || a.description || '') + '</p><p class="muted">Maximum score: ' + e(a.points_possible) +
      '</p>' + (!canManage && a.status === 'PUBLISHED' ?
        (latest ? '<div class="notice-strip">Your latest submission: ' + e(latest.status) + ' · ' + e(fmt(latest.submitted_at)) +
        (latest.status==='GRADED' || latest.status==='RELEASED' ? ' · Score: '+e(latest.score ?? 'Pending') : '') + '</div>' : '') +
        '<form data-form="submission" data-id="' + e(a.id) + '" class="compose compact">' +
        textarea('Your answer', 'response', 'Write your answer here') +
        '<label class="field"><span>Supporting link (optional, HTTPS)</span><input name="link" type="url" placeholder="https://…" /></label>' +
        '<button type="submit" class="primary">Submit work</button></form>' :
        canManage ? '<div class="submissions"><h4>Student submissions</h4>' +
        (mine.map(s=>'<div class="submission"><p>' + e(s.text_response || s.link_url || '(file submission)') +
        '</p><small>Status: ' + e(s.status) + ' · ' + e(fmt(s.submitted_at)) + '</small>' +
        '<form data-form="grade-submission" data-id="' + e(s.id) + '" class="inline-form">' +
        '<input type="number" name="score" min="0" max="' + e(a.points_possible) +
        '" step=".1" placeholder="Score" required /><input name="feedback" maxlength="500" placeholder="Feedback" />' +
        '<label class="checkbox"><input name="release" type="checkbox" /> Release</label>' +
        '<button type="submit" class="quiet">Save grade</button></form></div>').join('') || '<p>No submissions yet.</p>') +
        '</div>' : '') + '</article>';
  }).join('');
  return '<div class="section-line"><h3>Activities & Submissions</h3>' + pill(rows.length + ' activities') +
    '</div>' + forms + (list || noRows('No activities have been published yet.'));
}
function materials(rows) {
  return '<div class="section-line"><h3>Learning Materials</h3>' + pill(rows.length + ' items') + '</div>' +
    (rows.map(m=>'<article class="list-card"><div><strong>' + e(m.title) + '</strong><p>' +
      e(m.description || m.original_name || 'Classroom resource') + '</p>' +
      '<small>Shared ' + e(fmt(m.created_at)) + '</small></div>' +
      ((m.storage_path || m.file_path) && (m.allow_download !== false && m.download_allowed !== false)
        ? btn('Open file', 'material', m.id) : '') + '</article>').join('') ||
      noRows('The faculty has not released materials yet.'));
}
function attendance(rows) {
  const logs = state.additional;
  return '<div class="section-line"><h3>Attendance Sessions</h3>' + pill(rows.length + ' sessions') + '</div>' +
    '<div class="info-panel"><p>Attendance recording follows official verification rules. This web viewer does not bypass the QR, faculty approval, or device checks.</p></div>' +
    (rows.map(s=>'<article class="list-card"><div><strong>' +
      e(s.closed_at ? 'Closed session' : 'Open session') + '</strong><p>' +
      e(fmt(s.opened_at)) + '</p><small>' + e(s.term_key || 'Class session') + '</small></div>' +
      pill(s.closed_at ? 'Closed' : 'Open') + '</article>').join('') || noRows('No attendance sessions yet.')) +
    '<h3 class="subheading">Your attendance records</h3>' +
    (isFaculty() ? '<p class="muted">Use the faculty attendance module in BUKLOD Main for official attendance reconciliation.</p>' :
      logs.length ? logs.map(l=>'<div class="list-card"><span>' + e(fmt(l.time_in)) +
      '</span>' + pill(l.status) + '</div>').join('') : noRows('No attendance entries recorded yet.'));
}
function grades(rows) {
  if (isFaculty()) {
    return '<div class="section-line"><h3>Faculty Gradebook</h3>' + pill(rows.length + ' roster records') + '</div>' +
      '<p class="muted">Draft grades remain faculty-only. Released grades are provided to students using a separate secured backend read.</p>' +
      (rows.length ? '<div class="table-scroll"><table><thead><tr><th>Official name</th><th>Roster</th><th>Draft %</th><th>Transmuted</th><th>Status</th></tr></thead><tbody>' +
        rows.map(r=>'<tr><td>' + e(r.official_name || '') + '</td><td>' + e(r.roster_status) +
        '</td><td>' + e(r.draft_final_percentage ?? '—') + '</td><td>' + e(r.transmuted_grade ?? '—') +
        '</td><td>' + e(r.final_status || 'Not released') + '</td></tr>').join('') +
        '</tbody></table></div>' : noRows('No official roster grades recorded yet.'));
  }
  return '<div class="section-line"><h3>My Released Grades</h3>' + pill('Student private') + '</div>' +
    '<div class="info-panel"><strong>Official release policy</strong><p>Only grade items that the faculty has released appear here. Drafts are never displayed as official results.</p></div>' +
    (rows.map(r=>'<div class="list-card"><div><strong>' +
      e(r.title || r.item_title || r.category_name || 'Grade item') + '</strong><p>' +
      e(r.term_key || r.status || 'Released') + '</p></div><strong>' +
      e(r.score ?? r.grade ?? r.percentage ?? 'View breakdown') + '</strong></div>').join('') ||
      noRows('No released grades are available for this classroom.'));
}
function assessments(rows) {
  return '<div class="section-line"><h3>Class Assessments</h3>' + pill(rows.length + ' assessments') + '</div>' +
    '<div class="info-panel"><p>Assessments and exam integrity are protected. Exams can only be started through the authorized BUKLOD exam workflow; this portal will not create insecure attempts or expose answer keys.</p></div>' +
    (rows.map(a=>'<div class="list-card"><div><strong>' + e(a.title) + '</strong><p>' +
      e(a.assessment_type || 'Assessment') + ' · ' + e(a.points_possible || a.total_points || '—') +
      ' points</p><small>Opens: ' + e(fmt(a.opens_at || a.available_from)) + '</small></div>' +
      pill(a.status) + '</div>').join('') || noRows('No assessments are available.'));
}
function notices(rows) {
  return '<div class="section-line"><h3>Official Notices</h3>' + pill(rows.length + ' notices') + '</div>' +
    (rows.map(n=>'<article class="post"><div class="post-meta"><strong>' + e(n.title || 'Notice') +
      '</strong>' + pill(n.notice_level || 'Info') + '<span>' + e(fmt(n.created_at)) +
      '</span></div><p class="prewrap">' + e(n.body) + '</p>' +
      (n.requires_ack ? '<p class="muted">Acknowledgment required in the official BUKLOD Faculty/Student workflow.</p>' : '') +
      '</article>').join('') || noRows('No active notices.'));
}
function monitor(rows) {
  return '<div class="section-line"><h3>Class Participation</h3>' + pill(rows.length + ' recent events') + '</div>' +
    '<p class="muted">This is a factual activity history, not an automatic judgment about academic performance.</p>' +
    (rows.map(x=>'<div class="list-card"><div><strong>' + e(x.event_type || 'Engagement') +
      '</strong><p>' + e(fmt(x.created_at)) + '</p></div></div>').join('') ||
      noRows('No classroom engagement events yet.'));
}
function faculty(rows) {
  if (!isFaculty()) return noRows('Faculty assignment required.');
  return '<div class="section-line"><h3>Faculty Operations</h3>' + pill('Authorized faculty') + '</div>' +
    '<div class="feature-grid">' +
    ['Roster and enrollment','Assessments','Grading','Attendance','Syllabus','Class materials'].map(t=>
      '<div class="feature-card static"><strong>' + e(t) + '</strong><span>Secured BUKLOD data</span></div>').join('') +
    '</div><h3 class="subheading">Official Class Roster</h3>' +
    (rows.length ? '<div class="table-scroll"><table><thead><tr><th>Student name</th><th>Student number</th><th>Linked account</th><th>Status</th></tr></thead><tbody>' +
      rows.map(r=>'<tr><td>' + e(r.official_name) + '</td><td>' + e(r.official_student_no || '—') +
      '</td><td>' + e(r.link_status || 'Unlinked') + '</td><td>' +
      e(r.roster_status) + '</td></tr>').join('') + '</tbody></table></div>' :
      noRows('Official roster not uploaded or not accessible.')) +
    '<div class="info-panel"><p>Faculty mutations are limited to existing secured operations. Bulk roster import, syllabus approval, automatic grade transmutation, and intervention resolution remain in the existing BUKLOD controls until fully integrated and verified here.</p></div>';
}
async function loadClasses() {
  if (!state.user) return;
  state.loading = true; state.classId = ''; state.context = null; render();
  try {
    // Explicit p_view avoids ambiguity with the overloaded zero-argument RPC.
    const results = await Promise.allSettled([
      checked(db.rpc('buklod_classroom_my_classes_v2', { p_view: 'STUDENT' })),
      checked(db.rpc('buklod_classroom_my_classes_v2', { p_view: 'FACULTY' }))
    ]);
    if (results.every(r => r.status === 'rejected')) throw results[0].reason;
    const merged = new Map();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const c of (r.value || [])) {
        const old = merged.get(c.classroom_id) || {};
        merged.set(c.classroom_id, { ...old, ...c,
          can_student_view: !!(old.can_student_view || c.can_student_view || c.role_key === 'STUDENT'),
          can_faculty_view: !!(old.can_faculty_view || c.can_faculty_view || c.role_key === 'FACULTY') });
      }
    }
    state.classes = [...merged.values()].sort((a,b)=>norm(b.updated_at).localeCompare(norm(a.updated_at)));
    const params = new URLSearchParams(location.search);
    const requested = params.get('class');
    const requestedTab = params.get('tab');
    const requestedGroup = params.get('group');
    state.loading = false;
    if (requested && state.classes.some(c=>c.classroom_id===requested)) {
      await openClass(requested, validTab(requestedTab, requestedGroup));
    } else render();
  } catch (err) { state.loading=false; render(); notice(errorMessage(err), true); }
}
async function openClass(id, tab = 'overview') {
  if (!state.classes.some(c => c.classroom_id===id)) { notice('You are not assigned to that classroom.', true); return; }
  const seq = ++state.seq;
  state.classId = id; state.tab = tab; state.group = groupOf(tab); state.context=null; state.overview=null;
  state.data=[]; state.additional=[]; state.error=''; state.busy=true;
  render(); history.replaceState({},'', classLink(id,tab));
  try {
    const [ctx,o] = await Promise.all([
      checked(db.rpc('buklod_classroom_context_v1', { p_classroom_id:id })),
      checked(db.rpc('buklod_classroom_overview_v1', { p_classroom_id:id }))
    ]);
    if (seq!==state.seq) return;
    state.context = Array.isArray(ctx) ? ctx[0] : ctx;
    state.overview = Array.isArray(o) ? o[0] : o;
    if (state.tab==='faculty' && !isFaculty()) {
      state.tab='grades'; state.group='MORE';
      history.replaceState({},'',classLink(id,state.tab));
    }
    state.busy=false; render();
    await loadTab();
  } catch (err) {
    if (seq!==state.seq) return;
    state.busy=false; state.classId=''; state.context=null;
    history.replaceState({},'', location.pathname); render(); notice(errorMessage(err), true);
  }
}
async function loadTab() {
  if (!state.classId) return;
  const id=state.classId, tab=state.tab, seq=++state.seq;
  state.busy=true; state.data=[]; state.additional=[]; state.gradeCategories=[]; state.thread=null; state.error=''; render();
  try {
    let first=[], second=[];
    if (tab==='discussions') {
      [first,second] = await Promise.all([
        checked(db.from('buklod_education_classroom_posts').select('id,title,body,post_type,is_pinned,is_locked,author_user_id,created_at')
          .eq('classroom_id',id).is('deleted_at',null).order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).limit(60)),
        checked(db.from('buklod_education_classroom_comments').select('id,post_id,author_user_id,body,created_at')
          .eq('classroom_id',id).is('deleted_at',null).order('created_at',{ascending:true}).limit(300))
      ]);
    } else if (tab==='chat') {
      const threads = await checked(db.from('buklod_education_classroom_threads').select('id,name')
        .eq('classroom_id',id).eq('thread_type','GENERAL').is('archived_at',null).limit(1));
      const thread=threads?.[0] || null;
      if (seq!==state.seq) return;
      state.thread=thread;
      first = thread ? await checked(db.from('buklod_education_classroom_messages')
        .select('id,sender_user_id,body,created_at').eq('thread_id',thread.id)
        .is('deleted_at',null).order('created_at',{ascending:false}).limit(100)) : [];
      first.reverse();
    } else if (tab==='activities') {
      let categories=[];
      [first,second,categories] = await Promise.all([
        checked(db.from('buklod_education_classroom_assignments')
          .select('id,title,description,instructions,points_possible,due_at,closes_at,status,created_at')
          .eq('classroom_id',id).order('created_at',{ascending:false}).limit(80)),
        checked(db.from('buklod_education_classroom_submissions')
          .select('id,assignment_id,student_user_id,attempt_no,text_response,link_url,status,score,submitted_at')
          .eq('classroom_id',id).order('submitted_at',{ascending:true}).limit(500)),
        isFaculty() ? checked(db.from('buklod_education_grade_categories')
          .select('id,name,weight_percent').eq('classroom_id',id).limit(100)) : Promise.resolve([])
      ]);
      state.gradeCategories=categories||[];
      if (!isFaculty()) {first=first.filter(a=>a.status==='PUBLISHED');second=second.filter(s=>s.student_user_id===state.user.id);}
    } else if (tab==='materials') {
      first=await checked(db.from('buklod_education_materials')
        .select('id,title,description,storage_path,storage_bucket,file_path,created_at,original_name,allow_download,download_allowed,is_released')
        .eq('classroom_id',id).order('created_at',{ascending:false}).limit(100));
      if (!isFaculty()) first=first.filter(x=>x.is_released!==false);
    } else if (tab==='attendance') {
      first=await checked(db.from('buklod_education_attendance_sessions')
        .select('id,opened_at,closed_at,term_key').eq('classroom_id',id).order('opened_at',{ascending:false}).limit(50));
      if (!isFaculty()) second=await checked(db.rpc('buklod_classroom_student_attendance_v1',{p_classroom_id:id}));
    } else if (tab==='grades') {
      first=await checked(db.rpc(isFaculty()?'buklod_classroom_gradebook_roster_v1':
        'buklod_classroom_student_released_grade_items_v2',{p_classroom_id:id}));
    } else if (tab==='assessments') {
      first=await checked(db.from('buklod_education_assessments')
        .select('id,title,assessment_type,points_possible,total_points,opens_at,available_from,status')
        .eq('classroom_id',id).order('created_at',{ascending:false}).limit(100));
      if (!isFaculty()) first=first.filter(a=>a.status==='PUBLISHED');
    } else if (tab==='notices') {
      first=await checked(db.from('buklod_education_notices')
        .select('id,title,body,notice_level,requires_ack,created_at,student_user_id,visible_from,expires_at')
        .eq('classroom_id',id).order('created_at',{ascending:false}).limit(80));
      const now=Date.now();
      first=first.filter(n => isFaculty() ||
        ((!n.student_user_id || n.student_user_id===state.user.id) &&
          (!n.visible_from || new Date(n.visible_from).getTime()<=now) &&
          (!n.expires_at || new Date(n.expires_at).getTime()>now)));
    } else if (tab==='monitor') {
      first=await checked(db.from('buklod_education_classroom_engagement_events')
        .select('id,user_id,event_type,created_at').eq('classroom_id',id)
        .order('created_at',{ascending:false}).limit(100));
      if (!isFaculty()) first=first.filter(x=>x.user_id===state.user.id);
    } else if (tab==='faculty' && isFaculty()) {
      // The roster table is service-role only. Use its faculty-scoped RPC, never a direct SELECT or a broad GRANT.
      first=await checked(db.rpc('buklod_classroom_roster_members_v2',{p_classroom_id:id}));
    }
    if (seq!==state.seq) return;
    state.data=Array.isArray(first)?first:[]; state.additional=Array.isArray(second)?second:[];
  } catch(err) { if(seq===state.seq) {state.data=[];state.additional=[];state.error=errorMessage(err);} }
  finally {if(seq===state.seq) {state.busy=false;render();}}
}

async function deleteCurrentClass() {
  if (!canDeleteClass() || !state.classId || state.busy) {
    notice('Only the assigned primary faculty may request permanent class deletion.', true);
    return;
  }
  const classroomId = state.classId;
  const classroomName = String(state.context?.name || '').trim();
  if (!classroomName) { notice('Class name is missing; deletion canceled.', true); return; }
  const entered = window.prompt(
    'Permanently delete "' + classroomName + '"?\n\n' +
    'This removes the empty class, its default setup and any class-only content. ' +
    'Classes with academic records cannot be deleted: export and archive them instead.\n\n' +
    'Type the EXACT class name to confirm:',
    ''
  );
  if (entered === null) return;
  if (!deletionNameMatches(entered, classroomName)) {
    notice('Deletion canceled: class name did not match exactly.', true);
    return;
  }
  state.busy = true;
  notice('Checking class records before deletion…');
  try {
    // Enforce authorization and academic-history checks on the backend, not in browser state.
    const result = await checked(db.rpc('buklod_classroom_delete_empty_guarded_v1', {p_classroom_id: classroomId}));
    if (!result || result.deleted !== true || result.classroom_id !== classroomId) {
      throw new Error('The server did not confirm deletion. Please refresh and check this class.');
    }
    ++state.seq;
    state.classes = state.classes.filter(c => c.classroom_id !== classroomId);
    state.classId = ''; state.context = null; state.overview = null;
    state.data = []; state.additional = []; state.error = '';
    history.replaceState({}, '', location.pathname);
    render();
    notice('Class "' + classroomName + '" was permanently deleted.');
  } catch (err) {
    notice('Class not deleted. ' + errorMessage(err) +
      ' If this class has academic history, export its records and archive it in BUKLOD Faculty.', true);
  } finally { state.busy = false; }
}

async function doAction(action,id) {
  if (state.busy) return;
  if (action==='classes') {
    ++state.seq; state.classId=''; state.context=null; state.overview=null; state.data=[];
    state.additional=[]; state.error=''; history.replaceState({},'',location.pathname); render(); return;
  }
  if (action==='signout') {
    const {error}=await db.auth.signOut(); if(error){notice(error.message,true);return;}
    ++state.seq; state.user=null; state.classes=[];state.context=null;state.classId='';
    history.replaceState({},'',location.pathname); render(); return;
  }
  if (action==='refresh-classes'){await loadClasses();return;}
  if (action==='delete-class'){await deleteCurrentClass();return;}
  if (action==='open-class'){await openClass(id);return;}
  if (action==='group') {
    if (!GROUP_TABS[id]) return;
    const tab = validTab(DEFAULT_TAB[id],id);
    state.group=id; state.tab=tab;
    history.replaceState({},'',classLink(state.classId,tab));
    if(tab==='overview'){++state.seq;state.busy=false;state.error='';state.data=[];state.additional=[];render();}
    else await loadTab();
    return;
  }
  if (action==='tab') {
    if (!tabs.some(t=>t[0]===id) || (id==='faculty' && !isFaculty())) return;
    state.group=groupOf(id);
    state.tab=id;history.replaceState({},'',classLink(state.classId,id));
    if (id==='overview'){++state.seq;state.busy=false;state.error='';state.data=[];state.additional=[];render();}else await loadTab();return;
  }
  if (action==='refresh-tab') {if(state.tab==='overview') await openClass(state.classId);else await loadTab();return;}
  if (action==='material') {
    const m=state.data.find(x=>x.id===id);if(!m) return;
    const path=m.storage_path||m.file_path;const bucket=m.storage_bucket||'buklod-classroom';
    if (!path){notice('File is not attached to this material.',true);return;}
    try {
      const data=await checked(db.storage.from(bucket).createSignedUrl(path,90));
      const href=safeLink(data.signedUrl);if(!href) throw new Error('Invalid file URL.');
      window.open(href,'_blank','noopener,noreferrer');
    } catch(err){notice(errorMessage(err),true);}
  }
}
async function handleForm(form) {
  const kind=form.dataset.form;
  const fd=new FormData(form), val=(k)=>norm(fd.get(k)).trim();
  if(state.busy) return;
  state.busy=true;
  const oldLabel=form.querySelector('button[type="submit"]');
  if(oldLabel) oldLabel.disabled=true;
  try {
    if(kind==='login'){
      const data=await checked(db.auth.signInWithPassword({email:val('email'),password:val('password')}));
      state.user=data.user;state.error=''; await loadClasses();return;
    }
    if(kind==='reset') {
      if(!val('email'))throw new Error('Enter your BUKLOD email.');
      await checked(db.auth.resetPasswordForEmail(val('email'),{redirectTo:location.origin}));
      notice('Password reset instructions sent if that account exists.');return;
    }
    if(kind==='password') {
      if(val('password').length<8) throw new Error('Use at least 8 characters.');
      await checked(db.auth.updateUser({password:val('password')}));
      state.recover=false;const s=await checked(db.auth.getUser());state.user=s.user;
      await loadClasses();return;
    }
    if(!state.user || !state.classId)throw new Error('Sign in and open a classroom first.');
    const id=state.classId,uid=state.user.id;
    if(kind==='post'){
      if(!(isFaculty()||state.context?.allow_student_posts))throw new Error('Posting is disabled.');
      if(!val('body'))throw new Error('Write your post first.');
      await checked(db.from('buklod_education_classroom_posts').insert({
        classroom_id:id,author_user_id:uid,post_type:'DISCUSSION',title:val('title')||null,body:clampText(val('body'),10000)
      }));
    } else if(kind==='comment'){
      const post=state.data.find(x=>x.id===form.dataset.id);
      if(!post||post.is_locked)throw new Error('This post is locked.');
      await checked(db.from('buklod_education_classroom_comments').insert({
        classroom_id:id,post_id:post.id,author_user_id:uid,body:clampText(val('body'),1200)
      }));
    } else if(kind==='message') {
      if(!(isFaculty()||state.context?.allow_student_chat) || !state.thread?.id)throw new Error('Chat unavailable.');
      await checked(db.from('buklod_education_classroom_messages').insert({
        classroom_id:id,thread_id:state.thread.id,sender_user_id:uid,body:clampText(val('body'),4000)
      }));
    } else if(kind==='assignment') {
      if(!isFaculty())throw new Error('Faculty access required.');
      const points=Number(val('points'));
      if(!val('title')||!Number.isFinite(points)||points<=0||points>1000)throw new Error('Invalid assignment.');
      if(!state.gradeCategories.some(c=>c.id===val('category'))) throw new Error('Select an official grade category.');
      await checked(db.from('buklod_education_classroom_assignments').insert({
        classroom_id:id,title:clampText(val('title'),200),instructions:val('instructions')||null,
        points_possible:points,submission_types:['TEXT','LINK'],grade_category_id:val('category'),
        auto_grading_mode:'NONE',auto_grade_requires_review:true,status:'PUBLISHED',
        created_by:uid
      }));
    } else if(kind==='submission') {
      if(!isStudent())throw new Error('Student enrollment required.');
      const assignment=state.data.find(x=>x.id===form.dataset.id && x.status==='PUBLISHED');
      if(!assignment)throw new Error('Assignment unavailable.');
      const link=val('link');if(link&&!safeLink(link))throw new Error('Only secure HTTPS links are accepted.');
      const text=val('response');if(!text&&!link)throw new Error('Enter an answer or secure URL.');
      const own=state.additional.filter(s=>s.assignment_id===assignment.id && s.student_user_id===uid);
      const no=Math.max(0,...own.map(s=>Number(s.attempt_no)||0))+1;
      await checked(db.from('buklod_education_classroom_submissions').insert({
        classroom_id:id,assignment_id:assignment.id,student_user_id:uid,attempt_no:no,
        text_response:text||null,link_url:link||null,status:'SUBMITTED',submitted_at:new Date().toISOString()
      }));
    } else if(kind==='grade-submission') {
      if(!isFaculty())throw new Error('Faculty access required.');
      const submission=state.additional.find(s=>s.id===form.dataset.id);
      const assignment=state.data.find(a=>a.id===submission?.assignment_id);
      const score=Number(val('score'));
      if(!submission||!assignment||!Number.isFinite(score)||score<0||score>Number(assignment.points_possible))
        throw new Error('Enter a score within the assignment maximum.');
      await checked(db.rpc('buklod_classroom_grade_submission_v2',{
        p_submission_id:submission.id,p_score:score,p_feedback:val('feedback')||null,p_release:fd.get('release')==='on'
      }));
    } else throw new Error('Unknown action.');
    form.reset();
    await loadTab();notice('Saved in the BUKLOD classroom.');
  } catch(err){notice(errorMessage(err),true);}
  finally {state.busy=false;if(oldLabel?.isConnected) oldLabel.disabled=false;}
}
root.addEventListener('click',event=>{
  const target=event.target.closest('button[data-action]');
  if(!target) return;
  void doAction(target.dataset.action,target.dataset.id);
});
root.addEventListener('submit',event=>{
  const form=event.target.closest('form[data-form]');
  if(!form) return;event.preventDefault();void handleForm(form);
});
async function boot() {
  if(!db) {state.loading=false;render();return;}
  db.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY') {state.recover=true;state.loading=false;render();}
    if(event==='SIGNED_OUT' && state.user) {++state.seq;state.user=null;state.classes=[];state.classId='';state.loading=false;render();}
  });
  try{
    const data=await checked(db.auth.getUser());
    state.user=data.user||null;state.loading=false;
    if(state.user)await loadClasses();else render();
  }catch(err){state.user=null;state.loading=false;render();notice(errorMessage(err),true);}
}
void boot();
