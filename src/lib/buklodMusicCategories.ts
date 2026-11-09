/** Virtual folders; category changes never move audio objects referenced by old posts. */
export const BUKLOD_MUSIC_CATEGORIES=[
 {id:'christian',label:'Christian Music'},
 {id:'love',label:'Love Songs'},
 {id:'instrumental',label:'Instrumental'},
 {id:'sound_clips',label:'Sound Clips'},
 {id:'ambience',label:'Ambient & Nature'},
 {id:'others',label:'Others'},
] as const;
export type BuklodMusicCategory=typeof BUKLOD_MUSIC_CATEGORIES[number]['id'];
export type BuklodMusicFolder=BuklodMusicCategory|'all';
export const BUKLOD_MUSIC_PAGE_SIZE=40;
export const normalizeBuklodMusicCategory=(value:unknown):BuklodMusicCategory=>
  BUKLOD_MUSIC_CATEGORIES.find(c=>c.id===value)?.id??'others';
export const buklodMusicCategoryLabel=(value:unknown):string=>
  BUKLOD_MUSIC_CATEGORIES.find(c=>c.id===normalizeBuklodMusicCategory(value))?.label??'Others';
