import type { BuklodGameDefinition } from './types';

export const BUKLOD_GAMES: Record<string, BuklodGameDefinition> = {
  'jawo-forest-trail': {
    id: 'jawo-forest-trail',
    characterKey: 'jawo',
    mapType: 'forest',
    stationKey: 'forest-trail-01',
    title: 'Forest Trail',
    subtitle: 'Jawo • Whispering Forest',
    objective: 'Swipe across three trails, avoid fallen rock, collect Trail Lights, and keep a clean-run combo as the forest speeds up.',
    replayable: true,
  },
  'trudice-playground-memory': {
    id: 'trudice-playground-memory',
    characterKey: 'trudice',
    mapType: 'children-playground',
    stationKey: 'playground-memory-01',
    title: 'Wonder Path',
    subtitle: 'Trudice • Children\'s Haven',
    objective: 'Watch a glowing route across the playground, then repeat the station sequence as each round becomes longer.',
    replayable: true,
  },
};

export const getBuklodGameDefinition = (gameId: string) => BUKLOD_GAMES[gameId] ?? null;
