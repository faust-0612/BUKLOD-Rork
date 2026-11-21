export const KINGDOM_SIGNATURE_GAME_IDS: readonly string[];
export type KingdomSignatureMission = { encounterTitle:string; prompt:string; answer:number; visualTokens:string[] };
export function buildKingdomSignatureMission(gameId:string,a:number,b:number,c:number):KingdomSignatureMission|null;
