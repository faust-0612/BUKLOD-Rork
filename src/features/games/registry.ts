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
  'ace-rescue-grid': {
    id: 'ace-rescue-grid',
    characterKey: 'ace',
    mapType: 'strategy-city',
    stationKey: 'rescue-grid-01',
    title: 'Rescue Grid',
    subtitle: 'Ace • Strategy District',
    objective: 'Plan a low-cost route, secure three rescue beacons, avoid blocked corridors, and reach extraction before energy runs out.',
    replayable: true,
  },
  'mitch-restore-mural': {
    id: 'mitch-restore-mural',
    characterKey: 'mitch',
    mapType: 'art-village',
    stationKey: 'mural-restoration-01',
    title: 'Restore the Mural',
    subtitle: 'Mitch • Art Village',
    objective: 'Drag six mural fragments into their true positions, restore the composition with precision, and build a clean restoration combo.',
    replayable: true,
  },
  'niel-mission-trail': {
    id: 'niel-mission-trail',
    characterKey: 'niel',
    mapType: 'mission-frontier',
    stationKey: 'mission-trail-01',
    title: 'Mission Trail',
    subtitle: 'Niel • Mission Frontier',
    objective: 'Lead an expedition through five route decisions, balance water, food, energy and morale, and reach the remote village without collapsing the team reserve.',
    replayable: true,
  },
};

export const getBuklodGameDefinition = (gameId: string) => BUKLOD_GAMES[gameId] ?? null;
