import { classifySmartDrawerText } from '../classify';

describe('Smart Drawer classification', () => {
  const now = new Date(2026, 10, 10, 12, 0, 0);
  test.each([
    ['Receipt for groceries dated Nov 9', 'RECEIPT'],
    ['Doctor appointment tomorrow at 9am', 'APPOINTMENT'],
    ['Program flow for Sunday worship', 'PROGRAM'],
    ['Meeting next Monday', 'EVENT'],
    ['Tula para sa kaibigan', 'POEM'],
    ['Grocery:\n- rice\n- eggs', 'SHOPPING_LIST'],
    ['Tasks:\n- clean room\n- wash dishes', 'CHECKLIST'],
    ['Idea: plant a new garden', 'IDEA'],
    ['Paalaala: meeting tomorrow', 'NOTICE'],
    ['Tawagan si Juan bukas', 'DUE_TASK'],
    ['Journal entry Nov 9: I am grateful today', 'WRITING'],
    ['Nakita ko si Juan kahapon', 'QUICK_NOTE'],
    ['Document certificate of employment', 'DOCUMENT'],
  ])('detects %s as %s', (text, expected) => {
    expect(classifySmartDrawerText(text, now).type).toBe(expected);
  });

  it('does not automatically schedule incidental dates in an ordinary note', () => {
    const result = classifySmartDrawerText('Nakita ko si Juan Nov 9', now);
    expect(result.type).toBe('QUICK_NOTE');
    expect(result.dueAt).toBeNull();
  });

  it('does not classify words like programming as event programs', () => {
    expect(classifySmartDrawerText('My programming thoughts', now).type)
      .toBe('QUICK_NOTE');
  });

  it('keeps a true task with a deadline and a due date', () => {
    const result = classifySmartDrawerText('Gawin ang report bukas', now);
    expect(result.type).toBe('DUE_TASK');
    expect(result.dueAt).not.toBeNull();
  });
});
