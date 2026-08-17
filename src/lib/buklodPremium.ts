/*
 * PATCH_179B_GLOBAL_PREMIUM_FOUNDATION
 *
 * BUKLOD shared premium design tokens.
 * JS/TS only. No native dependency.
 */

export const buklodPremium = {
  canvas: '#F6F8F6',
  surface: '#FFFFFF',
  surfaceSoft: '#FAFCFA',
  surfaceTint: '#F1F7F3',

  line: 'rgba(31,78,55,0.11)',
  lineStrong: 'rgba(31,78,55,0.18)',

  text: '#17231C',
  muted: '#6D7B73',

  green: '#2F7650',
  greenDark: '#214F39',
  greenSoft: '#E6F3EA',

  radius: {
    xs: 10,
    sm: 13,
    md: 17,
    lg: 21,
    xl: 26,
    pill: 999,
  },

  space: {
    xs: 6,
    sm: 9,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 26,
  },

  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.055,
      shadowRadius: 14,
      elevation: 3,
    },

    raised: {
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.075,
      shadowRadius: 18,
      elevation: 5,
    },
  },
} as const;