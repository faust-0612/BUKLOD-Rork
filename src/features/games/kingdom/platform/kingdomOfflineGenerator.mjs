/**
 * Deterministic, offline and intentionally non-credit practice generator.
 * Runs in Expo native, web and Node without a runtime service or new native API.
 */
const THEMES = {
  phan: 'market stalls', quin: 'exploration routes', van: 'city districts',
  christian: 'community service teams', lhen: 'music rehearsals',
  jawo: 'forest trails', trudice: 'playground puzzles', ace: 'strategy pieces',
  mitch: 'mural tiles', niel: 'expedition checkpoints',
  angel: 'treasury supplies', vhen: 'farm harvests', elesur: 'village pathways',
};
function hash(text) {
  let result = 2166136261;
  for (let i = 0; i < text.length; i++) {
    result ^= text.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
function makeQuestion(prompt, correct, level, choiceSeed) {
  const value = Math.max(0, correct);
  const candidates = [value, value + 2 + level % 3,
    Math.max(0,value - (3 + level % 2)), value + 7 + level % 4];
  const distinct = [...new Set(candidates)];
  let offset = 9;
  while (distinct.length < 4) distinct.push(value + offset++);
  const shift = choiceSeed % 4;
  const choices = [...distinct.slice(shift),...distinct.slice(0,shift)].map(String);
  return {
    prompt, choices, answer_index:choices.indexOf(String(value)),
    explanation: 'Solution: ' + value + '. Review the quantities and operations in the problem.',
  };
}
/**
 * @param {string} gameId
 * @param {number} level
 * @param {string} userId
 * @returns {{prompt:string,choices:string[],answer_index:number,explanation:string}[]}
 */
export function buildKingdomOfflineLevel(gameId,level,userId) {
  if (!userId || !/^[a-z][a-z0-9-]{2,99}$/.test(gameId) ||
      !Number.isInteger(level) || level < 1 || level > 200) return [];
  const domain = THEMES[gameId.split('-')[0]] ?? 'kingdom challenges';
  const seed = hash(userId + ':' + gameId + ':' + level);
  const a = 7 + (seed % 11) + Math.min(15,Math.floor(level / 10));
  const b = 3 + ((seed >>> 5) % 8);
  const c = 2 + ((seed >>> 11) % 5);
  const types = [
    [`In ${domain}, ${a} items arrive in the morning and ${b} more arrive later. How many are available?`,a+b],
    [`A ${domain} project needs ${a*3} units. After completing ${b} units, how many remain?`,a*3-b],
    [`A plan needs ${a} work units for each of ${b} tasks. How many units total?`,a*b],
    [`The ${domain} team completes ${a} steps, rests, then completes ${b+c} more. How many steps overall?`,a+b+c],
    [`A route near ${domain} goes ${a+c} spaces east, then ${b} west. How far east is the destination?`,a+c-b],
    [`For ${domain}, ${a+b} supplies are shared among two equal groups. After removing ${(a+b)%2} surplus item(s), how many does each group receive?`,Math.floor((a+b)/2)],
    [`A worker finishes ${a} units on each of three days but loses ${b} units to waste. How many remain usable?`,a*3-b],
    [`A sequence for ${domain} starts at ${a}, then increases by ${c} each step. What is its fifth number?`,a+4*c],
    [`A team has ${a*4} points of energy and spends ${b+c} on one task. How much remains?`,a*4-b-c],
    [`The ${domain} journey needs ${a} minutes each way and ${c+b} minutes at the destination. Total minutes?`,2*a+b+c],
    [`Five volunteers each prepare ${b+c} resources for ${domain}. How many resources are prepared?`,5*(b+c)],
    [`There are ${a} rows of ${b} ${domain} markers, and ${c} extras. How many markers in all?`,a*b+c],
  ];
  const rotation=level%types.length;
  return Array.from({length:3},(_,index)=>{
    const [prompt,answer]=types[(rotation+index*4)%types.length];
    return makeQuestion(`Level ${level}, challenge ${index+1}: ${prompt}`,answer,
      level,(seed >>> (index*7)) & 7);
  });
}
