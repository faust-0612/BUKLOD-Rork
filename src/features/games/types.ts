export type BuklodGameStatus = 'ready' | 'playing' | 'won' | 'lost';

export type BuklodGameReward = {
  xp: number;
  kingdomXp: number;
  collectibleKey?: string;
};

export type BuklodGameResult = {
  gameId: string;
  status: Extract<BuklodGameStatus, 'won' | 'lost'>;
  score: number;
  stars: 0 | 1 | 2 | 3;
  reward: BuklodGameReward;
};

export type BuklodGameDefinition = {
  id: string;
  characterKey: string;
  mapType: string;
  stationKey: string;
  title: string;
  subtitle: string;
  objective: string;
  replayable: boolean;
};
