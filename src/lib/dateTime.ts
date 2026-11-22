export function formatSpecificDateTime(
  value:
    | string
    | number
    | Date
    | null
    | undefined
): string {
  if (!value) {
    return '';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const datePart =
    new Intl.DateTimeFormat(
      'en-PH',
      {
        timeZone:
          'Asia/Manila',

        weekday:
          'short',

        month:
          'short',

        day:
          'numeric',

        year:
          'numeric',
      }
    ).format(date);

  const timePart =
    new Intl.DateTimeFormat(
      'en-PH',
      {
        timeZone:
          'Asia/Manila',

        hour:
          'numeric',

        minute:
          '2-digit',

        hour12:
          true,
      }
    ).format(date);

  return `${datePart} • ${timePart}`;
}

/** Feed identity compact date; keeps both date and local time on one line. */
export function formatCompactWallDateTime(
  value: Parameters<typeof formatSpecificDateTime>[0]
): string {
  return formatSpecificDateTime(value).replace(/^[A-Za-z]{3},\s*/, '');
}

/** Short comment action times keep full timestamps available in View Details. */
const commentDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
});
const commentMonthDayFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric',
});
const commentYearFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', year: 'numeric',
});
const commentClockFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true,
});

export function formatCompactCommentDateTime(
  value: Parameters<typeof formatSpecificDateTime>[0],
  now: Date = new Date(),
): string {
  if (value == null || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) return '';

  const clock = commentClockFormatter.format(date);
  if (commentDayFormatter.format(date) === commentDayFormatter.format(now)) {
    return clock;
  }
  const year = commentYearFormatter.format(date);
  const shortDate = commentMonthDayFormatter.format(date);
  return `${shortDate}${year === commentYearFormatter.format(now) ? '' : `, ${year}`} · ${clock}`;
}
