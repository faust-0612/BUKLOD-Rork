export const KINGDOM_OFFLINE_MAX_LEVEL: number;
export type KingdomOfflinePracticeQuestion = {
  prompt: string;
  choices: string[];
  answer_index: number;
  explanation: string;
  mode: 'compass' | 'pattern' | 'supplies';
  visualTokens: string[];
  encounterTitle?: string;
};
export function buildKingdomOfflineLevel(
  gameId: string, level: number, userId: string,
): KingdomOfflinePracticeQuestion[];
