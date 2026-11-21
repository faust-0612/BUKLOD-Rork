/**
 * Illustration-only Kabihasnang Ligaw location motifs for the 13 original
 * BUKLOD Kingdom character STATIONS. Do not treat pairings as canonical story
 * assignments: the glossary names individual places and characters, but does
 * not canonically assign one unique world to each of the 13 playable characters.
 * The visual mapping is NOT an amendment to unreleased KL lore.
 *
 * Names and descriptions are checked against the existing
 * kabihasnang-ligaw/dictionary.ts and dictionaryExtras.ts by CI. They are NOT
 * rendered to users here, to avoid pre-releasing plot or glossary material.
 * These decorative motifs never determine character level, economy or routes.
 */
export type KlKingdomVisualMotif = Readonly<{
  dictionaryTerm: string;
  visual: 'light-stone-village' | 'memory-ruins' | 'order-measure-tower' |
    'crossroads-gate' | 'lantern-city' | 'fear-fortress' |
    'woven-record-hall' | 'traced-forest' | 'mirror-sanctum' |
    'hope-bridge' | 'record-archive' | 'root-river' | 'first-light-garden';
  sky: string; horizon: string; ground: string; accent: string; stone: string;
}>;
export const KL_KINGDOM_VISUAL_MOTIFS = {
  'phan-enterprise-builder':{
    dictionaryTerm:'Lunawen',visual:'light-stone-village',
    sky:'#E8CDA5',horizon:'#87A68A',ground:'#335D4E',accent:'#FFE4A4',stone:'#E8D7AF',
  },
  'quin-discovery-expedition':{
    dictionaryTerm:'Ulnarik',visual:'memory-ruins',
    sky:'#B2BDCE',horizon:'#617F9C',ground:'#2A5265',accent:'#D2E6FF',stone:'#BED4DC',
  },
  'van-living-city-dispatch':{
    dictionaryTerm:'Tigmalar',visual:'order-measure-tower',
    sky:'#CBD7CC',horizon:'#76A49A',ground:'#31575B',accent:'#D4F8E1',stone:'#C8D5CD',
  },
  'christian-civic-leadership':{
    dictionaryTerm:'Hatiran',visual:'crossroads-gate',
    sky:'#E3D7BC',horizon:'#8C9B8B',ground:'#485E59',accent:'#F8DE9B',stone:'#D3C4AA',
  },
  'lhen-rhythm-journey':{
    dictionaryTerm:'Lampira',visual:'lantern-city',
    sky:'#CDBDCE',horizon:'#746D9A',ground:'#39415F',accent:'#FFE4A5',stone:'#D9C8C6',
  },
  'ace-rescue-grid':{
    dictionaryTerm:'Kulimbay',visual:'fear-fortress',
    sky:'#B5C4D0',horizon:'#4D6885',ground:'#253E58',accent:'#B3E1DF',stone:'#A7BDC5',
  },
  'elesur-village-builder':{
    dictionaryTerm:'Salindaw',visual:'woven-record-hall',
    sky:'#E6D5BE',horizon:'#92AC9A',ground:'#385D54',accent:'#EAD6A8',stone:'#DAC8AE',
  },
  'jawo-forest-trail':{
    dictionaryTerm:'Kagubatang May Mga Bakas',visual:'traced-forest',
    sky:'#C2D8BC',horizon:'#5E9974',ground:'#215D47',accent:'#CEECAB',stone:'#B9CB9B',
  },
  'mitch-restore-mural':{
    dictionaryTerm:'Marukhan',visual:'mirror-sanctum',
    sky:'#DECDBB',horizon:'#9A98A3',ground:'#4D686B',accent:'#F7DEBF',stone:'#D5C4BF',
  },
  'niel-mission-trail':{
    dictionaryTerm:'Dalamhira',visual:'hope-bridge',
    sky:'#B3C0C4',horizon:'#6A8D94',ground:'#2F5360',accent:'#F9E3AE',stone:'#C5D4CA',
  },
  'angel-kingdom-treasury':{
    dictionaryTerm:'Dumalir',visual:'record-archive',
    sky:'#D8C9B5',horizon:'#9A9C94',ground:'#465B57',accent:'#F7D99C',stone:'#D8C7AC',
  },
  'vhen-farm-to-market':{
    dictionaryTerm:'Puso ng Ugat',visual:'root-river',
    sky:'#CADAB3',horizon:'#80A686',ground:'#285846',accent:'#DDF1B2',stone:'#C7CA9A',
  },
  'trudice-playground-memory':{
    dictionaryTerm:'Ilawin',visual:'first-light-garden',
    sky:'#DFE0BD',horizon:'#95BDA1',ground:'#42695B',accent:'#FFF0A4',stone:'#DCD9B3',
  },
} as const satisfies Record<string,KlKingdomVisualMotif>;
export type KlKingdomVisualId = keyof typeof KL_KINGDOM_VISUAL_MOTIFS;
