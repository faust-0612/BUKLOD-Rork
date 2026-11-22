import { evaluateReportFeedback } from '../buklodReportAutoFeedback';

describe('BUKLOD report auto feedback', () => {
  it('treats empty optional fields as blank, not as failure', () => {
    const feedback = evaluateReportFeedback({
      content: { schema: 'BUKLOD_QUICK_WEEKLY_V1', activities: {}, people: {}, next_period: {} },
    });
    expect(feedback.level).toBe('suggestions');
    expect(feedback.notes.some((line) => line.includes('required'))).toBe(false);
  });

  it('accepts zero as a valid numeric response', () => {
    const feedback = evaluateReportFeedback({
      content: { answers: { present: '0' } },
      fields: [{ id: 'present', label: 'Present', type: 'number', required: true }],
    });
    expect(feedback.level).toBe('ready');
  });

  it('flags missing required field but not an optional one', () => {
    const feedback = evaluateReportFeedback({
      content: { answers: { optional: '' } },
      fields: [
        { id: 'required', label: 'Weekly outcome', required: true },
        { id: 'optional', label: 'Extra notes', required: false },
      ],
    });
    expect(feedback.level).toBe('needs_attention');
    expect(feedback.notes.join(' ')).toContain('Weekly outcome');
    expect(feedback.notes.join(' ')).not.toContain('Extra notes');
  });

  it('suggests contextual support for a reported concern', () => {
    const feedback = evaluateReportFeedback({
      content: {
        activities: { worship: { selected: true, note: 'Community worship' } },
        people: { worship_total: '7' },
        concern: { type: 'Need Mentoring', note: null },
        next_period: { main_goal: 'Follow up disciples' },
      },
    });
    expect(feedback.notes.join(' ')).toContain('concern');
  });

  it('detects inconsistent attendance while preserving submission freedom', () => {
    const feedback = evaluateReportFeedback({
      content: {
        activities: {},
        people: { worship_total: '3', adults: '3', youth: '1', children: '0' },
        next_period: { main_goal: 'Continue' },
      },
    });
    expect(feedback.notes.join(' ')).toContain('worship total');
    expect(feedback.level).not.toBe('needs_attention');
  });

  it('marks an overdue draft but not a submitted report as overdue', () => {
    const args = { content: { answers: { report: 'Completed' } }, deadlineAt: '2026-11-01T13:00:00Z', now: Date.parse('2026-11-22T13:00:00Z') };
    expect(evaluateReportFeedback({ ...args, submitted: false }).deadlineNote).toContain('Lampas');
    expect(evaluateReportFeedback({ ...args, submitted: true }).deadlineNote).toBeNull();
  });
});
