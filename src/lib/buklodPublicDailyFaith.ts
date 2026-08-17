export type BuklodLocalLanguage =
  | 'fil'
  | 'ceb'
  | 'ilo'
  | 'hil'
  | 'war'
  | 'bik'
  | 'en';

export type DailyFaithVerse = {
  reference: string;
  text: string;
};

function norm(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function detectBuklodLocalLanguage(
  provinceValue: unknown,
  countryValue: unknown,
  preferredLanguageValue?: unknown,
): BuklodLocalLanguage {
  const province = norm(provinceValue);
  const country = norm(countryValue);
  const preferred = norm(preferredLanguageValue);

  if (
    country &&
    country !== 'ph' &&
    !country.includes('philipp')
  ) {
    return 'en';
  }

  const includesAny = (
    values: string[],
  ) =>
    values.some(
      value =>
        province.includes(value),
    );

  if (
    includesAny([
      'ilocos norte',
      'ilocos sur',
      'la union',
      'abra',
    ])
  ) {
    return 'ilo';
  }

  if (
    includesAny([
      'iloilo',
      'guimaras',
      'negros occidental',
      'capiz',
      'antique',
    ])
  ) {
    return 'hil';
  }

  if (
    includesAny([
      'northern samar',
      'eastern samar',
      'samar',
      'leyte',
      'biliran',
    ])
  ) {
    return 'war';
  }

  if (
    includesAny([
      'albay',
      'camarines norte',
      'camarines sur',
      'catanduanes',
      'sorsogon',
      'masbate',
    ])
  ) {
    return 'bik';
  }

  if (
    includesAny([
      'cebu',
      'bohol',
      'siquijor',
      'negros oriental',
      'misamis oriental',
      'misamis occidental',
      'bukidnon',
      'davao de oro',
      'davao del norte',
      'davao del sur',
      'davao occidental',
      'davao oriental',
      'agusan del norte',
      'agusan del sur',
      'surigao del norte',
      'surigao del sur',
      'zamboanga del norte',
      'zamboanga del sur',
      'zamboanga sibugay',
      'lanao del norte',
    ])
  ) {
    return 'ceb';
  }

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
    preferred.includes('hiligaynon') ||
    preferred.includes('ilonggo') ||
    preferred === 'hil'
  ) {
    return 'hil';
  }

  if (
    preferred.includes('waray') ||
    preferred === 'war'
  ) {
    return 'war';
  }

  if (
    preferred.includes('bikol') ||
    preferred.includes('bicol') ||
    preferred === 'bik'
  ) {
    return 'bik';
  }

  if (
    preferred.includes('english') ||
    preferred === 'en'
  ) {
    return 'en';
  }

  return 'fil';
}

export function buklodLanguageLabel(
  language: BuklodLocalLanguage,
) {
  switch (language) {
    case 'ceb':
      return 'CEBUANO';
    case 'ilo':
      return 'ILOCANO';
    case 'hil':
      return 'HILIGAYNON';
    case 'war':
      return 'WARAY';
    case 'bik':
      return 'BIKOL';
    case 'en':
      return 'ENGLISH';
    default:
      return 'FILIPINO';
  }
}

function localDateKey() {
  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0');

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function hashText(value: string) {
  let hash = 2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^=
      value.charCodeAt(index);

    hash = Math.imul(
      hash,
      16777619,
    );
  }

  return hash >>> 0;
}

const VERSES: Record<
  BuklodLocalLanguage,
  DailyFaithVerse[]
> = {
  fil: [
    {
      reference: 'Awit 23:1',
      text:
        'Ang Panginoon ang aking pastol; hindi ako magkukulang.',
    },
    {
      reference: 'Isaias 41:10',
      text:
        'Huwag kang matakot, sapagkat ako ay kasama mo; huwag kang mangamba, sapagkat ako ang iyong Diyos.',
    },
    {
      reference: 'Filipos 4:13',
      text:
        'Magagawa ko ang lahat ng bagay sa pamamagitan ni Cristo na nagbibigay sa akin ng lakas.',
    },
    {
      reference: 'Awit 46:1',
      text:
        'Ang Diyos ang ating kanlungan at kalakasan, laging handang tumulong sa panahon ng kaguluhan.',
    },
  ],

  ceb: [
    {
      reference: 'Salmo 23:1',
      text:
        'Ang Ginoo mao ang akong magbalantay; dili ako makulangan.',
    },
    {
      reference: 'Isaias 41:10',
      text:
        'Ayaw kahadlok kay uban ako kanimo; ayaw kabalaka kay ako ang imong Dios.',
    },
    {
      reference: 'Filipos 4:13',
      text:
        'Mahimo nako ang tanang butang pinaagi kang Cristo nga naghatag kanako ug kusog.',
    },
    {
      reference: 'Salmo 46:1',
      text:
        'Ang Dios mao ang atong dalangpanan ug kusog, andam nga motabang sa panahon sa kalisdanan.',
    },
  ],

  ilo: [
    {
      reference: 'Salmo 23:1',
      text:
        'Ti Apo ti pastor ko; awan ti kurangko.',
    },
    {
      reference: 'Isaias 41:10',
      text:
        'Saan ka nga agbuteng ta addaak kenka; saan ka nga agdanag ta siak ti Diosmo.',
    },
    {
      reference: 'Filipos 4:13',
      text:
        'Mabalinko ti amin a banag babaen ken Cristo a mangted kaniak iti pigsa.',
    },
    {
      reference: 'Salmo 46:1',
      text:
        'Ti Dios ti pagkamangan ken pigsatayo, nakasagana a tumulong iti tiempo ti rigat.',
    },
  ],

  hil: [
    {
      reference: 'Salmo 23:1',
      text:
        'Ang Ginoo amo ang akon manugbantay; wala ako sing kulang.',
    },
    {
      reference: 'Isaias 41:10',
      text:
        'Indi ka magkahadlok kay kaupod mo ako; indi ka magkabalaka kay ako ang imo Dios.',
    },
    {
      reference: 'Filipos 4:13',
      text:
        'Mahimo ko ang tanan nga butang paagi kay Cristo nga nagahatag sa akon sing kusog.',
    },
    {
      reference: 'Salmo 46:1',
      text:
        'Ang Dios amo ang aton dalangpan kag kusog, handa nga magbulig sa tion sang kalisdanan.',
    },
  ],

  war: [
    {
      reference: 'Salmo 23:1',
      text:
        'An Ginoo amo an akon magmarangno; diri ako magkukulang.',
    },
    {
      reference: 'Isaias 41:10',
      text:
        'Ayaw kahadlok kay kaupod mo ako; ayaw kabaraka kay ako an imo Dios.',
    },
    {
      reference: 'Filipos 4:13',
      text:
        'Mahihimo ko an ngatanan pinaagi kan Cristo nga naghahatag ha akon hin kusog.',
    },
    {
      reference: 'Salmo 46:1',
      text:
        'An Dios amo an aton arayopan ngan kusog, andam nga bumulig ha panahon han kasamok.',
    },
  ],

  bik: [
    {
      reference: 'Salmo 23:1',
      text:
        'An Kagurangnan an sakuyang pastor; dai ako magkukulang.',
    },
    {
      reference: 'Isaias 41:10',
      text:
        'Dai ka matakot ta kaiba mo ako; dai ka mag-alala ta ako an saimong Dios.',
    },
    {
      reference: 'Filipos 4:13',
      text:
        'Magigibo ko an gabos na bagay sa paagi ni Cristo na nagtatao sako nin kusog.',
    },
    {
      reference: 'Salmo 46:1',
      text:
        'An Dios an satuyang kublihan asin kusog, pirming andam na magtabang sa panahon nin kasakitan.',
    },
  ],

  en: [
    {
      reference: 'Psalm 23:1',
      text:
        'The Lord is my shepherd; I shall not want.',
    },
    {
      reference: 'Isaiah 41:10',
      text:
        'Fear thou not; for I am with thee: be not dismayed; for I am thy God.',
    },
    {
      reference: 'Philippians 4:13',
      text:
        'I can do all things through Christ which strengtheneth me.',
    },
    {
      reference: 'Psalm 46:1',
      text:
        'God is our refuge and strength, a very present help in trouble.',
    },
  ],
};

const MOTIVATION: Record<
  BuklodLocalLanguage,
  string[]
> = {
  fil: [
    'Hindi kailangang matapos ang lahat ngayon. Isang magandang hakbang ay progreso na.',
    'May mga araw na mabagal ang progreso, pero progreso pa rin iyon.',
    'Kapag mabigat ang araw, ituon muna ang lakas sa susunod na kaya mong gawin.',
  ],
  ceb: [
    'Dili kinahanglan mahuman ang tanan karon. Usa ka maayong lakang progreso na.',
    'Usahay hinay ang progreso, apan progreso gihapon kana.',
    'Kung bug-at ang adlaw, unaha ang sunod nga lakang nga imong makaya.',
  ],
  ilo: [
    'Saan a kasapulan a malpas amin ita nga aldaw. Maysa a nasayaat nga addang ket progreso.',
    'Adda aldaw a nabannayat ti progreso, ngem progreso latta.',
    'No narigat ti aldaw, ipamaysa ti sumaruno nga kabaelam nga aramiden.',
  ],
  hil: [
    'Indi kinahanglan matapos ang tanan subong. Ang isa ka maayo nga tikang progreso na.',
    'May mga adlaw nga mahinay ang progreso, pero progreso gihapon ina.',
    'Kon mabug-at ang adlaw, unaha ang masunod nga tikang nga kaya mo.',
  ],
  war: [
    'Diri kinahanglan matapos an ngatanan yana. Usa nga maopay nga pitad progreso na.',
    'May mga adlaw nga mahinay an progreso, pero progreso la gihapon.',
    'Kon mabug-at an adlaw, tutuki anay an sunod nga pitad nga kaya mo.',
  ],
  bik: [
    'Dai kaipuhan matapos an gabos ngunyan. Sarong marhay na lakdang progreso na.',
    'May mga aldaw na mabagal an progreso, pero progreso pa man.',
    'Kun mabugat an aldaw, tutukan muna an sunod na lakdang na kaya mo.',
  ],
  en: [
    'You do not have to finish everything today. One good step is still progress.',
    'Some days move slowly. Slow progress is still progress.',
    'When the day feels heavy, focus on the next manageable step.',
  ],
};

export function getDailyFaithVerse(
  userId: string,
  language: BuklodLocalLanguage,
) {
  const pool = VERSES[language];

  const seed = hashText(
    `${localDateKey()}|${userId}|${language}|faith`,
  );

  return pool[
    seed % pool.length
  ];
}

export function getDailyMotivation(
  userId: string,
  language: BuklodLocalLanguage,
) {
  const pool =
    MOTIVATION[language];

  const seed = hashText(
    `${localDateKey()}|${userId}|${language}|motivation`,
  );

  return pool[
    seed % pool.length
  ];
}