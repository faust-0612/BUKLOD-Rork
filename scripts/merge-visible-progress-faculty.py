import sys
from pathlib import Path

current_path = Path(sys.argv[1])
theirs_path = Path(sys.argv[2])

current = current_path.read_text(encoding='utf-8')
theirs = theirs_path.read_text(encoding='utf-8')

marker = '        {/* BUKLOD_FACULTY_QUIZ_INTEGRATION_R1 */}'
anchor = '<Text style={styles.sectionTitle}>Faculty Autopilot</Text>'

if marker in current:
    raise SystemExit(0)
if marker not in theirs:
    raise SystemExit('REFUSED: Faculty Quiz integration marker missing from local overlay.')
if anchor not in current:
    raise SystemExit('REFUSED: Faculty Autopilot anchor missing from current production source.')

start = theirs.index(marker)
end = theirs.index(anchor, start)
block = theirs[start:end]
current_path.write_text(current.replace(anchor, block + anchor, 1), encoding='utf-8')
