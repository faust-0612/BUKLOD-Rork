/** BUKLOD Season 2 cosmic Creation, presentation-only and release-gated. */
export const GENESIS_IDENTITY = Object.freeze({
  id: 'season2-genesis',
  title: 'Genesis: Let There Be Light',
  quote: 'Let there be light',
  verse: 'Genesis 1:3',
  motif: 'galactic-creation',
  center: 'radiant-first-light',
  subtitle: 'At the Creator’s word, light broke into the void.',
});
export const GENESIS_PALETTE = Object.freeze({
  void: '#050A19', cosmos: '#09142C', nebula: '#463D79', teal: '#65D8CC',
  gold: '#F3D399', goldLight: '#FFE8B6', radiant: '#FFF3D4', star: '#E9F3FF', surface: '#101E3C',
  textOnDark: '#F8FAFF', line: 'rgba(243,211,153,.4)',
});
export const GENESIS_MOTION_MS = Object.freeze({
  tap: 150, navigation: 180, iconAccent: 1600, atmosphericDrift: 10500,
  rewardEntrance: 490, rewardReveal: 950,
});
export type GenesisSurface='home'|'wall'|'connect'|'profile'|'bible'|'character'|'kingdom'|'reward';
export type GenesisQuality='full'|'balanced'|'minimal';
/** Canonical galactic scene vocabulary for every Season 2 surface. No reward authority. */
export const GENESIS_SURFACE_DESIGN: Readonly<Record<GenesisSurface, {
  scene: string; emphasis: string; motion: 'cinematic'|'subtle'|'static';
}>> = Object.freeze({
  home:{scene:'galaxy-first-light',emphasis:'radiant-origin',motion:'cinematic'},
  wall:{scene:'deep-cosmos-hairlines',emphasis:'legible-feed',motion:'static'},
  connect:{scene:'dark-orbital-lines',emphasis:'instant-messaging',motion:'static'},
  profile:{scene:'celestial-halo',emphasis:'rank-insignia',motion:'subtle'},
  bible:{scene:'quiet-creation-light',emphasis:'scripture-readability',motion:'static'},
  character:{scene:'starlit-nebula',emphasis:'licensed-rig-only',motion:'cinematic'},
  kingdom:{scene:'living-galactic-realm',emphasis:'interactive-world',motion:'cinematic'},
  reward:{scene:'first-light-burst',emphasis:'verified-reward-only',motion:'cinematic'},
});
export interface GenesisMotionContext {
  surface:GenesisSurface; quality:GenesisQuality; focused:boolean;
  appActive:boolean; reducedMotion:boolean; powerSave?:boolean;
  videoPlaying?:boolean; callActive?:boolean;
}
export function resolveGenesisMotion(c:GenesisMotionContext) {
  const live=c.focused&&c.appActive&&!c.reducedMotion&&!c.powerSave&&!c.videoPlaying&&!c.callActive;
  const ambient=live&&c.quality!=='minimal'&&['home','profile','character','kingdom','reward'].includes(c.surface);
  const particles=ambient&&c.quality==='full';
  return {ambient,particles,cinematic:live&&['reward','kingdom'].includes(c.surface),essential:!c.reducedMotion};
}
export function isGenesisPreviewEnabled(enabled:string|undefined,environment:string|undefined) {
  return enabled==='true'&&['staging','preview','development','dev'].includes((environment||'').toLowerCase());
}
export function isGenesisPreviewBuild():boolean {
  return isGenesisPreviewEnabled(process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,process.env.EXPO_PUBLIC_APP_ENV);
}
export function getGenesisExperience(surface:GenesisSurface):string {
  const value:Record<GenesisSurface,string>={
    home:'creation-cosmos-hero',wall:'subtle-orbits-no-audio',connect:'fast-messenger-no-audio',
    profile:'celestial-rank-frame',bible:'creation-light-reader',character:'rive-cosmic-character',
    kingdom:'interactive-world',reward:'verified-cinematic-reveal',
  };
  return value[surface];
}
