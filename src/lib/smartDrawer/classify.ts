import type {
  SmartDrawerClassification,
  SmartDrawerItemType,
  SmartDrawerListItem,
} from './types';

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function titleFromText(text: string, fallback: string) {
  const line = text
    .split(/\r?\n/)
    .map(clean)
    .find(Boolean);
  if (!line) return fallback;
  return line.length > 72 ? `${line.slice(0, 69)}…` : line;
}

function parseClock(text: string) {
  const match = text.match(
    /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i,
  );
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const ap = match[3].toLowerCase();
  if (ap === 'pm' && hour < 12) hour += 12;
  if (ap === 'am' && hour === 12) hour = 0;
  return { hour, minute };
}

function setClock(date: Date, text: string) {
  const clock = parseClock(text);
  if (clock) {
    date.setHours(clock.hour, clock.minute, 0, 0);
  } else {
    date.setHours(9, 0, 0, 0);
  }
  return date;
}

function nextWeekday(now: Date, weekday: number) {
  const result = new Date(now);
  const delta = ((weekday - result.getDay() + 7) % 7) || 7;
  result.setDate(result.getDate() + delta);
  return result;
}

export function detectSmartDrawerDate(
  rawText: string,
  now = new Date(),
): string | null {
  const text = rawText.toLowerCase();

  if (/\b(tomorrow|bukas)\b/i.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return setClock(date, rawText).toISOString();
  }

  const weekdayMatch = text.match(
    /\b(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  if (weekdayMatch) {
    const weekday = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ].indexOf(weekdayMatch[1].toLowerCase());
    if (weekday >= 0) {
      return setClock(nextWeekday(now, weekday), rawText).toISOString();
    }
  }

  const monthMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i,
  );
  if (monthMatch) {
    const month = MONTHS[monthMatch[1].toLowerCase()];
    const day = Number(monthMatch[2]);
    const year = Number(monthMatch[3] ?? now.getFullYear());
    const date = new Date(year, month, day);
    if (
      !monthMatch[3] &&
      date.getTime() < now.getTime() - 24 * 60 * 60 * 1000
    ) {
      date.setFullYear(date.getFullYear() + 1);
    }
    return setClock(date, rawText).toISOString();
  }

  const numeric = text.match(
    /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/,
  );
  if (numeric) {
    const month = Number(numeric[1]) - 1;
    const day = Number(numeric[2]);
    let year = Number(numeric[3] ?? now.getFullYear());
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    return setClock(date, rawText).toISOString();
  }

  return null;
}

let listIdCounter = 0;

function createListEntryId() {
  listIdCounter += 1;
  return `drawer-list-${Date.now()}-${listIdCounter}`;
}

function listFromText(text: string, forceList = false): SmartDrawerListItem[] {
  // Never turn ordinary comma-separated prose into an unsolicited checklist.
  // An explicit bullet/number marker or the user's List choice is required.
  const normalized = text.trim();
  const lines = forceList
    ? normalized.split(/\r?\n|,|;/)
    : normalized.split(/\r?\n/).filter(line =>
        /^\s*(?:[-•*]\s+|\d+[.)]\s+|\[[xX ]\]\s+)/.test(line));
  const pieces = lines
    .map(value => value.replace(/^\s*(?:[-•*]\s+|\d+[.)]\s+|\[[xX ]\]\s+)/, '').trim())
    .filter(value => value.length > 0 && value.length <= 120);
  if (!pieces.length) return [];

  return pieces.slice(0, 100).map(text => ({
    id: createListEntryId(),
    text,
    done: false,
  }));
}

function hasAny(text: string, words: string[]) {
  return words.some(word => text.includes(word));
}

function classifyType(text: string, dueAt: string | null, listCount: number) {
  const lower = text.toLowerCase();

  if (
    hasAny(lower, ['receipt', 'resibo', 'official receipt', 'invoice'])
  ) {
    return 'RECEIPT' as SmartDrawerItemType;
  }

  if (
    hasAny(lower, ['appointment', 'dentist', 'doctor', 'checkup', 'check-up'])
  ) {
    return 'APPOINTMENT' as SmartDrawerItemType;
  }

  if (
    hasAny(lower, ['meeting', 'anniversary', 'event', 'program', 'seminar'])
  ) {
    return hasAny(lower, ['program', 'anniversary'])
      ? ('PROGRAM' as SmartDrawerItemType)
      : ('EVENT' as SmartDrawerItemType);
  }

  if (
    hasAny(lower, ['tula', 'poem', 'stanza', 'saknong'])
  ) {
    return 'POEM' as SmartDrawerItemType;
  }

  if (listCount > 0) {
    if (
      hasAny(lower, [
        'bibilhin',
        'shopping',
        'grocery',
        'palengke',
        'bilhin',
      ])
    ) {
      return 'SHOPPING_LIST' as SmartDrawerItemType;
    }
    return 'CHECKLIST' as SmartDrawerItemType;
  }

  if (
    hasAny(lower, ['idea:', 'idea ', 'possible ', 'maybe ', 'isip ko'])
  ) {
    return 'IDEA' as SmartDrawerItemType;
  }

  if (
    hasAny(lower, ['notice', 'announcement', 'paalala', 'abiso'])
  ) {
    return 'NOTICE' as SmartDrawerItemType;
  }

  if (dueAt) return 'DUE_TASK' as SmartDrawerItemType;

  if (
    hasAny(lower, ['task', 'todo', 'to do', 'gawin', 'tawagan', 'puntahan'])
  ) {
    return 'TASK' as SmartDrawerItemType;
  }

  if (text.includes('\n') && text.length > 120) {
    return 'WRITING' as SmartDrawerItemType;
  }

  return 'QUICK_NOTE' as SmartDrawerItemType;
}

function fallbackTitle(type: SmartDrawerItemType) {
  switch (type) {
    case 'SHOPPING_LIST':
      return 'Shopping List';
    case 'CHECKLIST':
      return 'Checklist';
    case 'DUE_TASK':
      return 'Due Task';
    case 'EVENT':
      return 'Event';
    case 'APPOINTMENT':
      return 'Appointment';
    case 'PROGRAM':
      return 'Program';
    case 'POEM':
      return 'Writing';
    case 'IDEA':
      return 'Idea';
    default:
      return 'Quick Note';
  }
}

export function classifySmartDrawerText(
  rawText: string,
  now = new Date(),
  forceList = false,
): SmartDrawerClassification {
  const text = rawText.trim();
  const dueAt = detectSmartDrawerDate(text, now);
  const listItems = listFromText(text, forceList);
  const type = classifyType(text, dueAt, listItems.length);

  const eventAt =
    ['EVENT', 'APPOINTMENT', 'PROGRAM'].includes(type) && dueAt
      ? dueAt
      : null;

  const reasons: string[] = [];
  if (dueAt) reasons.push('date_or_time_detected');
  if (listItems.length > 0) reasons.push(forceList ? 'user_selected_list' : 'explicit_list_markers');
  if (type !== 'QUICK_NOTE') reasons.push(`type_${type.toLowerCase()}`);

  return {
    type,
    title: titleFromText(text, fallbackTitle(type)),
    dueAt,
    eventAt,
    listItems,
    confidence:
      dueAt || listItems.length > 0 || type !== 'QUICK_NOTE'
        ? 'MEDIUM'
        : 'LOW',
    reasons,
  };
}

export function isSmartDrawerOverdue(
  dueAt: string | null,
  status: string,
  now = Date.now(),
) {
  if (!dueAt || status !== 'ACTIVE') return false;
  const time = Date.parse(dueAt);
  return Number.isFinite(time) && time < now;
}
