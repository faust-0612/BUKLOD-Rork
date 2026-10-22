export type BuklodPublicLanguage =
  | 'fil'
  | 'ceb'
  | 'ilo'
  | 'en';

export type DailyBannerContent = {
  text: string;
  reference?: string;
};

export type MotivationalLesson = {
  title: string;
  insight: string;
  lesson: string;
  action: string;
  reflection: string;
};

function norm(
  value: unknown,
) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function detectBuklodPublicLanguage(
  preferredLanguage: unknown,
  country: unknown,
  province: unknown,
): BuklodPublicLanguage {

  const preferred =
    norm(preferredLanguage);

  if (
    preferred.includes('cebu') ||
    preferred.includes('bisaya') ||
    preferred === 'ceb'
  ) {
    return 'ceb';
  }

  if (
    preferred.includes('iloc') ||
    preferred.includes('ilok') ||
    preferred === 'ilo'
  ) {
    return 'ilo';
  }

  if (
    preferred.includes('tagalog') ||
    preferred.includes('filipino') ||
    preferred === 'fil' ||
    preferred === 'tl'
  ) {
    return 'fil';
  }

  if (
    preferred.includes('english') ||
    preferred === 'en'
  ) {
    return 'en';
  }

  const c =
    norm(country);

  const p =
    norm(province);

  if (
    c &&
    c !== 'ph' &&
    !c.includes('philipp')
  ) {
    return 'en';
  }

  if (
    [
      'cebu',
      'bohol',
      'siquijor',
    ].some(
      item =>
        p.includes(item),
    )
  ) {
    return 'ceb';
  }

  if (
    [
      'ilocos norte',
      'ilocos sur',
      'la union',
      'abra',
    ].some(
      item =>
        p.includes(item),
    )
  ) {
    return 'ilo';
  }

  return 'fil';
}

function localDateKey() {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      '0',
    );

  const day =
    String(
      now.getDate(),
    ).padStart(
      2,
      '0',
    );

  return (
    `${year}-${month}-${day}`
  );
}

function makeSeed(
  source: string,
) {

  let hash =
    2166136261;

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    hash ^=
      source.charCodeAt(index);

    hash =
      Math.imul(
        hash,
        16777619,
      );
  }

  return (
    hash >>> 0
  );
}

function seedFor(
  userId: string,
  language: BuklodPublicLanguage,
  type: string,
) {
  return makeSeed(
    [
      localDateKey(),
      userId,
      language,
      type,
    ].join('|'),
  );
}


const VERSES:
Record<
  BuklodPublicLanguage,
  DailyBannerContent[]
> = {

  fil: [
    {
      text:
        'Sa gitna ng pagod, may panibagong lakas para sa taong patuloy na nagtitiwala.',
      reference:
        'Isaias 40:31',
    },
    {
      text:
        'Ibigay sa Diyos ang iyong mga alalahanin at magpatuloy nang may pag-asa.',
      reference:
        '1 Pedro 5:7',
    },
    {
      text:
        'Hindi kailangang manaig ang takot; may lakas at tulong para sa iyong paglalakbay.',
      reference:
        'Isaias 41:10',
    },
    {
      text:
        'Ang biyaya ng Diyos ay sapat kahit sa mga panahong nararamdaman mong mahina ka.',
      reference:
        '2 Corinto 12:9',
    },
    {
      text:
        'May tamang panahon para sa bawat yugto ng buhay.',
      reference:
        'Eclesiastes 3:1',
    },
  ],

  ceb: [
    {
      text:
        'Adunay bag-ong kusog alang sa tawo nga nagpadayon uban sa paglaum.',
      reference:
        'Isaias 40:31',
    },
    {
      text:
        'Itugyan sa Dios ang imong mga kabalaka ug padayon sa imong panaw.',
      reference:
        '1 Pedro 5:7',
    },
    {
      text:
        'Ayaw tugoti nga ang kahadlok maoy magbuot sa imong sunod nga lakang.',
      reference:
        'Isaias 41:10',
    },
    {
      text:
        'Ang grasya sa Dios igo bisan sa panahon sa kaluya.',
      reference:
        '2 Corinto 12:9',
    },
  ],

  ilo: [
    {
      text:
        'Adda baro a pigsa para iti tao nga agtultuloy nga addaan namnama.',
      reference:
        'Isaias 40:31',
    },
    {
      text:
        'Italekmo iti Dios dagiti pakaseknam ken agtultuloyka.',
      reference:
        '1 Pedro 5:7',
    },
    {
      text:
        'Saanmo nga ipalubos nga ti buteng ti mangituray iti sumaruno nga addangmo.',
      reference:
        'Isaias 41:10',
    },
    {
      text:
        'Ti parabur ti Dios ket umdas uray iti tiempo ti kinakapuy.',
      reference:
        '2 Corinto 12:9',
    },
  ],

  en: [
    {
      text:
        'New strength can come even in seasons when the journey feels difficult.',
      reference:
        'Isaiah 40:31',
    },
    {
      text:
        'Entrust your worries to God and continue moving forward with hope.',
      reference:
        '1 Peter 5:7',
    },
    {
      text:
        'Do not allow fear to decide your next step.',
      reference:
        'Isaiah 41:10',
    },
    {
      text:
        'Grace remains sufficient even in moments of weakness.',
      reference:
        '2 Corinthians 12:9',
    },
  ],
};


const ENCOURAGEMENT:
Record<
  BuklodPublicLanguage,
  string[]
> = {

  fil: [
    'Hindi kailangang matapos ang lahat ngayon. Ang isang magandang hakbang ay progreso na.',
    'May mga araw na mabagal ang progreso, pero progreso pa rin iyon.',
    'Hindi mo kailangang maging perpekto para magkaroon ng makabuluhang araw.',
    'Kapag mabigat ang araw, ituon muna ang lakas sa susunod na kaya mong gawin.',
    'Ang maliit na pagbabago na inuulit araw-araw ay maaaring maging malaking resulta.',
    'May halaga ang pahinga, pagkatuto, at muling pagsisimula.',
    'Hindi nasusukat ang progreso sa bilis lamang. Mahalaga rin ang direksiyon.',
  ],

  ceb: [
    'Dili kinahanglan mahuman ang tanan karon. Usa ka maayong lakang progreso na.',
    'Usahay hinay ang progreso, apan progreso gihapon kana.',
    'Dili kinahanglan mahimong perpekto aron mahimong makahuluganon ang imong adlaw.',
    'Kung bug-at ang adlaw, hunahunaa una ang sunod nga lakang nga imong makaya.',
    'Ang gamay nga kausaban nga balik-balikon mahimong dako nga resulta.',
  ],

  ilo: [
    'Saan a kasapulan a malpas amin ita nga aldaw. Maysa a nasayaat nga addang ket progreso.',
    'Adda aldaw a nabannayat ti progreso, ngem progreso latta.',
    'Saanmo a kasapulan ti agbalin a perpekto tapno adda kaipapanan ti aldawmo.',
    'No narigat ti aldaw, ipamaysam iti sumaruno nga kabaelam nga aramiden.',
    'Ti bassit a panagbalbaliw a maulit-ulit ket mabalin nga agbalin a dakkel a resulta.',
  ],

  en: [
    'You do not have to finish everything today. One good step is still progress.',
    'Some days move slowly. Slow progress is still progress.',
    'You do not need a perfect day to make today meaningful.',
    'When the day feels heavy, focus on the next manageable step.',
    'Small improvements repeated consistently can eventually create major results.',
    'Rest, learning, and beginning again are all part of progress.',
  ],
};


export function getDailyBannerContent(
  userId: string,
  language: BuklodPublicLanguage,
  showFaithContent: boolean,
): DailyBannerContent {

  if (showFaithContent) {

    const pool =
      VERSES[language];

    const seed =
      seedFor(
        userId,
        language,
        'faith-banner',
      );

    return pool[
      seed %
      pool.length
    ];
  }

  const pool =
    ENCOURAGEMENT[
      language
    ];

  const seed =
    seedFor(
      userId,
      language,
      'encouragement-banner',
    );

  return {
    text:
      pool[
        seed %
        pool.length
      ],
  };
}


const LESSON_DATA = {

  fil: {
    titles: [
      'Ang Lakas ng Isang Maliit na Hakbang',
      'Hindi Kailangang Sabay-sabay',
      'Progress Over Perfection',
      'Magsimula Muli',
      'Piliin ang Susunod na Hakbang',
      'Consistency Matters',
    ],

    insights: [
      'Kapag malaki ang problema, madalas tayong napaparalisa dahil gusto nating ayusin agad ang lahat.',
      'Ang mabagal na progreso ay madaling maliitin, pero ang maliliit na hakbang ang kadalasang bumubuo ng tunay na pagbabago.',
      'Hindi lahat ng araw ay magiging produktibo. May mga araw na ang pinakamahalagang nagawa mo ay ang hindi pagsuko.',
      'Mas madaling magpatuloy kapag ang attention mo ay nasa bagay na kaya mong kontrolin ngayon.',
      'Ang pahinga ay hindi awtomatikong pag-atras. Maaari itong maging bahagi ng mas maayos na pagpapatuloy.',
    ],

    lessons: [
      'Hindi kailangang malaki ang isang hakbang para maging mahalaga. Ang mahalaga ay may direksiyon.',
      'Ang consistency ay mas sustainable kaysa sa panandaliang sobrang effort.',
      'Ang pagkakamali ay impormasyon. Maaari mong gamitin ito para gumawa ng mas magandang susunod na desisyon.',
      'Hindi mo kailangang hintayin ang perfect motivation bago kumilos.',
      'Ang isang mahirap na araw ay hindi summary ng buong buhay mo.',
    ],

    actions: [
      'Pumili ng isang gawain na matatapos mo sa loob ng 10 minuto at gawin muna iyon.',
      'Isulat ang tatlong bagay na kaya mong kontrolin ngayon. Pumili ng isa.',
      'Ayusin ang isang maliit na bagay na matagal mo nang ipinagpapaliban.',
      'Maglaan ng ilang minuto para magpahinga, pagkatapos ay bumalik sa isang malinaw na priority.',
      'Bago matapos ang araw, kilalanin ang isang maliit na progress na nagawa mo.',
    ],

    reflections: [
      'Ano ang isang maliit ngunit makabuluhang hakbang na kaya mong gawin ngayon?',
      'Ano ang maaari mong bawasan para maging mas manageable ang araw mo?',
      'Anong pagkakamali ang maaari mong gawing lesson sa halip na dahilan para sumuko?',
      'Ano ang isang bagay na ginagawa mong mabuti kahit hindi ito palaging napapansin?',
    ],
  },


  ceb: {
    titles: [
      'Usa Ka Gamay nga Lakang',
      'Padayon Lang',
      'Progress, Dili Perfection',
      'Sugdi Pag-usab',
    ],

    insights: [
      'Kung dako kaayo ang problema, usahay lisod magsugod tungod kay gusto nato masulbad dayon ang tanan.',
      'Ang hinay nga progreso dali ra usahay mabalewala, apan importante gihapon kini.',
      'Dili tanan nga adlaw mahimong produktibo. Ang importante mao ang pagpadayon.',
      'Mas sayon mopadayon kung imong tutokan ang butang nga imong makontrol karon.',
    ],

    lessons: [
      'Dili kinahanglan dako ang lakang aron mahimong importante.',
      'Ang consistency mas lig-on kaysa kusog nga paningkamot nga dili mapadayon.',
      'Ang sayop mahimong gamiton isip impormasyon alang sa mas maayong sunod nga desisyon.',
      'Dili kinahanglan hulaton ang perfect motivation aron magsugod.',
    ],

    actions: [
      'Pilia ang usa ka buluhaton nga mahimo sulod sa 10 minutos.',
      'Isulat ang tulo ka butang nga imong makontrol karon ug pilia ang usa.',
      'Human ug pahulay, balik sa usa ka klaro nga priority.',
      'Ilhon ang usa ka gamay nga progreso nga imong nahimo karong adlawa.',
    ],

    reflections: [
      'Unsa ang usa ka gamay apan importante nga lakang nga mahimo nimo karon?',
      'Unsa ang mahimo nimong pasimplehon karong adlawa?',
      'Unsang kasaypanan ang mahimo nimong himuong leksyon?',
    ],
  },


  ilo: {
    titles: [
      'Maysa a Bassit nga Addang',
      'Agtultuloy',
      'Progreso, Saan a Perfection',
      'Mangrugi Manen',
    ],

    insights: [
      'No dakkel ti problema, mabalin a narigat ti mangrugi gapu ta kayat tayo a solbaren amin a dagus.',
      'Mabalin a nabannayat ti progreso ngem adda latta pategna.',
      'Saan nga amin nga aldaw ket naproduktibo. Importante met ti agtultuloy.',
      'Nalaka nga agtultuloy no ipamaysa ti kabaelam a kontrolen ita.',
    ],

    lessons: [
      'Saan a kasapulan a dakkel ti addang tapno importante.',
      'Ti consistency ket napigsa ngem iti effort nga saan a mapagtultuloy.',
      'Ti biddut ket mabalin nga aramiden a leksiyon.',
      'Saan a kasapulan nga urayen ti perfect motivation tapno mangrugi.',
    ],

    actions: [
      'Pilien ti maysa nga aramid a malpas iti sangapulo a minuto.',
      'Isurat ti tallo a banag a kabaelam a kontrolen ita.',
      'Agtalna bassit kalpasanna agsubli iti maysa a nalawag a priority.',
      'Bigbigen ti maysa a bassit a progresom ita nga aldaw.',
    ],

    reflections: [
      'Ania ti maysa a bassit ngem importante nga addang a kabaelam ita?',
      'Ania ti mabalinmo a pasimpleen ita nga aldaw?',
      'Ania a biddut ti mabalinmo nga aramiden a leksiyon?',
    ],
  },


  en: {
    titles: [
      'The Power of One Small Step',
      'You Do Not Have to Do Everything',
      'Progress Over Perfection',
      'Begin Again',
      'Choose the Next Step',
      'Consistency Matters',
    ],

    insights: [
      'Large problems can make us freeze when we believe everything must be solved immediately.',
      'Slow progress is easy to underestimate, but small repeated actions often create lasting change.',
      'Not every day will be highly productive. Sometimes continuing is already meaningful progress.',
      'Moving forward becomes easier when your attention is placed on what you can control now.',
      'Rest is not automatically a setback. Sometimes it is part of moving forward effectively.',
    ],

    lessons: [
      'A step does not need to be large to matter. Direction matters more than size.',
      'Consistency is usually more sustainable than short bursts of extreme effort.',
      'Mistakes can become useful information for making a better next decision.',
      'You do not have to wait for perfect motivation before beginning.',
      'One difficult day is not a summary of your entire life.',
    ],

    actions: [
      'Choose one task you can finish within ten minutes and do that first.',
      'Write down three things you can control today, then choose one.',
      'Fix one small thing you have been postponing.',
      'Take a short rest, then return to one clear priority.',
      'Before the day ends, recognize one small piece of progress you made.',
    ],

    reflections: [
      'What is one small but meaningful step you can take today?',
      'What can you simplify to make today more manageable?',
      'What mistake can you turn into a lesson instead of a reason to quit?',
      'What are you doing well even if it is not always noticed?',
    ],
  },

} satisfies Record<
  BuklodPublicLanguage,
  {
    titles: string[];
    insights: string[];
    lessons: string[];
    actions: string[];
    reflections: string[];
  }
>;


export function getDailyMotivationalLesson(
  userId: string,
  language: BuklodPublicLanguage,
): MotivationalLesson {

  const data =
    LESSON_DATA[
      language
    ];

  const seed =
    seedFor(
      userId,
      language,
      'daily-inspire',
    );

  return {
    title:
      data.titles[
        seed %
        data.titles.length
      ],

    insight:
      data.insights[
        (seed + 3) %
        data.insights.length
      ],

    lesson:
      data.lessons[
        (seed + 7) %
        data.lessons.length
      ],

    action:
      data.actions[
        (seed + 11) %
        data.actions.length
      ],

    reflection:
      data.reflections[
        (seed + 17) %
        data.reflections.length
      ],
  };
}


export function publicLanguageLabel(
  language: BuklodPublicLanguage,
) {
  switch (language) {

    case 'ceb':
      return 'CEBUANO';

    case 'ilo':
      return 'ILOCANO';

    case 'en':
      return 'ENGLISH';

    default:
      return 'FILIPINO';
  }
}