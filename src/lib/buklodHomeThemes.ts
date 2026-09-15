export type BuklodHomeThemeId =
  | 'cozy-family'
  | 'classic-dad'
  | 'young-men'
  | 'teen'
  | 'professional'
  | 'retro-80s'
  | 'senior-ease';

export type BuklodHomeThemePreset = {
  id: BuklodHomeThemeId;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  palette: {
    canvas: string;
    wall: string;
    wallAlt: string;
    floor: string;
    wood: string;
    surface: string;
    surfaceStrong: string;
    border: string;
    text: string;
    muted: string;
    primary: string;
    primarySoft: string;
    secondary: string;
    secondarySoft: string;
    glow: string;
  };
};

export const DEFAULT_BUKLOD_HOME_THEME: BuklodHomeThemeId = 'cozy-family';

export const BUKLOD_HOME_THEMES: BuklodHomeThemePreset[] = [
  {
    id: 'cozy-family',
    label: 'Cozy Family / Nanay',
    shortLabel: 'Cozy',
    description: 'Warm wood, soft greens, family-first and welcoming.',
    icon: 'home-heart',
    palette: {
      canvas: '#F7F0E5',
      wall: '#FFF7E9',
      wallAlt: '#F3E3C8',
      floor: '#C89362',
      wood: '#9A633B',
      surface: '#FFFDF8',
      surfaceStrong: '#FFF4DD',
      border: '#E4CFB1',
      text: '#3B2D25',
      muted: '#7D6859',
      primary: '#278866',
      primarySoft: '#DDF3E8',
      secondary: '#E88342',
      secondarySoft: '#FCE6D6',
      glow: '#FFE7A8',
    },
  },
  {
    id: 'classic-dad',
    label: 'Classic Dad / Tatay',
    shortLabel: 'Classic',
    description: 'Practical, calm, darker wood and organized utility.',
    icon: 'sofa-outline',
    palette: {
      canvas: '#EDE9E2',
      wall: '#F5F1E8',
      wallAlt: '#D9D0BF',
      floor: '#805B42',
      wood: '#594334',
      surface: '#FBF8F1',
      surfaceStrong: '#E7DFD2',
      border: '#CFC3B4',
      text: '#2D3338',
      muted: '#687078',
      primary: '#315E72',
      primarySoft: '#DDEAF0',
      secondary: '#9A6A34',
      secondarySoft: '#EEE0CC',
      glow: '#E8D5A7',
    },
  },
  {
    id: 'young-men',
    label: 'Young Men / Boys',
    shortLabel: 'Sport Tech',
    description: 'Sporty, tech-forward, bold blues and efficient zones.',
    icon: 'gamepad-variant-outline',
    palette: {
      canvas: '#0F1926',
      wall: '#182738',
      wallAlt: '#22384D',
      floor: '#18202A',
      wood: '#354557',
      surface: '#142333',
      surfaceStrong: '#1E344A',
      border: '#34536C',
      text: '#F0F6FC',
      muted: '#A6B8C8',
      primary: '#45A3FF',
      primarySoft: '#173D5E',
      secondary: '#56D39B',
      secondarySoft: '#173F35',
      glow: '#2F83C9',
    },
  },
  {
    id: 'teen',
    label: 'Teen Studio',
    shortLabel: 'Teen',
    description: 'Youthful study, music and social spaces with playful energy.',
    icon: 'headphones',
    palette: {
      canvas: '#F7F0FF',
      wall: '#FCF7FF',
      wallAlt: '#E9DDF8',
      floor: '#A98DBF',
      wood: '#7F6A91',
      surface: '#FFFFFF',
      surfaceStrong: '#F0E5FA',
      border: '#DDCCEE',
      text: '#372A50',
      muted: '#786990',
      primary: '#7A54D8',
      primarySoft: '#E9E0FA',
      secondary: '#EE668C',
      secondarySoft: '#FCE1EA',
      glow: '#D9B7FF',
    },
  },
  {
    id: 'professional',
    label: 'Professional',
    shortLabel: 'Pro',
    description: 'Clean, premium, minimal and focused for work-heavy days.',
    icon: 'briefcase-outline',
    palette: {
      canvas: '#EDF1F4',
      wall: '#F8FAFB',
      wallAlt: '#E5EAEE',
      floor: '#909AA2',
      wood: '#59656D',
      surface: '#FFFFFF',
      surfaceStrong: '#F0F3F5',
      border: '#D5DCE1',
      text: '#17242D',
      muted: '#66747E',
      primary: '#1D6077',
      primarySoft: '#DCEBF0',
      secondary: '#A37B34',
      secondarySoft: '#F2E8D5',
      glow: '#DCE7EA',
    },
  },
  {
    id: 'retro-80s',
    label: '80s Retro',
    shortLabel: '80s',
    description: 'Retro electronics, neon accents and nostalgic home energy.',
    icon: 'cassette',
    palette: {
      canvas: '#17122E',
      wall: '#251A49',
      wallAlt: '#382262',
      floor: '#281C38',
      wood: '#523765',
      surface: '#211A3D',
      surfaceStrong: '#302354',
      border: '#5A4280',
      text: '#FFF5FF',
      muted: '#CFB9DB',
      primary: '#21D4D4',
      primarySoft: '#153D4D',
      secondary: '#FF5FA2',
      secondarySoft: '#54223D',
      glow: '#A657FF',
    },
  },
  {
    id: 'senior-ease',
    label: 'Senior Easy View',
    shortLabel: 'Easy',
    description: 'High contrast, calm colors and clearer visual separation.',
    icon: 'account-heart-outline',
    palette: {
      canvas: '#F3F6F1',
      wall: '#FFFFFA',
      wallAlt: '#E5EBDD',
      floor: '#B99B73',
      wood: '#806A4B',
      surface: '#FFFFFF',
      surfaceStrong: '#F5F7EF',
      border: '#BCC8B4',
      text: '#17251A',
      muted: '#4F6354',
      primary: '#236D4F',
      primarySoft: '#DCEDE3',
      secondary: '#A55B25',
      secondarySoft: '#F3E1D3',
      glow: '#F4DB93',
    },
  },
];

export function getBuklodHomeTheme(
  id: string | null | undefined,
): BuklodHomeThemePreset {
  return (
    BUKLOD_HOME_THEMES.find((theme) => theme.id === id) ??
    BUKLOD_HOME_THEMES.find((theme) => theme.id === DEFAULT_BUKLOD_HOME_THEME)!
  );
}

export function isBuklodHomeThemeId(value: unknown): value is BuklodHomeThemeId {
  return BUKLOD_HOME_THEMES.some((theme) => theme.id === value);
}
