import type { ArcadeMode } from './arcadeCore';

export type ArcadeSpec = {
  id: string;
  character: string;
  title: string;
  descriptionEn: string;
  descriptionTl: string;
  instructionEn: string;
  instructionTl: string;
  mode: ArcadeMode;
  icon: string;
  hero: string;
  good: readonly string[];
  bad: readonly string[];
  accent: string;
};

type ShortSpec = [string, string, ArcadeMode, string, string, string, string, string, string, string];
const ADD: Readonly<Record<string, readonly ShortSpec[]>> = {
  angel: [
    ['treasure-rush','Treasure Rush','catch','💎','👸','🪙|💎|👑','💣|☠️','Catch the gems. Avoid the bombs!','Saluhin ang mga hiyas. Iwasan ang bomba!','#efcb69'],
    ['vault-escape','Vault Escape','lane','🔓','👸','🔑|💰|⭐','🔥|💣','Change lanes to escape the traps.','Lumipat ng lane para makaiwas sa bitag.','#dba75e'],
  ],
  jawo: [
    ['forest-runner','Forest Runner','runner','🌲','🏃','🌟|🍃|🍎','🪵|🔥','Dodge logs, jump and collect trail lights.','Iwasan ang kahoy, tumalon at mangolekta ng ilaw.','#70cb7a'],
    ['animal-rescue','Animal Rescue','catch','🐾','🦸','🐰|🦊|🐣','🔥|⚠️','Rescue animals and avoid hazards.','Sagipin ang mga hayop at iwasan ang panganib.','#84e1aa'],
  ],
  mitch: [
    ['color-splash','Color Splash','tap','🎨','🧑‍🎨','🎨|🖌️|🌈','💥|🖤','Tap the glowing paint spot before it moves.','I-tap ang pintura bago lumipat ang target.','#ff9cad'],
    ['fashion-studio','Fashion Studio','stack','👗','🧑‍🎨','👒|👗|👠','✖️|💥','Drop each fashion layer on the target.','Ipatong ang damit sa tamang puwesto.','#e7a3ed'],
  ],
  niel: [
    ['adventure-dash','Adventure Dash','runner','🧭','🏃','💧|🗺️|⭐','🪨|⚡','Sprint, jump and gather supplies.','Tumakbo, tumalon at mangolekta ng supplies.','#f2bc74'],
    ['delivery-rush','Delivery Rush','catch','📦','🚴','📦|✉️|🍎','💣|⚠️','Collect the deliveries without hazards.','Kunin ang deliveries, iwasan ang sagabal.','#eac07e'],
  ],
  vhen: [
    ['harvest-frenzy','Harvest Frenzy','catch','🌽','👩‍🌾','🌽|🥕|🍓','🪲|🧨','Catch crops, not the pests!','Saluhin ang ani, huwag ang peste!','#a6dc69'],
    ['farm-adventure','Farm Adventure','lane','🚜','👩‍🌾','🌱|🥬|🍅','🪨|🔥','Steer between crops and farm obstacles.','Lumipat sa taniman at umiwas sa harang.','#9fd489'],
  ],
  ellusur: [
    ['tower-builder','Tower Builder','stack','🏗️','👷','🏠|🧱|🏰','💥|✖️','Drop each block above the marked foundation.','Ipatong ang bawat bloke sa pundasyon.','#7bdabb'],
    ['village-repair','Village Repair','tap','🔨','👷','🔧|🪚|🧱','🔥|💥','Tap the repair spots before they fade.','Ayusin ang kumikislap na sirang bahagi.','#a2e8ce'],
  ],
  ace: [
    ['rescue-run','Rescue Run','runner','🚑','🦸','🧰|❤️|⭐','🔥|🪨','Run and jump to rescue your team.','Tumakbo at tumalon para sumagip.','#a0cfff'],
    ['fortress-defender','Fortress Defender','defend','🏰','🛡️','⚔️|🛡️|🏹','👾|💀','Tap the lane where enemies approach.','I-tap ang lane ng kalabang paparating.','#b9c4f6'],
  ],
  phan: [
    ['market-rush','Market Rush','catch','🛒','🧑‍💼','🍎|💰|📦','💣|🪨','Collect customer orders, avoid damaged goods.','Kunin ang orders, iwasan ang sirang paninda.','#eab57b'],
    ['shop-tycoon','Shop Tycoon','tap','🏪','🧑‍💼','💰|🛍️|⭐','❌|🔥','Serve customers by tapping highlighted orders.','I-tap agad ang lumilitaw na customer orders.','#ffcb87'],
  ],
  quin: [
    ['treasure-hunt','Treasure Hunt','search','🔍','🧑‍🚀','💎|🗝️|⭐','❌|💣','Remember the glowing treasure position.','Tandaan ang puwesto ng kumikislap na yaman.','#8dd8ff'],
    ['space-glider','Space Glider','lane','🚀','🛸','✨|🪐|⭐','☄️|💥','Glide between asteroids and collect stars.','Umiwas sa asteroid at mangolekta ng bituin.','#83b7fc'],
  ],
  van: [
    ['traffic-rush','Traffic Rush','lane','🚦','🚗','⛽|⭐|🪙','🚧|🚙','Change lanes to dodge traffic.','Lumipat ng lane para umiwas sa trapiko.','#75e0dd'],
    ['city-driver','City Driver','runner','🚘','🚕','📦|⭐|⛽','🚧|💥','Drive, change lanes and jump over hazards.','Magmaneho, lumipat ng lane at umiwas sa sagabal.','#6dc7bd'],
  ],
  christian: [
    ['shield-defender','Shield Defender','defend','🛡️','🛡️','✨|💫|🌟','👾|🔥','Protect the village. Tap incoming threats.','Ipagtanggol ang nayon. I-tap ang panganib.','#f1d47b'],
    ['light-adventure','Light Adventure','search','🕯️','🧑‍🦱','✨|🌟|💫','❌|🌑','Follow the light hidden in the glowing tiles.','Tandaan kung saang tile lumitaw ang ilaw.','#ffdf8e'],
  ],
  lhen: [
    ['beat-master','Beat Master','rhythm','🎵','🎤','🎶|🎼|🥁','❌|💢','Tap each lane when the music note nears the line.','I-tap ang lane kapag nasa linya na ang nota.','#f0a7df'],
    ['stage-performer','Stage Performer','rhythm','🎸','🎸','🎶|🎹|🎺','❌|💢','Build a combo by hitting the glowing notes.','Bumuo ng combo sa tamang timing ng nota.','#d19ef6'],
  ],
  trudice: [
    ['balloon-pop','Balloon Pop','tap','🎈','🧸','🎈|🎉|⭐','💥|❌','Pop the highlighted balloon quickly!','Paputukin agad ang lumilitaw na lobo!','#ffaada'],
    ['playground-dash','Playground Dash','runner','🛝','🏃','⭐|🍭|🧸','🪨|🔥','Run, jump and collect playground stars.','Tumakbo, tumalon at kumuha ng bituin.','#ffb8c9'],
  ],
};

export const KINGDOM_ARCADE_GAMES: readonly ArcadeSpec[] = Object.entries(ADD).flatMap(
  ([character, games]) => games.map(([suffix, title, mode, icon, hero, good, bad, instructionEn, instructionTl, accent]) => ({
    id: character + '-' + suffix,
    character,
    title,
    descriptionEn: instructionEn,
    descriptionTl: instructionTl,
    instructionEn,
    instructionTl,
    mode,
    icon,
    hero,
    good: good.split('|'),
    bad: bad.split('|'),
    accent,
  })),
);

export const KINGDOM_ARCADE_IDS = new Set(KINGDOM_ARCADE_GAMES.map(game => game.id));

export function arcadeGamesForCharacter(name: string): readonly ArcadeSpec[] {
  const key = name.toLowerCase() === 'elesur' ? 'ellusur' : name.toLowerCase();
  return KINGDOM_ARCADE_GAMES.filter(game => game.character === key);
}
