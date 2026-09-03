from pathlib import Path
import re


def patch_profile():
    path = Path("src/app/(tabs)/me.tsx")
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"\n\s*\{\s*\n\s*key:\s*'classrooms',\s*\n\s*icon:\s*'google-classroom',\s*\n\s*label:\s*'My Classrooms',\s*\n\s*onPress:\s*\(\)\s*=>\s*router\.push\('/profile/buklod-classrooms'\s+as\s+any\),\s*\n\s*\},",
        re.M,
    )
    updated, count = pattern.subn("", text, count=1)
    if count == 0 and "key: 'classrooms'" in text:
        raise SystemExit("Profile Classroom card anchor mismatch")
    path.write_text(updated, encoding="utf-8")


def patch_faculty_control_typecheck():
    path = Path("src/app/profile/buklod-faculty-academic-control.tsx")
    text = path.read_text(encoding="utf-8")
    text = text.replace("fontWeight:'850'", "fontWeight:'800'")
    path.write_text(text, encoding="utf-8")


def patch_faculty_class():
    path = Path("src/app/profile/buklod-faculty-class.tsx")
    text = path.read_text(encoding="utf-8")
    if "BUKLOD_CLASSROOM_R4_ACADEMIC_CONTROL" in text:
        return
    anchor = "        {/* BUKLOD_CLASSROOM_R1_FACULTY_ENTRY */}"
    if anchor not in text:
        raise SystemExit("Faculty Classroom anchor mismatch")
    block = '''        {/* BUKLOD_CLASSROOM_R4_ACADEMIC_CONTROL */}
        <Pressable
          onPress={() => router.push({ pathname: '/profile/buklod-faculty-academic-control' as any, params: { id: classroomId, classroomId, name: classroomName } })}
          style={({ pressed }) => [styles.academicControl, pressed && { opacity: 0.84 }]}
        >
          <View style={styles.academicControlIcon}><MaterialCommunityIcons name="school-outline" size={27} color="#1f7a3f" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.academicControlTitle}>Academic Control Center</Text>
            <Text style={styles.academicControlText}>Adaptive terms, grading, syllabus flow, RLE/OJT, monitoring, interventions and grade governance.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={23} color="#fff" />
        </Pressable>

'''
    text = text.replace(anchor, block + anchor, 1)
    style_anchor = "  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },"
    if style_anchor not in text:
        raise SystemExit("Faculty style anchor mismatch")
    styles = (
        "  academicControl: { backgroundColor: '#17311f', borderRadius: 18, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },\n"
        "  academicControlIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#e7f4e9', alignItems: 'center', justifyContent: 'center' },\n"
        "  academicControlTitle: { color: '#fff', fontWeight: '900', fontSize: 17 },\n"
        "  academicControlText: { color: '#d4e5d8', lineHeight: 17, fontSize: 11, marginTop: 3 },\n"
    )
    text = text.replace(style_anchor, styles + style_anchor, 1)
    path.write_text(text, encoding="utf-8")


def patch_student_core():
    path = Path("apps/buklod-classroom/src/core.ts")
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "supabase.rpc('buklod_classroom_student_released_grade_items_v1', { p_classroom_id: classroomId })",
        "supabase.rpc('buklod_classroom_student_released_grade_items_v2', { p_classroom_id: classroomId })",
    )
    text = text.replace(
        "export async function loadReleasedQuizResults() {",
        "export async function loadReleasedQuizResults(examIds: string[] = []) {",
    )
    text = text.replace(
        "body: JSON.stringify({ action: 'released_results', limit: 500 }),",
        "body: JSON.stringify({ action: 'released_results', limit: 500, exam_ids: examIds }),",
    )
    path.write_text(text, encoding="utf-8")


def patch_student_grades_and_quiz():
    path = Path("apps/buklod-classroom/app/class/[id]/[section].tsx")
    text = path.read_text(encoding="utf-8")

    old_quiz = "else if(section==='quiz'){const [q,g]=await Promise.all([loadReleasedQuizResults(),loadReleasedGradeItems(id)]);setData({quiz:q,gradeItems:g.filter((x:any)=>String(x.source_system||'').toUpperCase()==='BUKLOD_QUIZ')});}"
    new_quiz = "else if(section==='quiz'){const g=await loadReleasedGradeItems(id);const gradeItems=g.filter((x:any)=>['BUKLOD_QUIZ','BUKLOD_QUIZ_DEDICATED'].includes(String(x.source_system||'').toUpperCase()));const examIds=Array.from(new Set(gradeItems.map((x:any)=>String(x.source_ref||'').match(/^exam:([0-9a-f-]{36}):/i)?.[1]).filter((x:any):x is string=>!!x)));const q=examIds.length?await loadReleasedQuizResults(examIds):[];setData({quiz:q,gradeItems});}"
    if old_quiz in text:
        text = text.replace(old_quiz, new_quiz, 1)
    elif "loadReleasedQuizResults(),loadReleasedGradeItems(id)" in text:
        raise SystemExit("Student Quiz linkage anchor changed unexpectedly")

    if "TERM BREAKDOWN R4" not in text:
        start_anchor = "  if(section==='grades'){const h=data?.health||{};return <><View style={s.hero}>"
        next_anchor = "  if(section==='attendance')return"
        start = text.find(start_anchor)
        end = text.find(next_anchor)
        if start < 0 or end <= start:
            raise SystemExit("Student grade block anchor mismatch")
        block = '''  if(section==='grades'){const h=data?.health||{};const termMode=h.mode==='TERM_WEIGHTED';return <><View style={s.hero}><Text style={s.heroBig}>{h.current_percent==null?'—':`${Number(h.current_percent).toFixed(2)}%`}</Text><Text style={s.heroTitle}>{String(h.standing||'NOT YET COMPUTABLE').replaceAll('_',' ')}</Text><Text style={s.heroSub}>Passing: {h.passing_percent??75}% • {h.pending_requirements??0} pending • {h.overdue_requirements??0} overdue</Text><Text style={s.projection}>Released records only • projection is not a guaranteed final grade</Text></View>{/* TERM BREAKDOWN R4 */}{termMode?(h.breakdown??[]).map((term:any,i:number)=><View key={String(term.term_key??i)} style={s.termCard}><View style={s.termHead}><View><Text style={s.termTitle}>{term.term_label||term.term_key}</Text><Text style={s.meta}>{Number(term.term_weight||0).toFixed(1)}% of course • {term.complete?'complete components':'in progress'}</Text></View><Text style={s.termPercent}>{term.term_percent==null?'—':`${Number(term.term_percent).toFixed(2)}%`}</Text></View>{(term.categories??[]).map((b:any,j:number)=><View key={String(b.category_id??j)} style={s.categoryLine}><View style={{flex:1}}><Text style={s.cardTitle}>{b.category_name||'Component'}</Text><Text style={s.meta}>{Number(b.weight_percent||0).toFixed(1)}% within term • {b.possible>0?`${b.earned}/${b.possible}`:'no released score yet'}</Text></View><Text style={s.value}>{b.category_percent==null?'—':`${Number(b.category_percent).toFixed(1)}%`}</Text></View>)}</View>):(h.breakdown??[]).map((b:any,i:number)=><View key={String(b.category_id??i)} style={s.line}><View><Text style={s.cardTitle}>{b.category_name||b.name||'Component'}</Text><Text style={s.meta}>{b.weight_percent}% weight</Text></View><Text style={s.value}>{b.category_percent==null?'—':`${Number(b.category_percent).toFixed(1)}%`}</Text></View>)}<Text style={s.section}>Released grade items</Text>{(data?.items??[]).map((g:any)=><View key={g.grade_item_id} style={s.line}><View style={{flex:1}}><Text style={s.cardTitle}>{g.title}</Text><Text style={s.meta}>{[g.term_key,g.category_name,g.source_system].filter(Boolean).join(' • ')}</Text></View><Text style={s.value}>{g.score}/{g.points_possible}</Text></View>)}</>}
'''
        text = text[:start] + block + text[end:]
        style_anchor = "const s=StyleSheet.create({"
        if style_anchor not in text:
            raise SystemExit("Student style anchor mismatch")
        extra = (
            "const s=StyleSheet.create({projection:{fontSize:10,color:'#5f7465',marginTop:8},"
            "termCard:{backgroundColor:'#fff',borderRadius:18,padding:14,marginBottom:12,borderWidth:1,borderColor:'#dfe8e1'},"
            "termHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:8},"
            "termTitle:{fontSize:16,fontWeight:'900',color:'#203828'},termPercent:{fontSize:20,fontWeight:'900',color:'#1f7a3f'},"
            "categoryLine:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,borderTopWidth:1,borderTopColor:'#edf1ed'},"
        )
        text = text.replace(style_anchor, extra, 1)
    path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    patch_profile()
    patch_faculty_control_typecheck()
    patch_faculty_class()
    patch_student_core()
    patch_student_grades_and_quiz()
    print("Classroom R4 surgical integration applied.")
