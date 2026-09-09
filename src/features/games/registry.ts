import type { BuklodGameDefinition } from './types';

export const BUKLOD_GAMES: Record<string, BuklodGameDefinition> = {
  'jawo-forest-trail': {
    id: 'jawo-forest-trail', characterKey: 'jawo', mapType: 'forest', stationKey: 'forest-trail-01',
    title: 'Forest Trail', subtitle: 'Jawo • Whispering Forest',
    objective: 'Swipe across three trails, avoid fallen rock, collect Trail Lights, and keep a clean-run combo as the forest speeds up.', replayable: true,
  },
  'trudice-playground-memory': {
    id: 'trudice-playground-memory', characterKey: 'trudice', mapType: 'children-playground', stationKey: 'playground-memory-01',
    title: 'Wonder Path', subtitle: 'Trudice • Children\'s Haven',
    objective: 'Watch a glowing route across the playground, then repeat the station sequence as each round becomes longer.', replayable: true,
  },
  'ace-rescue-grid': {
    id: 'ace-rescue-grid', characterKey: 'ace', mapType: 'strategy-city', stationKey: 'rescue-grid-01',
    title: 'Rescue Grid', subtitle: 'Ace • Strategy District',
    objective: 'Plan a low-cost route, secure three rescue beacons, avoid blocked corridors, and reach extraction before energy runs out.', replayable: true,
  },
  'mitch-restore-mural': {
    id: 'mitch-restore-mural', characterKey: 'mitch', mapType: 'art-village', stationKey: 'mural-restoration-01',
    title: 'Restore the Mural', subtitle: 'Mitch • Art Village',
    objective: 'Drag six mural fragments into their true positions, restore the composition with precision, and build a clean restoration combo.', replayable: true,
  },
  'niel-mission-trail': {
    id: 'niel-mission-trail', characterKey: 'niel', mapType: 'mission-frontier', stationKey: 'mission-trail-01',
    title: 'Mission Trail', subtitle: 'Niel • Mission Frontier',
    objective: 'Lead an expedition through five route decisions, balance water, food, energy and morale, and reach the remote village without collapsing the team reserve.', replayable: true,
  },
  'angel-kingdom-treasury': {
    id: 'angel-kingdom-treasury', characterKey: 'angel', mapType: 'treasury-city', stationKey: 'stewardship-council-01',
    title: 'Kingdom Treasury', subtitle: 'Angel • Treasury City',
    objective: 'Build a balanced quarter budget, preserve an emergency reserve, absorb an unexpected crisis, and finish with healthy welfare, stability, growth and trust.', replayable: true,
  },
  'vhen-farm-to-market': {
    id: 'vhen-farm-to-market', characterKey: 'vhen', mapType: 'agricultural-valley', stationKey: 'farm-market-01',
    title: 'Farm to Market', subtitle: 'Vhen • Agricultural Valley',
    objective: 'Plan crops, respond to weather, choose harvest timing, read market demand and deliver the season with minimal spoilage.', replayable: true,
  },
  'elesur-village-builder': {
    id: 'elesur-village-builder', characterKey: 'elesur', mapType: 'highland-community', stationKey: 'village-builder-01',
    title: 'Village Builder', subtitle: 'ELESUR • Highland Community',
    objective: 'Use limited workers and materials to resolve urgent community needs while balancing care, access, learning and livelihood.', replayable: true,
  },
  'phan-enterprise-builder': {
    id: 'phan-enterprise-builder', characterKey: 'phan', mapType: 'farm-enterprise', stationKey: 'enterprise-builder-01',
    title: 'Enterprise Builder', subtitle: 'Phan • Farmstead to Enterprise',
    objective: 'Manage production, processing, sales, expansion, cash flow and reputation across six business cycles.', replayable: true,
  },
  'van-living-city-dispatch': {
    id: 'van-living-city-dispatch', characterKey: 'van', mapType: 'living-city', stationKey: 'city-dispatch-01',
    title: 'City Dispatch', subtitle: 'Van • The Living City',
    objective: 'Prioritize urban service requests, deploy the right teams, preserve capacity and keep public trust from collapsing.', replayable: true,
  },
  'christian-civic-leadership': {
    id: 'christian-civic-leadership', characterKey: 'christian', mapType: 'civic-academy', stationKey: 'leadership-council-01',
    title: 'Leadership Council', subtitle: 'Christian • Civic Academy',
    objective: 'Navigate five civic leadership cases while protecting trust, unity, budget and time.', replayable: true,
  },
  'lhen-rhythm-journey': {
    id: 'lhen-rhythm-journey', characterKey: 'lhen', mapType: 'music-city', stationKey: 'rhythm-journey-01',
    title: 'Rhythm Journey', subtitle: 'Lhen • Music & Mission City',
    objective: 'Hit a real timing grid with perfect, good and miss windows, build combo, and complete the performance with strong accuracy.', replayable: true,
  },
  'quin-discovery-expedition': {
    id: 'quin-discovery-expedition', characterKey: 'quin', mapType: 'discovery-world', stationKey: 'discovery-expedition-01',
    title: 'Discovery Expedition', subtitle: 'Quin • Discovery World',
    objective: 'Explore fog-of-war, gather clues, avoid hazards, protect expedition energy and secure the hidden relic.', replayable: true,
  },
};

export const getBuklodGameDefinition = (gameId: string) => BUKLOD_GAMES[gameId] ?? null;
