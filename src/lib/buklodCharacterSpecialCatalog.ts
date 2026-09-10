import type { BuklodSpecialCharacterId } from '@/lib/buklodCharacterSelectionV2';

export type BuklodSpecialCatalogEntry = {
  id: BuklodSpecialCharacterId;
  displayName: string;
  unlockRank: number;
  themeTitle: string;
  motto: string;
  description: string;
  focusTags: string[];
  world: string;
  miniGame: string;
  levels: string[];
  collectibles: string[];
  badges: string[];
};

function twenty(prefixes: string[]) {
  return Array.from({ length: 20 }, (_, index) => prefixes[index] ?? `Mastery Stage ${index + 1}`);
}

export const BUKLOD_SPECIAL_CATALOG: Record<BuklodSpecialCharacterId, BuklodSpecialCatalogEntry> = {
  ace: {
    id:'ace', displayName:'Ace', unlockRank:5, themeTitle:'HEALTH STRATEGY SERVICE', motto:'Small steps of care create a stronger community.',
    description:'Health-minded strategist focused on practical service, wise decisions, discipline, and community care.',
    focusTags:['Health Advocacy','Community Service','Strategy & Planning','Practical Discipleship'], world:'Community Clinic & Service District', miniGame:'Care Strategy Rush',
    levels:twenty(['Curious Learner','Care Observer','Healthy Habit Builder','Service Helper','Care Planner','First Aid Thinker','Wellness Guide','Community Scout','Strategy Keeper','Care Coordinator','Health Advocate','Service Tactician','Prevention Mentor','Team Care Lead','Community Planner','Wellness Strategist','Care Mission Lead','Health Systems Builder','Service Master','Community Care Champion']),
    collectibles:['Care Notebook','Health Pin','Clean Water Kit','First Aid Pouch','Strategy Board','Wellness Bottle','Service Gloves','Community Map','Care Compass','Health Lantern','Prevention Shield','Service Crest'],
    badges:['Healthy Habits','Careful Strategist','Community Helper','Prevention Leader','Health Mission Master'],
  },
  ellusur: {
    id:'ellusur', displayName:'Elesur', unlockRank:6, themeTitle:'WISDOM FORMATION LEADERSHIP', motto:'Strong thinking builds steady leadership.',
    description:'Pastoral and teaching character built around wisdom, discernment, formation, reliability, and patient leadership.',
    focusTags:['Wisdom','Leadership','Formation','Discernment'], world:'Highland Academy & Council Hall', miniGame:'Wisdom Path',
    levels:twenty(['Little Learner','Listening Student','Word Explorer','Thoughtful Helper','Wise Reader','Lesson Builder','Discernment Scout','Counsel Apprentice','Formation Guide','Steady Teacher','Wisdom Keeper','Mentoring Hand','Leadership Builder','Council Guide','Faithful Adviser','Formation Leader','Wise Shepherd','Community Mentor','Council Master','Wisdom Champion']),
    collectibles:['Study Bible','Teacher Chalk','Wisdom Lamp','Council Scroll','Seed Pouch','Farm Journal','Mentor Staff','Lesson Bell','Discernment Lens','Leadership Seal','Formation Book','Harvest Crown'],
    badges:['Faithful Learner','Wise Teacher','Discernment Guide','Formation Leader','Wisdom Master'],
  },
  jawo: {
    id:'jawo', displayName:'Jawo', unlockRank:7, themeTitle:'YOUTH MISSION PATHFINDER', motto:'Courage grows when you keep moving.',
    description:'Energetic mission pathfinder combining music, youth encouragement, nature, movement, and courageous service.',
    focusTags:['Youth Encouragement','Mission Movement','Field Service','Growth Challenge'], world:'Forest Pathfinder World', miniGame:'Forest Rhythm Run',
    levels:twenty(['Young Dreamer','Trail Listener','Rhythm Walker','Forest Helper','Path Scout','Song Carrier','Mission Hiker','Youth Guide','Trail Builder','Pathfinder','Courage Keeper','Field Musician','Mission Runner','Growth Guide','Forest Leader','Youth Pathfinder','Mission Captain','Trail Master','Field Champion','Pathfinder Legend']),
    collectibles:['Trail Guitar','Forest Compass','Mission Bandana','Seed Badge','Pathfinder Boots','Songbook','Camp Lantern','Trail Map','Youth Whistle','Mission Pack','Forest Crest','Pathfinder Crown'],
    badges:['Trail Starter','Youth Encourager','Mission Mover','Forest Pathfinder','Courage Champion'],
  },
  mitch: {
    id:'mitch', displayName:'Mitch', unlockRank:8, themeTitle:'CREATIVE CLASSROOM COMMUNICATION', motto:'Teach clearly. Create boldly. Inspire joy.',
    description:'Creative teaching and communication character focused on arts, learning, cultural expression, and joyful instruction.',
    focusTags:['Creativity','Communication','Classroom Presence','Friendly Leadership'], world:'Creative Campus & Arts Village', miniGame:'Creative Classroom Dash',
    levels:twenty(['Little Dreamer','Color Explorer','Friendly Learner','Sketch Helper','Creative Starter','Story Builder','Classroom Artist','Culture Explorer','Lesson Designer','Creative Teacher','Communication Guide','Arts Mentor','Classroom Leader','Culture Keeper','Creative Coach','Learning Director','Arts Builder','Teaching Master','Culture Champion','Creative Legend']),
    collectibles:['Sketchbook','Color Brush','Teacher Bell','Story Cards','Culture Cloth','Art Kit','Lesson Board','Creative Pen','Classroom Badge','Mentor Easel','Arts Crest','Teacher Crown'],
    badges:['Creative Spark','Clear Communicator','Classroom Guide','Arts Mentor','Creative Master'],
  },
  niel: {
    id:'niel', displayName:'Niel', unlockRank:9, themeTitle:'OUTREACH ACTION RESPONSE', motto:'Real care moves first.',
    description:'Youth pastor and church-planting character centered on outreach, dependable action, discipleship, and response.',
    focusTags:['Outreach','Response','Compassion in Action','Team Service'], world:'Community Action Hub', miniGame:'Outreach Response Run',
    levels:twenty(['Young Singer','Friendly Helper','Outreach Listener','Action Starter','Response Scout','Team Servant','Youth Guide','Mission Caller','Outreach Builder','Action Leader','Compassion Guide','Response Captain','Discipleship Mentor','Church Plant Helper','Mission Coordinator','Outreach Pastor','Action Director','Community Builder','Mission Master','Outreach Champion']),
    collectibles:['Guitar Pick','Outreach Card','Mission Bag','Response Radio','Team Band','Bible Marker','Community Map','Service Shirt','Youth Badge','Planting Kit','Mission Crest','Outreach Crown'],
    badges:['Quick Helper','Outreach Starter','Youth Guide','Mission Builder','Action Champion'],
  },
  angel: {
    id:'angel', displayName:'Angel', unlockRank:10, themeTitle:'JOYFUL CARE & WORSHIP SUPPORT', motto:'Serve with grace. Lift with joy.',
    description:'Graceful support and stewardship character focused on care, worship support, generosity, planning, and relational encouragement.',
    focusTags:['Care','Joy','Worship Support','Relational Encouragement'], world:'Light Garden & Care Sanctuary', miniGame:'Joyful Steward',
    levels:twenty(['Little Helper','Joy Giver','Care Listener','Grace Starter','Support Friend','Worship Helper','Budget Learner','Generosity Guide','Care Organizer','Joy Leader','Stewardship Guide','Support Mentor','Worship Coordinator','Care Planner','Generosity Leader','Grace Builder','Community Steward','Support Master','Joy Champion','Graceful Steward']),
    collectibles:['Joy Ribbon','Care Note','Worship Pin','Budget Ledger','Giving Jar','Support Bell','Grace Flower','Stewardship Key','Care Lantern','Generosity Crest','Worship Crown','Joy Star'],
    badges:['Joyful Helper','Care Supporter','Wise Steward','Grace Leader','Generosity Champion'],
  },
  vhen: {
    id:'vhen', displayName:'Vhen', unlockRank:11, themeTitle:'AGRICULTURE COURAGE ENTERPRISE', motto:'Stand firm. Build well. Finish strong.',
    description:'Agriculture and enterprise character combining discipline, resilience, business thinking, farming, and community help.',
    focusTags:['Agriculture','Discipline','Enterprise','Community Help'], world:'Farm Forge & Training Grounds', miniGame:'Harvest Forge',
    levels:twenty(['Farm Helper','Seed Learner','Field Walker','Work Starter','Crop Scout','Discipline Builder','Market Learner','Farm Planner','Harvest Guide','Field Leader','Enterprise Starter','Community Farmer','Business Builder','Training Guide','Harvest Captain','Farm Strategist','Enterprise Leader','Community Builder','Field Master','Harvest Champion']),
    collectibles:['Seed Bag','Farm Hat','Water Can','Field Boots','Market Ledger','Harvest Knife','Crop Map','Business Coin','Training Rope','Farm Crest','Enterprise Badge','Harvest Crown'],
    badges:['Seed Starter','Disciplined Worker','Farm Planner','Enterprise Leader','Harvest Champion'],
  },
  trudice: {
    id:'trudice', displayName:'Trudice', unlockRank:13, themeTitle:'CHILDLIKE WONDER & NURTURE', motto:'Joy teaches gently, and growth follows.',
    description:'Sunday-school and teaching character focused on childlike wonder, nurture, encouragement, gentle formation, and joyful learning.',
    focusTags:['Childlike Wonder','Nurture','Encouragement','Gentle Formation'], world:'Playground Learning World', miniGame:'Wonder Playground',
    levels:twenty(['Little Learner','Happy Listener','Story Friend','Kind Helper','Playful Student','Bible Explorer','Classroom Friend','Joy Guide','Nurture Helper','Gentle Teacher','Wonder Keeper','Story Mentor','Learning Guide','Children’s Leader','Nurture Coach','Joyful Teacher','Formation Guide','Learning Master','Wonder Champion','Nurture Legend']),
    collectibles:['Story Bible','Crayon Box','Teacher Star','Playground Ball','Kindness Card','Learning Blocks','Story Bell','Joy Ribbon','Classroom Crown','Wonder Book','Nurture Crest','Teacher Lantern'],
    badges:['Happy Learner','Kind Helper','Joyful Teacher','Nurture Guide','Wonder Champion'],
  },
};
