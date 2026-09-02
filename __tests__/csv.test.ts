import { rowsToCsv } from '@/lib/reports/csv';

describe('rowsToCsv', () => {
  it('creates a header and ordinary rows', () => {
    expect(rowsToCsv([
      { name: 'Ana', status: 'active' },
      { name: 'Ben', status: 'follow_up' },
    ])).toBe('name,status\r\nAna,active\r\nBen,follow_up');
  });

  it('escapes commas, quotes, and line breaks', () => {
    const csv = rowsToCsv([
      { name: 'Doe, John', note: 'He said "Amen"\nToday' },
    ]);

    expect(csv).toContain('"Doe, John"');
    expect(csv).toContain('"He said ""Amen""\nToday"');
  });

  it('returns an empty string for no rows', () => {
    expect(rowsToCsv([])).toBe('');
  });
});
