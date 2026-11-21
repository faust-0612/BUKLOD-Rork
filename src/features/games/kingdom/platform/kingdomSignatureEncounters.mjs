/** 39 different, account-local Kingdom signature missions. No external service or reward authority. */
const MISSIONS = Object.freeze({
  "phan-enterprise-builder": {
    "title": "HARBOR WORKSHOP",
    "icons": [
      "⚓",
      "🛠️",
      "🏗️"
    ],
    "prompt": "A harbor crew installs {a} posts on each of {b} piers, then adds {c} reserve posts. How many posts now?",
    "operation": "muladd"
  },
  "phan-trade-master": {
    "title": "TRADE ROUTE",
    "icons": [
      "⚖️",
      "📦",
      "🛶"
    ],
    "prompt": "The trader begins with {a} crates, acquires {b} more, and delivers {c}. How many crates remain?",
    "operation": "addsub"
  },
  "phan-market-match": {
    "title": "MARKET ORDERS",
    "icons": [
      "🧺",
      "🥭",
      "🧑‍🍳"
    ],
    "prompt": "There are {a} customers ordering {c} goods each. {b} goods are already packed. How many still need packing?",
    "operation": "mulsubacb"
  },
  "quin-discovery-expedition": {
    "title": "RUINS EXPEDITION",
    "icons": [
      "🧭",
      "🏛️",
      "🌿"
    ],
    "prompt": "The expedition walks {a} paces north and {b} paces east, then climbs {c} more. How many paces traveled?",
    "operation": "sum"
  },
  "quin-guessing-quest": {
    "title": "EVIDENCE LAB",
    "icons": [
      "🔎",
      "🌡️",
      "🧪"
    ],
    "prompt": "Out of {a} evidence samples, {b} are duplicates and {c} are damaged. How many usable samples remain?",
    "operation": "minusboth"
  },
  "quin-code-breaker": {
    "title": "CIPHER CHAMBER",
    "icons": [
      "🔐",
      "🗝️",
      "🪨"
    ],
    "prompt": "The cipher dial starts at {a}, advances {b} symbols, then advances {c} more. What symbol index is shown?",
    "operation": "sum"
  },
  "van-living-city-dispatch": {
    "title": "CITY DISPATCH",
    "icons": [
      "🚦",
      "🚌",
      "🏙️"
    ],
    "prompt": "City transport has {a} passengers waiting. Two buses bring {b} more each. What is the new passenger count?",
    "operation": "addtwob"
  },
  "van-sudoku-master": {
    "title": "SUDOKU TOWER",
    "icons": [
      "🔢",
      "🏢",
      "✏️"
    ],
    "prompt": "A number-tower row totals {a}. Two visible cells contain {b} and {c}. What must the missing cell contain?",
    "operation": "minusboth"
  },
  "van-mind-challenge": {
    "title": "MIND MACHINE",
    "icons": [
      "🧩",
      "⚙️",
      "💡"
    ],
    "prompt": "A machine doubles {a} gears then attaches {b} small gears. How many gears are on the assembly?",
    "operation": "doubleadd"
  },
  "christian-civic-leadership": {
    "title": "CIVIC COUNCIL",
    "icons": [
      "🏛️",
      "🤝",
      "📜"
    ],
    "prompt": "The council has {a} delegates, gains {b} volunteers and sends {c} to outreach. How many remain?",
    "operation": "addsub"
  },
  "christian-bible-crown": {
    "title": "CROWN CHALLENGE",
    "icons": [
      "👑",
      "📖",
      "✨"
    ],
    "prompt": "There are {a} study groups learning {b} verses each. {c} verses have already been reviewed. How many reviews remain?",
    "operation": "mulsub"
  },
  "christian-scripture-word-search": {
    "title": "SCRIPTURE ARCHIVE",
    "icons": [
      "📜",
      "🔤",
      "🗝️"
    ],
    "prompt": "The archive contains {a} lines of {b} symbols each. {c} symbols are hidden. How many are readable?",
    "operation": "mulsub"
  },
  "lhen-rhythm-journey": {
    "title": "RHYTHM PATH",
    "icons": [
      "🎼",
      "🥁",
      "🎶"
    ],
    "prompt": "A performance has {b} bars of {c} beats, plus an {a}-beat introduction. How many total beats?",
    "operation": "bcadda"
  },
  "lhen-melody-memory": {
    "title": "MELODY RECALL",
    "icons": [
      "🎵",
      "🎹",
      "🔁"
    ],
    "prompt": "The song starts with {a} notes, then repeats a {b}-note refrain {c} times. How many notes are played?",
    "operation": "bcadda"
  },
  "lhen-beat-composer": {
    "title": "DRUM STUDIO",
    "icons": [
      "🥁",
      "🎛️",
      "🔊"
    ],
    "prompt": "A composer builds {a} loops of {b} beats, then adds {c} accents. How many musical events?",
    "operation": "muladd"
  },
  "jawo-forest-trail": {
    "title": "FOREST RUN",
    "icons": [
      "🌲",
      "🏃",
      "🌊"
    ],
    "prompt": "The scout runs {a} steps along the trail, {b} around a waterfall and {c} over a hill. How many steps?",
    "operation": "sum"
  },
  "jawo-trail-maze": {
    "title": "LABYRINTH ROUTE",
    "icons": [
      "🗺️",
      "🧱",
      "🧭"
    ],
    "prompt": "The maze path has {a} turns, {b} detours and {c} shortcuts. How many path sections remain?",
    "operation": "addsub"
  },
  "jawo-nature-match": {
    "title": "HABITAT RESTORE",
    "icons": [
      "🍄",
      "🦋",
      "🌿"
    ],
    "prompt": "The habitat gains {a} flowers, {b} butterflies and {c} mushrooms. How many living nature markers?",
    "operation": "sum"
  },
  "trudice-playground-memory": {
    "title": "WONDER RECALL",
    "icons": [
      "🪁",
      "🧸",
      "⭐"
    ],
    "prompt": "The child remembers {a} toys, discovers {b} new toys, and forgets {c}. How many remembered?",
    "operation": "addsub"
  },
  "trudice-picture-pairs": {
    "title": "PICTURE PAIRS",
    "icons": [
      "🖼️",
      "🧩",
      "🧸"
    ],
    "prompt": "A memory table holds {a} picture cards and {b} new pairs. How many cards are displayed?",
    "operation": "addtwob"
  },
  "trudice-word-garden": {
    "title": "WORD GARDEN",
    "icons": [
      "🌱",
      "🔤",
      "🌼"
    ],
    "prompt": "The word garden begins with {a} letters; {b} seed letters and {c} blossom letters appear. How many letters?",
    "operation": "sum"
  },
  "ace-rescue-grid": {
    "title": "RESCUE DISPATCH",
    "icons": [
      "🚑",
      "🧰",
      "❄️"
    ],
    "prompt": "A team carries {a} medical kits, uses {b} kits in rescue and receives {c} more. Kits remaining?",
    "operation": "addsubac"
  },
  "ace-chess-master": {
    "title": "ROYAL CHESS",
    "icons": [
      "♞",
      "♟️",
      "🏰"
    ],
    "prompt": "On the strategy table are {a} pieces. {b} are captured and {c} new training pieces arrive. How many?",
    "operation": "addsubac"
  },
  "ace-tower-tactics": {
    "title": "WINTER TOWERS",
    "icons": [
      "🏰",
      "🏹",
      "❄️"
    ],
    "prompt": "There are {a} towers with {b} arrows each, plus {c} spare arrows. How many arrows?",
    "operation": "muladd"
  },
  "mitch-restore-mural": {
    "title": "MURAL RESTORATION",
    "icons": [
      "🎨",
      "🧱",
      "🖌️"
    ],
    "prompt": "An artist completes {a} mural tiles, repairs {b} more and loses {c} to weather. Finished tiles?",
    "operation": "addsub"
  },
  "mitch-block-forge": {
    "title": "ARTISAN FORGE",
    "icons": [
      "🔨",
      "🧱",
      "🔥"
    ],
    "prompt": "The craftsperson forges {a} structures using {b} blocks each, and keeps {c} spare blocks. Total?",
    "operation": "muladd"
  },
  "mitch-color-merge": {
    "title": "COLOR ALCHEMY",
    "icons": [
      "🟦",
      "🟥",
      "🟨"
    ],
    "prompt": "The paint tray contains {a} blue drops, {b} red drops and {c} yellow drops. Total drops?",
    "operation": "sum"
  },
  "niel-mission-trail": {
    "title": "MOUNTAIN MISSION",
    "icons": [
      "⛺",
      "🏔️",
      "🎒"
    ],
    "prompt": "The ranger has {a} food pouches, consumes {b}, then forages {c} more. Pouches remaining?",
    "operation": "addsubac"
  },
  "niel-expedition-puzzle": {
    "title": "SKY STEPS",
    "icons": [
      "🪨",
      "🌉",
      "🧭"
    ],
    "prompt": "The expedition finds {a} stepping stones, lays {b} more and removes {c} unstable ones. Safe stones?",
    "operation": "addsub"
  },
  "niel-word-explorer": {
    "title": "FRONTIER WORDS",
    "icons": [
      "📜",
      "🗺️",
      "🔤"
    ],
    "prompt": "There are {a} mapped words and {b} new clue groups with {c} words in each. How many words?",
    "operation": "bcadda"
  },
  "angel-kingdom-treasury": {
    "title": "TREASURY AUDIT",
    "icons": [
      "🏛️",
      "🪙",
      "🔐"
    ],
    "prompt": "The vault starts with {a} coins, receives {b} deposits and spends {c} on repairs. Coins remaining?",
    "operation": "addsub"
  },
  "angel-number-vault": {
    "title": "NUMBER LOCK",
    "icons": [
      "🔢",
      "⚙️",
      "🔒"
    ],
    "prompt": "The lock shows {a} rings of {b} digits each and {c} extra code symbols. How many symbols?",
    "operation": "muladd"
  },
  "angel-treasure-merge": {
    "title": "GEM REFINERY",
    "icons": [
      "💎",
      "🪙",
      "👑"
    ],
    "prompt": "The chest has {a} gems, gains {b} pairs of gems and {c} special stones. Total treasures?",
    "operation": "addtwobc"
  },
  "vhen-farm-to-market": {
    "title": "COASTAL FARM",
    "icons": [
      "🌾",
      "🛶",
      "🥕"
    ],
    "prompt": "Farmers harvest {a} crates, receive {b} more and discard {c} spoiled crates. Market crates?",
    "operation": "addsub"
  },
  "vhen-harvest-match": {
    "title": "TROPICAL ORCHARD",
    "icons": [
      "🥭",
      "🍌",
      "🍍"
    ],
    "prompt": "The orchard gathers {a} mangoes, {b} bananas and {c} pineapples. How many fruits?",
    "operation": "sum"
  },
  "vhen-farm-merge": {
    "title": "HARVEST PROGRESSION",
    "icons": [
      "🌱",
      "🌽",
      "🚜"
    ],
    "prompt": "There are {a} crop rows each yielding {b} baskets, plus {c} from a new field. Total baskets?",
    "operation": "muladd"
  },
  "elesur-village-builder": {
    "title": "VILLAGE WORKSITE",
    "icons": [
      "🏠",
      "🪵",
      "🛠️"
    ],
    "prompt": "Builders collect {a} timber pieces, {b} donated bricks and {c} metal fasteners. Total materials?",
    "operation": "sum"
  },
  "elesur-domino-village": {
    "title": "DOMINO STREET",
    "icons": [
      "🁣",
      "🏘️",
      "🛤️"
    ],
    "prompt": "A village domino street has {a} linked tiles, {b} extensions and {c} broken tiles removed. Usable tiles?",
    "operation": "addsub"
  },
  "elesur-bridge-puzzle": {
    "title": "BRIDGE ENGINEERING",
    "icons": [
      "🌉",
      "🪵",
      "⛓️"
    ],
    "prompt": "Bridge workers lay {a} planks and add {b} pairs of supports, then remove {c} broken parts. Safe pieces?",
    "operation": "addtwobsub"
  }
});

const OPERATIONS = Object.freeze({
 sum: (a,b,c) => a+b+c,
 addsub: (a,b,c) => a+b-c,
 addsubac: (a,b,c) => a-b+c,
 minusboth: (a,b,c) => a-b-c,
 muladd: (a,b,c) => a*b+c,
 mulsub: (a,b,c) => a*b-c,
 mulsubacb: (a,b,c) => a*c-b,
 bcadda: (a,b,c) => a+b*c,
 doubleadd: (a,b,c) => 2*a+b,
 addtwob: (a,b,c) => a+2*b,
 addtwobc: (a,b,c) => a+2*b+c,
 addtwobsub: (a,b,c) => a+2*b-c,
});
export const KINGDOM_SIGNATURE_GAME_IDS = Object.freeze(Object.keys(MISSIONS));
/**
 * Each canonical mini-game has a distinct procedural narrative and art cue.
 * These are OPTIONAL local-only signature challenges, not a server receipt,
 * Character item, BP event, Diamond grant, or world construction credit.
 */
export function buildKingdomSignatureMission(gameId,a,b,c){
 const profile=MISSIONS[gameId];
 if(!profile||![a,b,c].every(n=>Number.isSafeInteger(n)&&n>=0))return null;
 const operation=OPERATIONS[profile.operation];
 if(!operation)return null;
 const answer=operation(a,b,c);
 if(!Number.isSafeInteger(answer)||answer<0)return null;
 const values={a,b,c};
 return {
  encounterTitle:profile.title,
  prompt:profile.prompt.replace(/\{([abc])\}/g,(_whole,name)=>String(values[name])),
  answer,
  visualTokens:[...profile.icons],
 };
}
