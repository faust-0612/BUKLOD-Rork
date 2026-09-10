/* BUKLOD_CHARACTER_R37B_SPECIAL_SERIES1_REGISTRY
 * Additive metadata only. Core Characters remain authoritative.
 * Special Character ownership/unlock is NOT client-trusted and is not implemented here.
 */

export type BuklodSpecialCharacterId =
  | 'jawo'
  | 'trudice'
  | 'ace'
  | 'mitch'
  | 'niel'
  | 'angel'
  | 'vhen'
  | 'ellusur';

export type BuklodSpecialCharacterProfile = {
  id: BuklodSpecialCharacterId;
  name: string;
  body: 'male' | 'female';
  role: string;
  profession: string;
  personality: string;
  series: 'SERIES_1';
  stages: readonly string[];
  unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS';
  defaultFragmentsRequired: 5;
};

const JAWO_STAGES = [
  'Young Dreamer',
  'Nature Lover',
  'Student Musician',
  'Campus Volunteer',
  'Youth Encourager',
  'Choir Member',
  'Guitar Learner',
  'Worship Music Helper',
  'Community Singer',
  'Music Team Member',
  'Youth Mentor',
  'Worship Leader',
  'Creative Ministry Worker',
  'Forest Advocate',
  'Community Organizer',
  'Music Trainer',
  'Mission Volunteer',
  'Discipleship Worker',
  'Church Planting Partner',
  'Purposeful Leader',
] as const;

const TRUDICE_STAGES = [
  'Little Learner',
  'Story Listener',
  'Sunday School Helper',
  'Young Teacher',
  'Children’s Guide',
  'Classroom Assistant',
  'Student Mentor',
  'Learning Facilitator',
  'Sunday School Teacher',
  'Classroom Teacher',
  'Creative Educator',
  'Values Mentor',
  'Children’s Ministry Teacher',
  'Learning Coordinator',
  'Teacher-Leader',
  'Curriculum Builder',
  'Mentor of Teachers',
  'Education Ministry Leader',
  'Community Educator',
  'Legacy Teacher',
] as const;

const ACE_STAGES = [
  'Curious Learner',
  'Caring Student',
  'Chess Beginner',
  'School Helper',
  'Youth Encourager',
  'Nursing Student',
  'Chess Competitor',
  'Community Helper',
  'Campus Leader',
  'Junior Nurse',
  'Board Passer',
  'Staff Nurse',
  'Wellness Advocate',
  'Chess Mentor',
  'Community Health Leader',
  'Mission Nurse',
  'Strategic Mentor',
  'Healing Servant Leader',
  'Regional Health Mentor',
  'Legacy Care Champion',
] as const;

const MITCH_STAGES = [
  'Little Dreamer',
  'Young Creator',
  'Art Helper',
  'Story Drawer',
  'Classroom Assistant',
  'Student Teacher',
  'Creative Mentor',
  'Community Artist',
  'Arts Teacher',
  'Tribal Educator',
  'Culture Advocate',
  'Creative Leader',
  'Workshop Facilitator',
  'Arts Ministry Worker',
  'Community Inspiration Builder',
  'Education & Arts Coordinator',
  'Missionary-Educator',
  'Regional Creative Trainer',
  'Heritage Advocate',
  'Legacy Art Mentor',
] as const;

const NIEL_STAGES = [
  'Young Singer',
  'Faith Listener',
  'Youth Helper',
  'Small Group Member',
  'Worship Volunteer',
  'Bible Learner',
  'Student Mentor',
  'Young Teacher',
  'Worship Leader',
  'Youth Pastor',
  'Discipleship Leader',
  'Mission Volunteer',
  'Outreach Trainer',
  'Church Planting Apprentice',
  'Community Shepherd',
  'Ministry Coordinator',
  'Discipleship Pastor',
  'Church Planting Leader',
  'Regional Mission Mentor',
  'Legacy Disciple-Maker',
] as const;

const ANGEL_STAGES = [
  'Little Helper',
  'Savings Learner',
  'Student Organizer',
  'Class Treasurer',
  'Young Steward',
  'Record Keeper',
  'Budget Assistant',
  'Community Volunteer',
  'Stewardship Worker',
  'Finance Coordinator',
  'Ministry Treasurer',
  'Resource Planner',
  'Budget Manager',
  'Community Treasurer',
  'Financial Trainer',
  'Stewardship Leader',
  'Development Coordinator',
  'Resource Director',
  'Community Finance Head',
  'Legacy Steward',
] as const;

const VHEN_STAGES = [
  'Farm Helper',
  'Garden Learner',
  'Student Worker',
  'Youth Volunteer',
  'Field Assistant',
  'Crop Care Worker',
  'Community Helper',
  'Agriculture Learner',
  'Farm Technician',
  'Harvest Organizer',
  'Agribusiness Starter',
  'Small Business Owner',
  'Community Grower',
  'Agriculture Specialist',
  'Family Provider',
  'Farm Entrepreneur',
  'Community Business Leader',
  'Resource Steward',
  'Agriculture Mentor',
  'Legacy Builder',
] as const;

const ELLUSUR_STAGES = [
  'Little Learner',
  'Church Boy',
  'Student Helper',
  'Youth Volunteer',
  'Bible Learner',
  'Classroom Assistant',
  'Farm Helper',
  'Community Volunteer',
  'Sunday Helper',
  'Teacher-in-Service',
  'Ministry Worker',
  'Field Mentor',
  'Faith Leader',
  'Community Teacher',
  'Pastor',
  'Agricultural Advocate',
  'Volunteer Coordinator',
  'Mission Pastor',
  'Community Builder',
  'Legacy Shepherd',
] as const;

export const BUKLOD_SPECIAL_SERIES_1: Record<
  BuklodSpecialCharacterId,
  BuklodSpecialCharacterProfile
> = {
  jawo: {
    id: 'jawo',
    name: 'Jawo',
    body: 'male',
    role: 'Music Enthusiast',
    profession: 'Forester',
    personality: 'Warm, relaxed, nature-loving.',
    series: 'SERIES_1',
    stages: JAWO_STAGES,
    unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS',
    defaultFragmentsRequired: 5,
  },
  trudice: {
    id: 'trudice',
    name: 'Trudice',
    body: 'female',
    role: 'Sunday School Teacher',
    profession: 'Teacher',
    personality: 'Gentle, patient, teacher-like.',
    series: 'SERIES_1',
    stages: TRUDICE_STAGES,
    unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS',
    defaultFragmentsRequired: 5,
  },
  ace: {
    id: 'ace',
    name: 'Ace',
    body: 'male',
    role: 'Chess Master',
    profession: 'Nurse',
    personality: 'Calm, precise, strategic.',
    series: 'SERIES_1',
    stages: ACE_STAGES,
    unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS',
    defaultFragmentsRequired: 5,
  },
  mitch: {
    id: 'mitch',
    name: 'Mitch',
    body: 'female',
    role: 'Arts Guide',
    profession: 'Teacher · Tribal/Cultural Context',
    personality: 'Creative, expressive, warm.',
    series: 'SERIES_1',
    stages: MITCH_STAGES,
    unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS',
    defaultFragmentsRequired: 5,
  },
  niel: {
    id: 'niel',
    name: 'Niel',
    body: 'male',
    role: 'Youth Pastor · Discipleship Guide',
    profession: 'Pastor · Teacher',
    personality: 'Pastoral, musical, mission-minded.',
    series: 'SERIES_1',
    stages: NIEL_STAGES,
    unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS',
    defaultFragmentsRequired: 5,
  },
  angel: {
    id: 'angel',
    name: 'Angel',
    body: 'female',
    role: 'Treasurer · Budget Manager',
    profession: 'Financial Steward',
    personality: 'Organized, practical, soft-spoken.',
    series: 'SERIES_1',
    stages: ANGEL_STAGES,
    unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS',
    defaultFragmentsRequired: 5,
  },
  vhen: {
    id: 'vhen',
    name: 'Vhen',
    body: 'male',
    role: 'Agriculture Expert · Businessman',
    profession: 'Community Helper',
    personality: 'Friendly, practical, family-oriented.',
    series: 'SERIES_1',
    stages: VHEN_STAGES,
    unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS',
    defaultFragmentsRequired: 5,
  },
  ellusur: {
    id: 'ellusur',
    name: 'Ellusur',
    body: 'male',
    role: 'Pastor · Teacher',
    profession: 'Farming Advocate · Volunteer',
    personality: 'Steady, hardworking, service-oriented.',
    series: 'SERIES_1',
    stages: ELLUSUR_STAGES,
    unlockModel: 'PARTICIPATION_JOURNEY_FRAGMENTS',
    defaultFragmentsRequired: 5,
  },
};

export const BUKLOD_SPECIAL_SERIES_1_ORDER: readonly BuklodSpecialCharacterId[] = [
  'jawo',
  'trudice',
  'ace',
  'mitch',
  'niel',
  'angel',
  'vhen',
  'ellusur',
];
