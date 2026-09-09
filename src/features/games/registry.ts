import type { BuklodGameDefinition } from './types';

export const BUKLOD_GAMES: Record<string, BuklodGameDefinition> = {
  'jawo-forest-trail': {
    id: 'jawo-forest-trail',
    characterKey: 'jawo',
    mapType: 'forest',
    stationKey: 'forest-trail-01',
    title: 'Forest Trail',
    subtitle: 'Jawo Adventure Prototype',
    objective: 'Choose the safest lane, avoid obstacles, and collect trail lights before the forest run ends.',
    replayable: true,
  },
  'trudice-playground-memory': {
    id: 'trudice-playground-memory',
    characterKey: 'trudice',
    mapType: 'children-playground',
    stationKey: 'playground-memory-01',
    title: 'Playground Memory',
    subtitle: 'Trudice Children\'s Haven Prototype',
    objective: 'Find all matching pairs in as few moves as possible.',
    replayable: true,
  },
};

export const getBuklodGameDefinition = (gameId: string) => BUKLOD_GAMES[gameId] ?? null;
