export const LIFE_GOSPEL_CORE_VERSION = 'LIFE_GOSPEL_CORE_2026_09_V1';
export const LIFE_SOUL_WINNER_GUIDE_VERSION =
  'LIFE_SOUL_WINNER_GUIDE_2026_09_V1';
export const LIFE_BRIDGES_VERSION = 'LIFE_BRIDGES_2026_09_V1';
export const LIFE_SCRIPTURE_PACK_VERSION =
  'LIFE_SCRIPTURE_PACK_2026_09_V1';

export type LifeTopic = {
  id: string;
  title: string;
  intro: string;
  practical: string;
  bridge: string;
};

export type LifeQuestion = {
  id: string;
  question: string;
  answer: string;
};

export type LifeGospelStep = {
  key: 'GOD' | 'OUR_PROBLEM' | 'JESUS_CHRIST' | 'GRACE' | 'RESPONSE' | 'NEW_LIFE';
  title: string;
  body: string;
  scriptureRefs: string[];
};

export type LifeScripture = {
  reference: string;
  version: 'KJV';
  text: string;
  topic: string;
  contentVersion: string;
};

export const LIFE_PRIMARY_TOPICS: LifeTopic[] = [
  {
    id: 'hope',
    title: 'Hope',
    intro:
      'When life feels heavy, you do not need to solve everything at once. Start with the next honest, healthy step you can take today.',
    practical:
      'Name what you can control, ask for help where you need it, and give yourself permission to move one step at a time.',
    bridge:
      'Christians believe hope is more than optimism. It is rooted in a Person. Would you like to see why Jesus matters here?',
  },
  {
    id: 'peace',
    title: 'Peace',
    intro:
      'A crowded mind can make every problem feel urgent. Slow the moment down before you decide what the moment means.',
    practical:
      'Breathe, separate facts from fears, and focus on the next wise action rather than every possible outcome.',
    bridge:
      'Christian faith speaks about a peace that is deeper than having no problems. If you want, we can explore where that peace comes from.',
  },
  {
    id: 'purpose',
    title: 'Purpose',
    intro:
      'Feeling unsure about your direction does not mean your life has no value. Purpose is often discovered through truth, responsibility, love, and faithful next steps.',
    practical:
      'Ask what is worth serving, what needs your care, and what kind of person you are becoming while you pursue your goals.',
    bridge:
      'Christians believe human life has meaning because we were made by God and invited to know Him. You can explore that claim without pressure.',
  },
  {
    id: 'forgiveness',
    title: 'Forgiveness',
    intro:
      'Forgiveness does not call wrong things right. It faces what happened honestly while refusing to let the wrong have the final word.',
    practical:
      'Where safe, name the wrong clearly, seek repair, set needed boundaries, and do not confuse forgiveness with staying in danger.',
    bridge:
      'The Christian message says our need for forgiveness also reaches deeper than what other people have done to us. It speaks about our relationship with God.',
  },
  {
    id: 'strength',
    title: 'Strength',
    intro:
      'Strength is not pretending you are fine. Sometimes strength looks like asking for help, resting, telling the truth, or doing the next difficult right thing.',
    practical:
      'Choose one stabilizing action now: contact someone trustworthy, finish one necessary task, rest, eat, hydrate, or step away from a harmful situation.',
    bridge:
      'Christians do not believe they must carry life alone. If you want, you can explore what dependence on Christ means.',
  },
  {
    id: 'new-start',
    title: 'A New Start',
    intro:
      'Your past matters, but it does not have to own every chapter that follows. A new start begins with truth, responsibility, and a real change of direction.',
    practical:
      'Repair what you can, accept what you cannot undo, and choose the next action that is consistent with the person you want to become.',
    bridge:
      'The Christian Gospel offers more than self-improvement. It speaks about grace, forgiveness, and new life in Jesus Christ.',
  },
];

export const LIFE_ADDITIONAL_TOPICS: LifeTopic[] = [
  {
    id: 'lost',
    title: 'I feel lost',
    intro:
      'Not knowing your next direction can feel frightening, but confusion is a condition you can move through, not an identity.',
    practical:
      'Reduce the horizon. What is the next responsible decision, conversation, or task directly in front of you?',
    bridge:
      'Christians believe direction begins with knowing the One who gives life meaning. You can explore that perspective if you want.',
  },
  {
    id: 'worried',
    title: "I'm worried",
    intro:
      'Worry can make possibilities feel like certainties. Bring the problem back to what is actually known right now.',
    practical:
      'List what needs action today, what can wait, and what is outside your control. Reach out when the burden is too heavy to carry alone.',
    bridge:
      'Christian faith does not promise a problem-free life, but it does offer a way to trust God in the middle of uncertainty.',
  },
  {
    id: 'alone',
    title: 'I feel alone',
    intro:
      'Loneliness can distort how visible and valuable you feel. Isolation is painful, and reaching toward safe connection matters.',
    practical:
      'Contact one trustworthy person, community, family member, counselor, or support resource instead of carrying the whole weight silently.',
    bridge:
      'Christians believe God is not distant from human pain and that Jesus came near to people others overlooked.',
  },
  {
    id: 'failed',
    title: 'I failed',
    intro:
      'Failure can make you feel as if your worst moment defines you. It does not have to.',
    practical:
      'Learn what happened, repair what you can, own your part without turning a failure into your identity, and begin again.',
    bridge:
      'There is also a deeper kind of hope Christians find in Jesus. Would you like to see why?',
  },
  {
    id: 'guilty',
    title: 'I feel guilty',
    intro:
      'Guilt can be painful because sometimes we know something really is wrong - not just around us, but inside us too.',
    practical:
      'Be honest about what happened. Where possible, confess the wrong, make repair, accept appropriate consequences, and choose a different direction.',
    bridge:
      'The Christian message begins with an uncomfortable truth: all of us fall short. But it does not end there.',
  },
  {
    id: 'angry',
    title: "I'm angry",
    intro:
      'Anger can point to hurt, injustice, fear, or violated boundaries. It can also push us toward actions we later regret.',
    practical:
      'Create enough space to choose your response. Do not make a high-impact decision while you are escalating.',
    bridge:
      'Christian teaching takes both justice and the condition of the human heart seriously. Jesus speaks to both.',
  },
  {
    id: 'future',
    title: "I'm afraid of the future",
    intro:
      'The future contains uncertainty, but uncertainty is not the same thing as disaster.',
    practical:
      'Prepare for what is reasonable, do what is yours to do today, and avoid treating every feared possibility as a prediction.',
    bridge:
      'Christian hope looks beyond control of circumstances and toward trust in God through Jesus Christ.',
  },
  {
    id: 'family',
    title: "I'm struggling with family",
    intro:
      'Family problems can be especially painful because love, history, expectations, and responsibility are all involved at once.',
    practical:
      'Aim for truth with respect, healthy boundaries, patient conversation where safe, and outside support when the situation is too complex to handle alone.',
    bridge:
      'Christian faith does not erase difficult relationships, but it gives a framework for truth, grace, forgiveness, wisdom, and boundaries.',
  },
  {
    id: 'no-purpose',
    title: "I don't know my purpose",
    intro:
      'You do not have to discover one dramatic life assignment before your life can matter.',
    practical:
      'Start with what is true and good now: whom can you love, what responsibility can you carry, and what gift can you develop faithfully?',
    bridge:
      'Christians believe our deepest purpose begins with knowing God, not merely achieving a role. If you want, we can explore why.',
  },
  {
    id: 'death',
    title: "I'm afraid of death",
    intro:
      'Fear of death can surface questions about meaning, loss, guilt, relationships, and what comes after this life.',
    practical:
      'You do not have to hide the question. Talk with someone trustworthy, make needed practical preparations, and explore your beliefs honestly.',
    bridge:
      'The Christian Gospel makes a direct claim about death, resurrection, forgiveness, and eternal life through Jesus Christ.',
  },
  {
    id: 'fresh-start',
    title: 'I want a fresh start',
    intro:
      'Wanting to begin again can be the start of real change when it includes honesty about what needs to change.',
    practical:
      'Choose one concrete repair, one habit to stop feeding, and one healthy action to begin.',
    bridge:
      'Christianity describes new life as more than a reset of habits. It begins with reconciliation to God through Christ.',
  },
  {
    id: 'encouragement',
    title: 'I just need encouragement',
    intro:
      'A hard day can shrink your view of what is still possible. You are allowed to take the next step without having the whole path figured out.',
    practical:
      'Rest where needed, ask for support, remember what is still true, and do one useful thing that moves you toward stability.',
    bridge:
      'If you want spiritual encouragement too, LIFE can show why Christians place their hope in Jesus.',
  },
];

export const LIFE_QUESTIONS: LifeQuestion[] = [
  {
    id: 'god-exists',
    question: 'Does God really exist?',
    answer:
      'Christianity says God is not merely an idea for comfort but the Creator who has made Himself known in creation, history, Scripture, and ultimately in Jesus Christ. LIFE will not force that conclusion on you; it invites you to examine the Christian claim honestly.',
  },
  {
    id: 'suffering',
    question: 'Why does God allow suffering?',
    answer:
      'Christians do not have to pretend suffering is small. The Bible presents a world damaged by sin and death, people who genuinely hurt, and a God who enters human suffering in Jesus. Christianity promises final justice and restoration, while also calling people to compassion and faithful action now.',
  },
  {
    id: 'why-jesus',
    question: 'Why Jesus?',
    answer:
      'The Christian Gospel centers on Jesus because it says our deepest problem cannot be solved by self-improvement alone. Jesus came, died for sins, and rose again so that sinners can be reconciled to God by grace.',
  },
  {
    id: 'forgive-me',
    question: 'Can God forgive me?',
    answer:
      'The Christian answer is yes: forgiveness is offered through Jesus Christ, not because your wrong is unimportant, but because Christ has dealt with sin at the cross. The invitation includes repentance - turning toward God rather than excusing what is wrong.',
  },
  {
    id: 'after-death',
    question: 'What happens after death?',
    answer:
      'Christianity teaches that death is not the end, that people are accountable to God, and that eternal life is offered through Jesus Christ. The resurrection of Jesus is central to that hope.',
  },
  {
    id: 'good-enough',
    question: "Why isn't being good enough enough?",
    answer:
      'Good works matter, but Christianity says they cannot erase guilt or make us perfectly righteous before God. Salvation is presented as grace - a gift received through faith - rather than a score we earn.',
  },
  {
    id: 'sin',
    question: 'What is sin?',
    answer:
      'In Christian teaching, sin is more than isolated mistakes. It includes rejecting God, falling short of His character and commands, and the broken desires and actions that flow from that separation.',
  },
  {
    id: 'saved',
    question: 'What does it mean to be saved?',
    answer:
      'To be saved means being rescued from sin and its final consequence, forgiven and reconciled to God through Jesus Christ, and brought into new life with Him. An app button cannot declare that spiritual reality for you.',
  },
  {
    id: 'begin-again',
    question: 'Can I really begin again?',
    answer:
      'Christianity says real change is possible because grace is not limited to people with a clean past. New life in Christ includes forgiveness, a changed direction, and a growing life of following Him.',
  },
  {
    id: 'resurrection',
    question: 'Why do Christians believe Jesus rose from the dead?',
    answer:
      'The resurrection is not a side detail of Christianity; it is one of its central historical claims. Christians point to the earliest apostolic testimony, the empty-tomb tradition, and the transformation of Jesus followers as part of the case they believe must be examined.',
  },
];

export const LIFE_GOSPEL_STEPS: LifeGospelStep[] = [
  {
    key: 'GOD',
    title: 'God',
    body:
      'You were made with meaning. God created you and desires you to know Him.',
    scriptureRefs: ['John 3:16'],
  },
  {
    key: 'OUR_PROBLEM',
    title: 'Our problem',
    body:
      'Sin separates us from God. All people fall short. We cannot make ourselves right with God merely through good works, religion, status, or self-improvement.',
    scriptureRefs: ['Romans 3:23'],
  },
  {
    key: 'JESUS_CHRIST',
    title: 'Jesus Christ',
    body:
      'Jesus Christ came into the world, died for our sins, and rose again. Salvation is made possible through Him.',
    scriptureRefs: ['Romans 5:8', 'John 14:6'],
  },
  {
    key: 'GRACE',
    title: 'Grace',
    body:
      "Salvation is God's gift. It cannot be earned.",
    scriptureRefs: ['Ephesians 2:8-9'],
  },
  {
    key: 'RESPONSE',
    title: 'Response',
    body:
      'The Gospel invites you to repent and place faith in Jesus Christ, trusting Him as Lord and Savior.',
    scriptureRefs: ['Romans 10:9'],
  },
  {
    key: 'NEW_LIFE',
    title: 'New life',
    body:
      'Following Christ is not merely joining a religion. It is the beginning of a new life of knowing and following Him.',
    scriptureRefs: [],
  },
];

export const LIFE_SCRIPTURE_PACK: LifeScripture[] = [
  {
    reference: 'Romans 3:23',
    version: 'KJV',
    text: 'For all have sinned, and come short of the glory of God;',
    topic: 'sin',
    contentVersion: LIFE_SCRIPTURE_PACK_VERSION,
  },
  {
    reference: 'Romans 5:8',
    version: 'KJV',
    text: 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.',
    topic: 'cross',
    contentVersion: LIFE_SCRIPTURE_PACK_VERSION,
  },
  {
    reference: 'John 3:16',
    version: 'KJV',
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
    topic: 'love',
    contentVersion: LIFE_SCRIPTURE_PACK_VERSION,
  },
  {
    reference: 'Ephesians 2:8-9',
    version: 'KJV',
    text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast.',
    topic: 'grace',
    contentVersion: LIFE_SCRIPTURE_PACK_VERSION,
  },
  {
    reference: 'Romans 10:9',
    version: 'KJV',
    text: 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.',
    topic: 'response',
    contentVersion: LIFE_SCRIPTURE_PACK_VERSION,
  },
  {
    reference: 'John 14:6',
    version: 'KJV',
    text: 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.',
    topic: 'jesus',
    contentVersion: LIFE_SCRIPTURE_PACK_VERSION,
  },
];

export const LIFE_SOUL_WINNER_ISSUES = [
  'Fear',
  'Guilt',
  'Purpose',
  'Family',
  'Death',
  'Loneliness',
  'Failure',
  'Faith Question',
  'Other',
] as const;

export const LIFE_SOUL_WINNER_GUIDE = [
  {
    title: '1. Listen',
    body: 'What is this person carrying? Listen before trying to answer.',
  },
  {
    title: '2. Understand',
    body:
      'Clarify what they actually mean. Do not assume a spiritual diagnosis from a single sentence.',
  },
  {
    title: '3. Bridge',
    body:
      'Ask permission: "Would it be okay if I share something that helped me understand this differently?"',
  },
  {
    title: '4. Gospel',
    body:
      'Share the Gospel clearly and briefly. Keep Jesus, grace, repentance, and faith central.',
  },
  {
    title: '5. Questions',
    body:
      'Ask, do not interrogate: "What is your understanding of Jesus?" or "If you could ask God one question, what would it be?"',
  },
  {
    title: '6. Response',
    body:
      'Respect their response: Interested, Has Questions, Not Ready, Wants Prayer, or Professes Faith. Do not turn a response into a public score.',
  },
  {
    title: '7. Follow-up',
    body:
      'Offer Bible reading, prayer, another conversation, or a trusted Christian / mentor / church connection only where they want it.',
  },
];

export const LIFE_SAMPLE_PRAYER =
  'God, I know I have sinned and cannot save myself. I believe Jesus Christ died for my sins and rose again. I turn to You and place my trust in Jesus as Lord and Savior. Please forgive me and lead me in new life. Amen.';

export const LIFE_RESPONSE_EXPLANATION =
  'A prayer does not save you. Jesus saves. Prayer can be a way to express your repentance and faith to Him.';

export const LIFE_NEXT_STEPS = [
  'Start reading about Jesus',
  'Read a beginner Bible plan',
  'Learn how to pray',
  'Talk to a trusted Christian',
  'Connect with a church or Christian mentor where available',
  'Continue exploring questions',
] as const;

export const LIFE_CRISIS_COPY = {
  title: 'Your immediate safety comes first',
  body:
    'If you may hurt yourself or someone else, are in immediate danger, or are facing abuse or a medical emergency, contact your local emergency service now or go to the nearest emergency department. If you are in the Philippines, you can call 911. If possible, stay with a trusted person and move away from anything you could use to harm yourself or someone else.',
  note:
    'Spiritual support can accompany professional and emergency help. It does not replace it.',
};

export function findLifeTopic(id: string) {
  return [...LIFE_PRIMARY_TOPICS, ...LIFE_ADDITIONAL_TOPICS].find(
    item => item.id === id,
  );
}

export function findLifeQuestion(id: string) {
  return LIFE_QUESTIONS.find(item => item.id === id);
}

export function scriptureForReferences(references: string[]) {
  const wanted = new Set(references);
  return LIFE_SCRIPTURE_PACK.filter(item => wanted.has(item.reference));
}
