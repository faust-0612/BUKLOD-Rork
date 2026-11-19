/**
 * A season owns the global theme; users do not select alternate color schemes
 * for an active season. Production Season 1 behavior is preserved verbatim.
 */
import {getBuklodGlobalTheme,type BuklodThemeRoles} from '@/lib/buklodTheme';
import {GENESIS_IDENTITY,GENESIS_PALETTE,isGenesisPreviewBuild} from './genesisContract';

export const GENESIS_SEASON=Object.freeze({
  id:GENESIS_IDENTITY.id,
  name:GENESIS_IDENTITY.title,
  motif:'GALACTIC CREATION | NEBULAE | PLANETS | GALAXIES | RADIANT FIRST LIGHT',
  verse:GENESIS_IDENTITY.verse,
  text:GENESIS_IDENTITY.quote,
  activation:'release-gated',
  premiumAssetsPending:true,
});
const base=getBuklodGlobalTheme('nightPine').roles;
export const GENESIS_GLOBAL_ROLES:BuklodThemeRoles=Object.freeze({
  ...base,
  canvas:GENESIS_PALETTE.void,
  surface:GENESIS_PALETTE.surface,
  surfaceElevated:'#172848',
  surfaceMuted:'#1A2A4B',
  cardSurface:GENESIS_PALETTE.surface,
  headerSurface:GENESIS_PALETTE.cosmos,
  textPrimary:'#F8FAFF',textSecondary:'#D3E1FA',textMuted:'#B6C6E1',
  accent:'#65D8CC',accentSoft:'#1B4255',border:'#34476D',
  inputSurface:'#182749',buttonPrimary:'#65D8CC',onAccent:'#061529',
  buttonSecondary:'#203851',unreadBadge:'#48B989',
  navBackground:'#0C1730',navActive:'#1A354E',
  navActiveIndicator:GENESIS_PALETTE.gold,
  navIconActive:'#FFE8B6',navIconInactive:'#B6C6E1',
  navLabelActive:'#FFE8B6',navLabelInactive:'#B6C6E1',
  navBorder:'#34476D',navShadow:'#050714',
  overlay:'rgba(2,5,19,.78)',shadow:'#020614',
});
export function isSeasonThemeLocked():boolean{return isGenesisPreviewBuild();}
export function canUserSelectTheme():boolean{return !isSeasonThemeLocked();}
export function getLockedSeasonTheme(){
  return {preference:'nightPine' as const,paletteId:'nightPine' as const,roles:GENESIS_GLOBAL_ROLES};
}
