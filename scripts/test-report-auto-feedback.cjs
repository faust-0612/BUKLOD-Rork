'use strict';
// Execute the exact TypeScript source in isolation; no Jest dependency or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/buklodReportAutoFeedback.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
const diagnostics = compiled.diagnostics || [];
if (diagnostics.some((d) => d.category === ts.DiagnosticCategory.Error)) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (n) => n, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
  }));
}
const sandbox = { exports: {} };
vm.runInNewContext(compiled.outputText, sandbox, { timeout: 1000 });
const evaluateReportFeedback = sandbox.exports.evaluateReportFeedback;
assert.equal(typeof evaluateReportFeedback, 'function');

const cases = [
  ['blank optional fields do not fail', () => {
    const result = evaluateReportFeedback({ content: { activities: {}, people: {}, next_period: {} } });
    assert.equal(result.level, 'suggestions');
    assert.equal(result.notes.some((line) => line.includes('required')), false);
  }],
  ['zero is valid', () => {
    const result = evaluateReportFeedback({ content: { answers: { present: '0' } }, fields: [{ id: 'present', label: 'Present', type: 'number', required: true }] });
    assert.equal(result.level, 'ready');
  }],
  ['custom numeric fields accept decimals', () => {
    const result = evaluateReportFeedback({ content: { answers: { fund: '12.50' } }, fields: [{ id: 'fund', label: 'Fund', type: 'number', required: true }] });
    assert.equal(result.level, 'ready');
  }],
  ['invalid attendance count is flagged', () => {
    const result = evaluateReportFeedback({ content: { activities: {}, people: { worship_total: '-1' }, next_period: {} } });
    assert.equal(result.level, 'needs_attention');
  }],
  ['required answers flagged, optional fields preserved', () => {
    const result = evaluateReportFeedback({ content: { answers: { optional: '' } }, fields: [{ id: 'required', label: 'Weekly outcome', required: true }, { id: 'optional', label: 'Extra notes' }] });
    assert.equal(result.level, 'needs_attention');
    assert.match(result.notes.join(' '), /Weekly outcome/);
    assert.doesNotMatch(result.notes.join(' '), /Extra notes/);
  }],
  ['reported concerns receive contextual guidance', () => {
    const result = evaluateReportFeedback({ content: {
      activities: { worship: { selected: true, note: 'Worship' } },
      people: { worship_total: '7' }, concern: { type: 'Need Mentoring', note: null }, next_period: { main_goal: 'Visit members' },
    } });
    assert.match(result.notes.join(' '), /concern/);
  }],
  ['attendance mismatch gives suggestion, not a failure', () => {
    const result = evaluateReportFeedback({ content: { activities: {}, people: { worship_total: '3', adults: '3', youth: '1', children: '0' }, next_period: { main_goal: 'Continue' } } });
    assert.match(result.notes.join(' '), /worship total/);
    assert.notEqual(result.level, 'needs_attention');
  }],
  ['only draft receives overdue note', () => {
    const opts = { content: { answers: { report: 'Completed' } }, deadlineAt: '2026-11-01T13:00:00Z', now: Date.parse('2026-11-22T13:00:00Z') };
    assert.match(evaluateReportFeedback({ ...opts, submitted: false }).deadlineNote, /Lampas/);
    assert.equal(evaluateReportFeedback({ ...opts, submitted: true }).deadlineNote, null);
  }],
];
for (const [label, fn] of cases) {
  fn();
  console.log('PASS', label);
}
console.log('PASS ' + cases.length + ' auto-feedback assertions');
