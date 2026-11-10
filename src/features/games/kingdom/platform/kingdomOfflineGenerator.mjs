/**
 * Deterministic, offline and intentionally non-credit practice generator.
 * Runs in Expo native, web and Node without a runtime service or new native API.
 */
export const KINGDOM_OFFLINE_MAX_LEVEL = 5000;
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
      !Number.isInteger(level) || level < 1 || level > KINGDOM_OFFLINE_MAX_LEVEL) return [];
  const domain = THEMES[gameId.split('-')[0]] ?? 'kingdom challenges';
  const seed = hash(userId + ':' + gameId + ':' + level);
  const a = 7 + (seed % 11) + Math.min(110,Math.floor(level / 35));
  const b = 3 + ((seed >>> 5) % 8);
  const c = 2 + ((seed >>> 11) % 5);
  const types = [
    [`In ${domain}, ${a} items arrive in the morning and ${b} more arrive later. How many are available?`,a+b],
    [`A ${domain} project needs ${a*3} units. After completing ${b} units, how many remain?`,a*3-b],
    [`A plan needs ${a} work units for each of ${b} tasks. How many units total?`,a*b],
    [`The ${domain} team completes ${a} steps, rests, then completes ${b+c} more. How many steps overall?`,a+b+c],
    [`A route near ${domain} goes ${a+c+b} spaces east, then ${b} west. How far east is the destination?`,a+c],
    [`For ${domain}, ${a+b} supplies are shared among two equal groups. After removing ${(a+b)%2} surplus item(s), how many does each group receive?`,Math.floor((a+b)/2)],
    [`A worker finishes ${a} units on each of three days but loses ${b} units to waste. How many remain usable?`,a*3-b],
    [`A sequence for ${domain} starts at ${a}, then increases by ${c} each step. What is its fifth number?`,a+4*c],
    [`A team has ${a*4} points of energy and spends ${b+c} on one task. How much remains?`,a*4-b-c],
    [`The ${domain} journey needs ${a} minutes each way and ${c+b} minutes at the destination. Total minutes?`,2*a+b+c],
    [`Five volunteers each prepare ${b+c} resources for ${domain}. How many resources are prepared?`,5*(b+c)],
    [`There are ${a} rows of ${b} ${domain} markers, and ${c} extras. How many markers in all?`,a*b+c],
    [`For ${domain}, a scout counts ${a} items, then ${b} and ${c} more. Total?`,a+b+c],
    [`A ${domain} planner combines ${a*b} units with ${c*b} new units. How many?`,a*b+c*b],
    [`Three ${domain} teams each collect ${a+c} units. How many together?`,3*(a+c)],
    [`In ${domain}, a total of ${a*5} is divided among five partners. Each receives?`,a],
    [`A ${domain} route runs ${a+c} steps north and ${c} south. Net north distance?`,a],
    [`A ${domain} market trades ${a+b} supplies and sends ${b} away. How many remain?`,a],
    [`If a ${domain} challenge earns ${b} stars per round for ${c+2} rounds, total stars?`,b*(c+2)],
    [`The ${domain} track has ${a*b} points and gains ${b*b} more. Final score?`,a*b+b*b],
    [`A ${domain} puzzle starts at ${a}, then adds ${b} twice. Final number?`,a+2*b],
    [`In ${domain}, ${c} groups each have ${a} and ${b} resources. All resources?`,c*(a+b)],
    [`The ${domain} reserve needs ${a*4+b} units, with ${a} held back. Remaining requirement?`,3*a+b],
    [`For ${domain}, a sequence begins at ${b} and doubles twice. Final value?`,4*b],
    [`A ${domain} camp prepares ${a*2} portions and adds ${c*2} portions. Total portions?`,2*(a+c)],
    [`A ${domain} bridge has ${a+c+b} planks. After replacing ${c} and removing ${b}, how many remain?`,a],
    [`The ${domain} leader assigns ${b+c} tasks to each of ${a} workers. Total tasks?`,a*(b+c)],
    [`A ${domain} journey has three sections: ${a} km, ${b} km and ${c} km. Total km?`,a+b+c],
    [`A ${domain} camp has ${a*b} supplies. Each of ${b} teams uses one supply. Supplies left?`,b*(a-1)],
    [`In ${domain}, ${a+c} coins are exchanged at ${b} points each. Total points?`,(a+c)*b],
    [`A ${domain} blueprint needs twice ${a+b} units. How many units?`,2*(a+b)],
    [`A ${domain} count grows from ${a} by ${c} over ${b} rounds. Final count?`,a+b*c],
  ];
  const rotation=(level + (seed % types.length)) % types.length;
  // Three distinct templates per level, widely separated across the pool.
  const stride=Math.max(3,Math.floor(types.length/3));
  return Array.from({length:3},(_,index)=>{
    const [prompt,answer]=types[(rotation+index*stride)%types.length];
    return makeQuestion(`Level ${level}, challenge ${index+1}: ${prompt}`,answer,
      level,(seed >>> (index*7)) & 7);
  });
}
