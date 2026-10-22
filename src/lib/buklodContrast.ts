import type {
  BuklodThemeRoles,
} from '@/lib/buklodTheme';

type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type ContrastPaint = {
  color: string;
  shadowColor: string;
  edgeColor: string;
  isDarkBackground: boolean;
};

function clampChannel(
  value: number
) {
  return Math.max(
    0,
    Math.min(255, Math.round(value))
  );
}

export function parseCssColor(
  value?: string | null
): Rgb | null {
  const input = String(value ?? '').trim();

  if (!input) {
    return null;
  }

  const hex = input.match(
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
  );

  if (hex) {
    const raw = hex[1];
    const full =
      raw.length === 3
        ? raw
            .split('')
            .map(part => part + part)
            .join('')
        : raw;

    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  const rgba = input.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
  );

  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
    };
  }

  return null;
}

export function relativeLuminance(
  rgb: Rgb
) {
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b)
  );
}

export function withAlpha(
  color: string,
  alpha: number
) {
  const rgb = parseCssColor(color);

  if (!rgb) {
    return color;
  }

  const next = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${next})`;
}

export function resolveContrastPaint(
  backgroundColor?: string | null,
  hasImageBackground = false,
  theme?: BuklodThemeRoles
): ContrastPaint {
  const darkText =
    theme?.textPrimary ?? '#122018';
  const lightText =
    theme?.white ?? '#F7FBF8';
  const darkEdge = 'rgba(12, 18, 14, 0.72)';
  const lightEdge = 'rgba(255, 255, 255, 0.78)';

  if (hasImageBackground) {
    return {
      color: lightText,
      shadowColor: darkEdge,
      edgeColor: lightEdge,
      isDarkBackground: true,
    };
  }

  const rgb = parseCssColor(backgroundColor);

  if (!rgb) {
    return {
      color: darkText,
      shadowColor: lightEdge,
      edgeColor: darkEdge,
      isDarkBackground: false,
    };
  }

  const isDarkBackground =
    relativeLuminance(rgb) < 0.45;

  if (isDarkBackground) {
    return {
      color: lightText,
      shadowColor: darkEdge,
      edgeColor: lightEdge,
      isDarkBackground: true,
    };
  }

  return {
    color: darkText,
    shadowColor: lightEdge,
    edgeColor: darkEdge,
    isDarkBackground: false,
  };
}

export function mixToward(
  color: string,
  toward: 'white' | 'black',
  amount: number
) {
  const rgb = parseCssColor(color);

  if (!rgb) {
    return color;
  }

  const target = toward === 'white' ? 255 : 0;
  const t = Math.max(0, Math.min(1, amount));

  return `rgb(${clampChannel(rgb.r + (target - rgb.r) * t)},${clampChannel(
    rgb.g + (target - rgb.g) * t
  )},${clampChannel(rgb.b + (target - rgb.b) * t)})`;
}
