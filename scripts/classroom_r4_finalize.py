from pathlib import Path

p = Path('src/app/profile/buklod-faculty-academic-control.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace("fontWeight:'850'", "fontWeight:'800'")
old = "      ['book-open-page-variant','Syllabus, Modules & Materials','/profile/buklod-faculty-materials'],"
new = "      ['book-open-page-variant','Syllabus & Course Automation','/profile/buklod-faculty-syllabus'],\n      ['folder-multiple-outline','Materials Library','/profile/buklod-faculty-materials'],"
if old in s:
    s = s.replace(old, new, 1)
elif "'/profile/buklod-faculty-syllabus'" not in s:
    raise SystemExit('Faculty syllabus tool anchor mismatch')
p.write_text(s, encoding='utf-8')
print('Faculty syllabus automation wired.')
