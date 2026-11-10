export const KINGDOM_OFFLINE_MAX_LEVEL: 5000;
export type KingdomOfflinePracticeQuestion = {
  prompt: string;
  choices: string[];
  answer_index: number;
  explanation: string;
};
export function buildKingdomOfflineLevel(
  gameId: string, level: number, userId: string,
): KingdomOfflinePracticeQuestion[];
