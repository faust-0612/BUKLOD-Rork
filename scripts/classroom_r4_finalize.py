from pathlib import Path

# Faculty Academic Control links
p = Path('src/app/profile/buklod-faculty-academic-control.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace("fontWeight:'850'", "fontWeight:'800'")
old = "      ['book-open-page-variant','Syllabus, Modules & Materials','/profile/buklod-faculty-materials'],"
new = "      ['book-open-page-variant','Syllabus & Course Automation','/profile/buklod-faculty-syllabus'],\n      ['folder-multiple-outline','Materials Library','/profile/buklod-faculty-materials'],"
if old in s:
    s = s.replace(old, new, 1)
elif "'/profile/buklod-faculty-syllabus'" not in s:
    raise SystemExit('Faculty syllabus tool anchor mismatch')

rle_anchor = "      ['account-star','Participation / Conduct / Extra Credit','/profile/buklod-faculty-participation'],"
rle_row = "      ['stethoscope','RLE / OJT / Practicum Management','/profile/buklod-faculty-rle'],\n"
if "'/profile/buklod-faculty-rle'" not in s:
    if rle_anchor not in s:
        raise SystemExit('Faculty RLE tool anchor mismatch')
    s = s.replace(rle_anchor, rle_row + rle_anchor, 1)
p.write_text(s, encoding='utf-8')

# Student Journal: after successful SUBMITTED insert, request an AI suggestion without
# making AI availability a prerequisite for submission.
p = Path('apps/buklod-classroom/app/class/[id]/journal.tsx')
s = p.read_text(encoding='utf-8')
old = "const {error}=await supabase.from('buklod_education_journals').insert({classroom_id:id,rotation_id:rotationId||null,student_user_id:u.user.id,title:title.trim()||null,body:body.trim(),status:submit?'SUBMITTED':'DRAFT',submitted_at:submit?new Date().toISOString():null});if(error)throw error;"
new = "const {data:created,error}=await supabase.from('buklod_education_journals').insert({classroom_id:id,rotation_id:rotationId||null,student_user_id:u.user.id,title:title.trim()||null,body:body.trim(),status:submit?'SUBMITTED':'DRAFT',submitted_at:submit?new Date().toISOString():null}).select('id').single();if(error)throw error;if(submit&&created?.id){const {error:autoError}=await supabase.functions.invoke('buklod-classroom-journal-auto-grade',{body:{journal_id:String(created.id)}});if(autoError)console.warn('Journal AI suggestion:',autoError.message)}"
if old in s:
    s = s.replace(old, new, 1)
elif "buklod-classroom-journal-auto-grade" not in s:
    raise SystemExit('Student journal submit anchor mismatch')
p.write_text(s, encoding='utf-8')

print('Faculty syllabus/RLE and student journal automation wired.')
