import {
  buildManagementAnalytics,
  type ScopeManagementData,
} from '@/lib/buklodReportConsolidation';
import { outputReportDocument } from '@/lib/buklodReportDocumentOutput';

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fileSafe(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100) || 'BUKLOD_Report';
}

function overallStatus(data: ScopeManagementData) {
  const analytics = buildManagementAnalytics(data);
  if (analytics.overdue > 0 || analytics.reviewAttention > 0) return 'NEEDS ATTENTION';
  if (analytics.activeActions > 0) return 'ACTION IN PROGRESS';
  if (analytics.assigned > 0 && analytics.coverageRate >= 90) return 'STABLE / MONITOR';
  if (analytics.pending > 0) return 'FOLLOW-UP NEEDED';
  return 'NO ACTIVE ISSUE';
}

export async function exportScopeManagementWord(data: ScopeManagementData, rangeLabel: string) {
  const analytics = buildManagementAnalytics(data);
  const status = overallStatus(data);
  const generatedAt = new Date().toLocaleString();
  const reportRows = analytics.byDefinition.map((row) => `
    <tr>
      <td>${esc(row.title)}</td><td>${row.assigned}</td><td>${row.submitted}</td><td>${row.coverageRate}%</td><td>${row.overdue}</td>
    </tr>`).join('');
  const actionRows = data.actions.map((action) => `
    <tr>
      <td>${esc(action.assignee_name ?? '')}</td><td>${esc(action.action_type)}</td><td>${esc(action.title)}</td><td>${esc(action.status)}</td>
      <td>${esc(action.outcome ?? '')}</td><td>${esc(action.next_action ?? '')}</td>
    </tr>`).join('');
  const suggestions = analytics.suggestions.map((item) => `
    <li><strong>${esc(item.title)}</strong>${item.assigneeName ? ` — ${esc(item.assigneeName)}` : ''}<br/>${esc(item.rationale)}</li>`).join('');
  const concerns = analytics.concernHighlights.map((item) => `
    <li><strong>${esc(item.reporter)} · ${esc(item.report)}</strong><br/>${esc(item.text)}</li>`).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>BUKLOD Report Management</title>
<style>
body{font-family:Arial,sans-serif;color:#18372d;font-size:11pt;line-height:1.45;margin:36px}
h1{font-size:22pt;color:#0e4f20;margin-bottom:4px} h2{font-size:14pt;color:#0e4f20;margin-top:24px;border-bottom:1px solid #d8e3dc;padding-bottom:5px}
.meta{color:#60736a;font-size:9pt}.status{display:inline-block;padding:5px 9px;border:1px solid #0e4f20;font-weight:bold}.summary{background:#f3f7f4;padding:12px;border-left:4px solid #0e4f20}
table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #d8e3dc;padding:6px;text-align:left;vertical-align:top}th{background:#edf5ef}li{margin-bottom:8px}.notice{font-size:9pt;color:#6a5b33}
</style></head><body>
<h1>BUKLOD Report Management Summary</h1>
<div class="meta">Scope: ${esc(data.scope.name)} · Range: ${esc(rangeLabel)} · Generated: ${esc(generatedAt)}</div>
<p><span class="status">OVERALL STATUS: ${esc(status)}</span></p>
<h2>Executive Summary</h2><div class="summary">${esc(analytics.summary)}</div>
<table><tr><th>Assigned</th><th>Submitted</th><th>Coverage</th><th>Pending</th><th>Overdue</th><th>Needs Review</th><th>Open Actions</th><th>Done Actions</th></tr>
<tr><td>${analytics.assigned}</td><td>${analytics.submitted}</td><td>${analytics.coverageRate}%</td><td>${analytics.pending}</td><td>${analytics.overdue}</td><td>${analytics.reviewAttention}</td><td>${analytics.activeActions}</td><td>${analytics.completedActions}</td></tr></table>
<h2>Report Analytics</h2>
<table><tr><th>Report</th><th>Assigned</th><th>Submitted</th><th>Coverage</th><th>Overdue</th></tr>${reportRows || '<tr><td colspan="5">No published report period in this range.</td></tr>'}</table>
<h2>Suggested Actions</h2><p class="notice">Suggestions are decision support only. Counselling, reassignment, suspension, dismissal or separation require authorized human review and are never automatic.</p>
<ul>${suggestions || '<li>No new management action suggested from the selected data.</li>'}</ul>
<h2>Action Taken / Endpoint</h2>
<table><tr><th>Person</th><th>Type</th><th>Action</th><th>Status</th><th>Outcome</th><th>Next Action</th></tr>${actionRows || '<tr><td colspan="6">No management action recorded in this range.</td></tr>'}</table>
<h2>Reported Concerns / Support Signals</h2>
<ul>${concerns || '<li>No non-empty concern/support response detected from explicitly labelled concern or support fields.</li>'}</ul>
</body></html>`;

  const fileName = `${fileSafe(data.scope.name)}_Report_Management_${new Date().toISOString().slice(0, 10)}.doc`;
  return outputReportDocument(html, fileName);
}
