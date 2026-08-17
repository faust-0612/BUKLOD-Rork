/**
 * PATCH 172C
 *
 * Repairs text that was UTF-8 but was accidentally decoded as Windows-1252
 * one or more times. This is DISPLAY-ONLY normalization.
 *
 * It never writes to Supabase and returns the original text whenever a
 * conversion is invalid or does not reduce common mojibake markers.
 */

const CP1252_UNICODE_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function mojibakeBadness(value: string): number {
  let score = 0;

  const markers = [
    '\u00c3', // Ã
    '\u00c2', // Â
    '\u00e2', // â
    '\u00f0', // ð
    '\u00ef\u00bf\u00bd', // ï¿½
    '\ufffd',
  ];

  for (const marker of markers) {
    let from = 0;

    while (true) {
      const index =
        value.indexOf(
          marker,
          from
        );

      if (index < 0) {
        break;
      }

      score += 1;
      from =
        index +
        marker.length;
    }
  }

  return score;
}

function encodeWindows1252(
  value: string
): number[] | null {
  const bytes: number[] = [];

  for (const ch of value) {
    const cp =
      ch.codePointAt(0);

    if (cp == null) {
      return null;
    }

    if (cp <= 0xff) {
      bytes.push(cp);
      continue;
    }

    const mapped =
      CP1252_UNICODE_TO_BYTE[
        cp
      ];

    if (mapped == null) {
      return null;
    }

    bytes.push(mapped);
  }

  return bytes;
}

function decodeUtf8(
  bytes: number[]
): string | null {
  let out = '';

  for (
    let i = 0;
    i < bytes.length;
  ) {
    const b1 =
      bytes[i];

    if (b1 <= 0x7f) {
      out +=
        String.fromCodePoint(
          b1
        );
      i += 1;
      continue;
    }

    if (
      b1 >= 0xc2 &&
      b1 <= 0xdf
    ) {
      if (
        i + 1 >=
        bytes.length
      ) {
        return null;
      }

      const b2 =
        bytes[i + 1];

      if (
        (b2 & 0xc0) !==
        0x80
      ) {
        return null;
      }

      out +=
        String.fromCodePoint(
          (
            (
              b1 & 0x1f
            ) << 6
          ) |
          (
            b2 & 0x3f
          )
        );

      i += 2;
      continue;
    }

    if (
      b1 >= 0xe0 &&
      b1 <= 0xef
    ) {
      if (
        i + 2 >=
        bytes.length
      ) {
        return null;
      }

      const b2 =
        bytes[i + 1];
      const b3 =
        bytes[i + 2];

      if (
        (b2 & 0xc0) !==
          0x80 ||
        (b3 & 0xc0) !==
          0x80
      ) {
        return null;
      }

      if (
        b1 === 0xe0 &&
        b2 < 0xa0
      ) {
        return null;
      }

      if (
        b1 === 0xed &&
        b2 >= 0xa0
      ) {
        return null;
      }

      out +=
        String.fromCodePoint(
          (
            (
              b1 & 0x0f
            ) << 12
          ) |
          (
            (
              b2 & 0x3f
            ) << 6
          ) |
          (
            b3 & 0x3f
          )
        );

      i += 3;
      continue;
    }

    if (
      b1 >= 0xf0 &&
      b1 <= 0xf4
    ) {
      if (
        i + 3 >=
        bytes.length
      ) {
        return null;
      }

      const b2 =
        bytes[i + 1];
      const b3 =
        bytes[i + 2];
      const b4 =
        bytes[i + 3];

      if (
        (b2 & 0xc0) !==
          0x80 ||
        (b3 & 0xc0) !==
          0x80 ||
        (b4 & 0xc0) !==
          0x80
      ) {
        return null;
      }

      if (
        b1 === 0xf0 &&
        b2 < 0x90
      ) {
        return null;
      }

      if (
        b1 === 0xf4 &&
        b2 > 0x8f
      ) {
        return null;
      }

      out +=
        String.fromCodePoint(
          (
            (
              b1 & 0x07
            ) << 18
          ) |
          (
            (
              b2 & 0x3f
            ) << 12
          ) |
          (
            (
              b3 & 0x3f
            ) << 6
          ) |
          (
            b4 & 0x3f
          )
        );

      i += 4;
      continue;
    }

    return null;
  }

  return out;
}

function repairOnePass(
  value: string
): string {
  const before =
    mojibakeBadness(
      value
    );

  if (before <= 0) {
    return value;
  }

  const bytes =
    encodeWindows1252(
      value
    );

  if (!bytes) {
    return value;
  }

  const decoded =
    decodeUtf8(
      bytes
    );

  if (!decoded) {
    return value;
  }

  const after =
    mojibakeBadness(
      decoded
    );

  if (after >= before) {
    return value;
  }

  return decoded;
}

export function repairMojibakeText(
  value:
    | string
    | null
    | undefined
): string {
  if (!value) {
    return value ?? '';
  }

  let current =
    value;

  for (
    let pass = 0;
    pass < 3;
    pass += 1
  ) {
    const next =
      repairOnePass(
        current
      );

    if (next === current) {
      break;
    }

    current =
      next;
  }

  return current;
}