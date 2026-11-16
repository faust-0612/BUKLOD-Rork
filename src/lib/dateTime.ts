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
