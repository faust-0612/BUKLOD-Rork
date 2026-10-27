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
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    const ap = match[3].toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }

  // A clock without am/pm is valid only with a colon. A bare number in a
  // receipt or shopping list must never turn into a reminder.
  const clock24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return clock24
    ? { hour: Number(clock24[1]), minute: Number(clock24[2]) }
    : null;
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

const WEEKDAYS: Record<string, number> = {
  sunday: 0, linggo: 0, monday: 1, lunes: 1,
  tuesday: 2, martes: 2, wednesday: 3, miyerkules: 3,
  thursday: 4, huwebes: 4, friday: 5, biyernes: 5,
  saturday: 6, sabado: 6,
};

function validCalendarDate(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  return date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
    ? date
    : null;
}

export function detectSmartDrawerDate(
  rawText: string,
  now = new Date(),
): string | null {
  const text = rawText.toLowerCase();

  const relative = text.match(
    /\b(?:in|after|sa loob ng)\s+(\d{1,3})\s*(minutes?|mins?|minuto|hours?|hrs?|oras)\b/i,
  );
  if (relative) {
    const minutes = Number(relative[1]) *
      (/hour|hr|oras/i.test(relative[2]) ? 60 : 1);
    if (minutes > 0 && minutes <= 30 * 24 * 60) {
      return new Date(now.getTime() + minutes * 60_000).toISOString();
    }
  }

  // Today's time must be explicit and in the future. Never invent a date
  // for a vague 'mamaya' or a note without a time.
  if (/\b(today|ngayon|mamaya|ngayong)\b/i.test(text)) {
    if (!parseClock(rawText)) return null;
    const today = setClock(new Date(now), rawText);
    return today.getTime() > now.getTime()
      ? today.toISOString()
      : null;
  }

  if (/\b(tomorrow|bukas)\b/i.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return setClock(date, rawText).toISOString();
  }

  const weekdayMatch = text.match(
    /\b(?:next\s+|sa\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miyerkules|huwebes|biyernes|sabado|linggo)\b/i,
  );
  if (weekdayMatch) {
    const weekday = WEEKDAYS[weekdayMatch[1].toLowerCase()];
    if (weekday !== undefined) {
      return setClock(nextWeekday(now, weekday), rawText).toISOString();
    }
  }

  const iso = text.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    const date = validCalendarDate(
      Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]),
    );
    return date ? setClock(date, rawText).toISOString() : null;
  }

  const monthMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i,
  );
  if (monthMatch) {
    const month = MONTHS[monthMatch[1].toLowerCase()];
    const day = Number(monthMatch[2]);
    const year = Number(monthMatch[3] ?? now.getFullYear());
    const date = validCalendarDate(year, month, day);
    if (!date) return null;
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
    // Philippines uses both MM/DD and DD/MM. Resolve unambiguous values,
    // retain the existing MM/DD convention for otherwise ambiguous input.
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const month = first > 12 ? second - 1 : first - 1;
    const day = first > 12 ? first : second;
    let year = Number(numeric[3] ?? now.getFullYear());
    if (year < 100) year += 2000;
    const date = validCalendarDate(year, month, day);
    return date ? setClock(date, rawText).toISOString() : null;
  }

  return null;
}

/** Expire only when the author explicitly says the content has an end date. */
export function detectSmartDrawerExpiry(text: string, now = new Date()) {
  const match = text.match(/\b(?:expires?\s+(?:on\s+)?|valid\s+until\s+|expiration\s*:\s*|expire\s+sa\s+|hanggang\s+)([^\n;]+)/i);
  if (!match) return null;
  const date = detectSmartDrawerDate(match[1], now);
  // Preserve already-past explicit expiry dates too: they can be placed in
  // recoverable trash by the lifecycle rather than silently kept forever.
  return date;
}

let listIdCounter = 0;

function createListEntryId() {
  listIdCounter += 1;
  return `drawer-list-${Date.now()}-${listIdCounter}`;
}

function listFromText(text: string): SmartDrawerListItem[] {
  const explicitList = /^\s*(?:bibilhin|shopping|grocery|listahan|checklist|to\s*do|tasks?)\s*:?/i.test(text);
  const bulletLines = text.split(/\r?\n/)
    .filter(line => /^\s*(?:[-•*]|\d+[.)]|\[[ x]\])\s+/.test(line));
  // A multi-paragraph manuscript or note containing commas is NOT a list.
  if (!explicitList && bulletLines.length < 2) return [];
  const normalized = explicitList
    ? text.replace(/^\s*(?:bibilhin|shopping|grocery|listahan|checklist|to\s*do|tasks?)\s*:?/i, '').trim()
    : bulletLines.join('\n');

  const pieces = normalized
    .split(explicitList ? /\r?\n|,|;|\s+-\s+/ : /\r?\n/)
    .map(value => value.replace(/^[-•*]\s*/, '').trim())
    .map(value => value.replace(/^(?:\d+[.)]|\[[ x]\])\s*/, '').trim())
    .filter(Boolean);

  if (pieces.length < 2) return [];

  return pieces.slice(0, 500).map(text => ({
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

  if (listCount >= 2) {
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
): SmartDrawerClassification {
  const text = rawText.trim();
  const dueAt = detectSmartDrawerDate(text, now);
  const listItems = listFromText(text);
  const type = classifyType(text, dueAt, listItems.length);

  const eventAt =
    ['EVENT', 'APPOINTMENT', 'PROGRAM'].includes(type) && dueAt
      ? dueAt
      : null;

  const reasons: string[] = [];
  if (dueAt) reasons.push('date_or_time_detected');
  if (listItems.length >= 2) reasons.push('list_structure_detected');
  if (type !== 'QUICK_NOTE') reasons.push(`type_${type.toLowerCase()}`);

  return {
    type,
    title: titleFromText(text, fallbackTitle(type)),
    dueAt,
    eventAt,
    listItems,
    confidence:
      dueAt || listItems.length >= 2 || type !== 'QUICK_NOTE'
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
