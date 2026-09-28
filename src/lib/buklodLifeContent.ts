import type { BuklodPublicLanguage } from '@/lib/buklodPublicDailyContent';

export const LIFE_GOSPEL_CORE_VERSION =
  'LIFE_GOSPEL_CORE_2026_09_V1';

export const LIFE_SOUL_WINNER_GUIDE_VERSION =
  'LIFE_SOUL_WINNER_GUIDE_2026_09_V1';

export const LIFE_SCRIPTURE_PACK_VERSION =
  'LIFE_SCRIPTURE_PACK_2026_09_V1';

export type BuklodLifeLanguage = 'fil' | 'en';

export type BuklodLifeTopicKey =
  | 'hope'
  | 'peace'
  | 'purpose'
  | 'forgiveness'
  | 'strength'
  | 'new-start'
  | 'questions'
  | 'jesus'
  | 'help';

export type BuklodLifeTopic = {
  key: Exclude<BuklodLifeTopicKey, 'questions' | 'jesus' | 'help'>;
  title: string;
  subtitle: string;
  icon:
    | 'sprout'
    | 'weather-sunset'
    | 'compass-outline'
    | 'heart-outline'
    | 'dumbbell'
    | 'refresh-circle';
  accent: string;
  soft: string;
};

export type BuklodLifeTopicDetail = {
  title: string;
  subtitle: string;
  practicalTitle: string;
  practicalBody: string;
  deeperQuestion: string;
  truthTitle: string;
  truthBody: string;
  nextTitle: string;
  nextBody: string;
};

export type BuklodLifeCopy = {
  languageLabel: string;
  eyebrow: string;
  brandSubtitle: string;
  brandLine: string;
  needTitle: string;
  needSubtitle: string;
  forYouTitle: string;
  forYouHeadline: string;
  forYouBody: string;
  strugglesTitle: string;
  questionsTitle: string;
  exploreTitle: string;
  exploreHeadline: string;
  exploreBody: string;
  exploreCta: string;
  helpTitle: string;
  helpHeadline: string;
  helpBody: string;
  helpCta: string;
  seeAll: string;
  continueLabel: string;
  askLabel: string;
  notNowLabel: string;
  humanFirstLabel: string;
  christianTruthLabel: string;
  nextStepLabel: string;
  commonStruggles: Array<{
    label: string;
    target: BuklodLifeTopicKey;
    icon: 'map-marker-question-outline' | 'head-question-outline' | 'account-outline' | 'restart-alert';
  }>;
  questions: string[];
  primaryTopics: BuklodLifeTopic[];
  details: Record<
    Exclude<BuklodLifeTopicKey, 'questions' | 'jesus' | 'help'>,
    BuklodLifeTopicDetail
  >;
  questionsIntro: string;
  jesusTitle: string;
  jesusIntro: string;
  jesusPoints: string[];
  helpGuideTitle: string;
  helpGuideIntro: string;
  helpSteps: Array<{ title: string; body: string }>;
};

export function normalizeBuklodLifeLanguage(
  language: BuklodPublicLanguage | string | null | undefined,
): BuklodLifeLanguage {
  return String(language ?? '').toLowerCase() === 'fil' ? 'fil' : 'en';
}

const FIL: BuklodLifeCopy = {
  languageLabel: 'FILIPINO',
  eyebrow: 'BUKLOD LIFE',
  brandSubtitle: 'Pag-asa • Layunin • Direksiyon',
  brandLine: 'Mga sagot para sa mga sandaling mahalaga.',
  needTitle: 'Ano ang kailangan mo ngayon?',
  needSubtitle: 'Pumili ng paksa o hayaan mong gabayan ka namin.',
  forYouTitle: 'Para sa iyo ngayon',
  forYouHeadline: 'Kapag magulo ang buhay…',
  forYouBody:
    'Hindi mo kailangang ayusin ang lahat nang sabay-sabay. Magsimula sa susunod na tapat at makabuluhang hakbang.',
  strugglesTitle: 'Karaniwang pinagdaraanan',
  questionsTitle: 'Mahahalagang tanong',
  exploreTitle: 'Kilalanin si Jesus',
  exploreHeadline: 'Sino si Jesus? Bakit Siya naparito?',
  exploreBody:
    'Tuklasin kung ano ang itinuturo ng Christian Gospel tungkol sa Kanya at sa bagong buhay na iniaalok Niya.',
  exploreCta: 'Kilalanin Siya',
  helpTitle: 'Tulungan ang iba',
  helpHeadline: 'May pinagdaraanan ba ang mahal mo sa buhay?',
  helpBody:
    'Isang simple at maingat na gabay para makinig, umunawa, at magbahagi ng pag-asa nang may respeto.',
  helpCta: 'Alamin paano',
  seeAll: 'Tingnan lahat',
  continueLabel: 'Magpatuloy',
  askLabel: 'May tanong ako',
  notNowLabel: 'Hindi muna',
  humanFirstLabel: 'UNANG HAKBANG',
  christianTruthLabel: 'CHRISTIAN PERSPECTIVE',
  nextStepLabel: 'SUSUNOD NA HAKBANG',
  commonStruggles: [
    {
      label: 'Naliligaw ako',
      target: 'purpose',
      icon: 'map-marker-question-outline',
    },
    {
      label: 'Nag-aalala ako',
      target: 'peace',
      icon: 'head-question-outline',
    },
    {
      label: 'Nag-iisa ako',
      target: 'hope',
      icon: 'account-outline',
    },
    {
      label: 'Nabigo ako',
      target: 'new-start',
      icon: 'restart-alert',
    },
  ],
  questions: [
    'Totoo bang may Diyos?',
    'Bakit hinahayaan ng Diyos ang pagdurusa?',
    'Bakit si Jesus?',
    'Mapapatawad ba ako ng Diyos?',
    'Ano ang mangyayari pagkatapos ng kamatayan?',
    'Ano ang ibig sabihin ng maligtas?',
  ],
  primaryTopics: [
    {
      key: 'hope',
      title: 'Pag-asa',
      subtitle: 'Makakita ng liwanag sa gitna ng hirap.',
      icon: 'sprout',
      accent: '#2F6D3A',
      soft: '#E5F0DF',
    },
    {
      key: 'peace',
      title: 'Kapayapaan',
      subtitle: 'Huminga nang malalim at hanapin ang tunay na kapayapaan.',
      icon: 'weather-sunset',
      accent: '#3B7188',
      soft: '#E5F0F3',
    },
    {
      key: 'purpose',
      title: 'Layunin',
      subtitle: 'Tuklasin ang direksiyon at kahulugan ng buhay.',
      icon: 'compass-outline',
      accent: '#9A661C',
      soft: '#F5EAD7',
    },
    {
      key: 'forgiveness',
      title: 'Kapatawaran',
      subtitle: 'Harapin ang bigat ng guilt at ang posibilidad ng kapatawaran.',
      icon: 'heart-outline',
      accent: '#A94C3D',
      soft: '#F7E3DF',
    },
    {
      key: 'strength',
      title: 'Lakas',
      subtitle: 'Magpatuloy kapag mabigat ang araw.',
      icon: 'dumbbell',
      accent: '#496B78',
      soft: '#E4ECEF',
    },
    {
      key: 'new-start',
      title: 'Bagong Simula',
      subtitle: 'Hindi kailangang ang nakaraan ang huling salita.',
      icon: 'refresh-circle',
      accent: '#5E7E2C',
      soft: '#E8F0D9',
    },
  ],
  details: {
    hope: {
      title: 'Pag-asa',
      subtitle: 'Makakita ng liwanag sa gitna ng hirap.',
      practicalTitle: 'Magsimula sa kaya mong gawin ngayon',
      practicalBody:
        'Kapag mabigat ang pinagdaraanan, paliitin muna ang susunod na hakbang. Kumain, magpahinga, humingi ng tulong, o kausapin ang taong mapagkakatiwalaan mo.',
      deeperQuestion:
        'Saan ka kumakapit kapag hindi mo kontrolado ang mangyayari?',
      truthTitle: 'May pag-asang mas malalim sa sitwasyon',
      truthBody:
        'Sa Christian Gospel, ang pag-asa ay hindi lang positibong pag-iisip. Nakaugat ito sa Diyos at sa ginawa ni Jesus—na namatay at muling nabuhay—kaya may dahilan para magtiwala kahit hindi pa malinaw ang lahat.',
      nextTitle: 'Isang tahimik na susunod na hakbang',
      nextBody:
        'Maaari mong kilalanin pa si Jesus, magbasa ng maikling bahagi ng Biblia, o manatili muna rito at mag-isip. Walang pilitan.',
    },
    peace: {
      title: 'Kapayapaan',
      subtitle: 'Huminga, huminto, at harapin ang isang bagay sa isang pagkakataon.',
      practicalTitle: 'Bawasan muna ang ingay',
      practicalBody:
        'Huminga nang mabagal, ilayo muna ang sarili sa sobrang stimulation, at tukuyin kung alin ang kaya mong kontrolin ngayon.',
      deeperQuestion:
        'Kung hindi mawawala agad ang problema, ano ang makapagbibigay sa iyo ng matibay na kapayapaan?',
      truthTitle: 'Kapayapaang hindi nakadepende sa perfect na sitwasyon',
      truthBody:
        'Itinuturo ng Christian faith na maaaring lumapit sa Diyos sa gitna ng takot at alalahanin. Inaanyayahan tayo ni Jesus na magtiwala sa Kanya, hindi dahil maliit ang problema, kundi dahil hindi tayo nag-iisa.',
      nextTitle: 'Subukan ito',
      nextBody:
        'Sabihin sa Diyos nang simple kung ano ang kinatatakutan mo, o piliing magpatuloy sa Explore Jesus kung gusto mong maintindihan kung bakit nagtitiwala ang Christians kay Jesus.',
    },
    purpose: {
      title: 'Layunin',
      subtitle: 'Kapag hindi mo alam kung saan patungo ang buhay.',
      practicalTitle: 'Hindi mo kailangang makita agad ang buong mapa',
      practicalBody:
        'Isulat ang mahahalagang tao, responsibilidad, kakayahan, at values na ipinagkatiwala sa iyo. Madalas lumilinaw ang direksiyon habang tapat kang gumagawa ng susunod na tama.',
      deeperQuestion:
        'Paano kung ang halaga at layunin mo ay hindi mo kailangang imbentuhin para sa sarili mo?',
      truthTitle: 'Ginawa kang may kahulugan',
      truthBody:
        'Sa Christian Gospel, ang buhay ay hindi aksidente. Nilalang tayo ng Diyos upang makilala Siya, mahalin ang kapwa, at mamuhay nang may layuning mas malaki kaysa sarili lamang.',
      nextTitle: 'Kilalanin ang pinagmumulan ng layunin',
      nextBody:
        'Maaari mong simulan sa tanong na “Sino si Jesus?” at tingnan kung paano Niya inilalarawan ang buhay na may tunay na direksiyon.',
    },
    forgiveness: {
      title: 'Kapatawaran',
      subtitle: 'Kapag mabigat ang guilt, hiya, o sakit na dala ng nakaraan.',
      practicalTitle: 'Harapin nang tapat ang nangyari',
      practicalBody:
        'Kung may nasaktan ka, kilalanin ang mali at ayusin ang kaya mong ayusin. Kung ikaw naman ang nasaktan, hindi ibig sabihin ng pagpapatawad na tama ang ginawa sa iyo o wala nang boundaries.',
      deeperQuestion:
        'Paano tayo nagiging tunay na malinis sa harap ng Diyos kung hindi natin mababawi ang lahat ng maling nagawa natin?',
      truthTitle: 'Ang kapatawaran ay biyaya',
      truthBody:
        'Sa Christian Gospel, hindi natin binibili o pinaghihirapan ang kapatawaran. Si Jesus ang nagdala ng kabayaran ng kasalanan sa krus at nag-aalok ng kapatawaran bilang biyaya sa taong lumalapit sa Kanya nang may pagsisisi at pananampalataya.',
      nextTitle: 'Lumapit nang tapat',
      nextBody:
        'Kung gusto mo, maaari mong ipahayag sa Diyos ang totoo tungkol sa iyong pagkakamali at magpatuloy sa pagkilala kung ano ang ginawa ni Jesus para sa atin.',
    },
    strength: {
      title: 'Lakas',
      subtitle: 'Kapag pagod ka na pero kailangan mong magpatuloy.',
      practicalTitle: 'Ang pahinga ay bahagi rin ng pagpapatuloy',
      practicalBody:
        'Hindi lahat ng pagod ay nalulutas sa pagpipilit. Tingnan kung kailangan mo ng tulog, pagkain, pahinga, tulong ng ibang tao, o mas maliit na gawain muna.',
      deeperQuestion:
        'Ano ang sandigan mo kapag ubos na ang sarili mong lakas?',
      truthTitle: 'Hindi mo kailangang umasa sa sarili mo lang',
      truthBody:
        'Itinuturo ng Christian faith na ang lakas ay maaari ring manggaling sa pagtitiwala sa Diyos. Hindi nito inaalis ang responsibilidad o pangangailangan sa tamang tulong, pero nagbibigay ito ng mas malalim na sandigan.',
      nextTitle: 'Humingi ng tulong',
      nextBody:
        'Kausapin ang taong mapagkakatiwalaan mo at, kung gusto mo, manalangin nang simple: “Diyos, kailangan ko ng lakas para sa susunod na hakbang.”',
    },
    'new-start': {
      title: 'Bagong Simula',
      subtitle: 'Ang pinakamahina mong sandali ay hindi kailangang maging huling kabanata.',
      practicalTitle: 'Magsimula sa isang totoong pagbabago',
      practicalBody:
        'Piliin ang isang bagay na kailangan mong itigil, ayusin, aminin, o simulan. Ang bagong direksiyon ay nabubuo sa mga susunod na desisyon.',
      deeperQuestion:
        'Posible bang hindi lang bagong habit ang kailangan natin kundi bagong buhay?',
      truthTitle: 'Inaanyayahan ni Jesus ang tao sa bagong buhay',
      truthBody:
        'Sa Christian Gospel, ang bagong simula ay higit sa self-improvement. Inaanyayahan tayo ni Jesus na magsisi, magtiwala sa Kanya, at magsimulang mamuhay bilang taong sumusunod sa Kanya.',
      nextTitle: 'Maaari kang magsimula rito',
      nextBody:
        'Kilalanin si Jesus, magtanong nang malaya, at magdesisyon lamang kapag naiintindihan mo ang mensahe. Walang countdown at walang pilitan.',
    },
  },
  questionsIntro:
    'Mahalagang magtanong nang tapat. Hindi kailangang magkunwaring sigurado ka. Piliin ang tanong na gusto mong pag-isipan at simulan doon.',
  jesusTitle: 'Kilalanin si Jesus',
  jesusIntro:
    'Ang Christian Gospel ay malinaw na nakasentro kay Jesus Christ. Narito ang maikling buod na maaari mong pag-isipan nang walang pressure.',
  jesusPoints: [
    'Diyos — Ginawa kang may kahulugan at para makilala Siya.',
    'Ang problema — Ang kasalanan ay naghihiwalay sa tao sa Diyos at hindi natin kayang ayusin ang sarili natin sa pamamagitan lamang ng mabubuting gawa.',
    'Jesus Christ — Dumating Siya sa mundo, namatay para sa ating mga kasalanan, at muling nabuhay.',
    'Biyaya — Ang kaligtasan ay regalo ng Diyos; hindi ito binibili o pinagtatrabahuhan.',
    'Tugon — Inaanyayahan ang tao na magsisi at magtiwala kay Jesus bilang Panginoon at Tagapagligtas.',
    'Bagong buhay — Ang pagsunod kay Jesus ay simula ng buhay na pagkilala at pagsunod sa Kanya.',
  ],
  helpGuideTitle: 'Tulungan ang Iba',
  helpGuideIntro:
    'Ang layunin ay hindi manalo sa argumento. Makinig muna, umunawa, humingi ng pahintulot, at maging malinaw kapag ibinabahagi mo ang Christian Gospel.',
  helpSteps: [
    {
      title: '1. Makinig',
      body: 'Tanungin: “Ano ang pinakamabigat para sa iyo ngayon?” Huwag agad magbigay ng sermon.',
    },
    {
      title: '2. Unawain',
      body: 'Alamin kung fear, guilt, family, loneliness, failure, death, purpose, o faith question ang dinadala niya.',
    },
    {
      title: '3. Gumawa ng tulay',
      body: 'Halimbawa: “Okay lang ba kung ibahagi ko ang isang bagay na nakatulong sa akin na maintindihan ang pag-asa?”',
    },
    {
      title: '4. Ibahagi ang Gospel',
      body: 'Maging maikli, malinaw, at tapat: Diyos, kasalanan, Jesus, biyaya, tugon, at bagong buhay.',
    },
    {
      title: '5. Respeto sa tugon',
      body: 'Kung interesado, magpatuloy. Kung may tanong, makinig. Kung hindi handa, igalang ang sagot at huwag pilitin.',
    },
  ],
};

const EN: BuklodLifeCopy = {
  languageLabel: 'ENGLISH',
  eyebrow: 'BUKLOD LIFE',
  brandSubtitle: 'Hope • Purpose • Direction',
  brandLine: 'Answers for the moments that matter.',
  needTitle: 'What do you need today?',
  needSubtitle: 'Choose a topic or let us guide you.',
  forYouTitle: 'For you today',
  forYouHeadline: 'When life feels uncertain…',
  forYouBody:
    'You do not have to solve everything at once. Start with the next honest, meaningful step.',
  strugglesTitle: 'Common struggles',
  questionsTitle: 'Questions worth asking',
  exploreTitle: 'Explore Jesus',
  exploreHeadline: 'Who is Jesus? Why did He come?',
  exploreBody:
    'Explore what the Christian Gospel teaches about Him and the new life He offers.',
  exploreCta: 'Discover Jesus',
  helpTitle: 'Help someone',
  helpHeadline: 'Is someone you care about struggling?',
  helpBody:
    'A simple, respectful guide for listening, understanding, and sharing hope without pressure.',
  helpCta: 'Learn how',
  seeAll: 'See all',
  continueLabel: 'Continue',
  askLabel: 'I have a question',
  notNowLabel: 'Not now',
  humanFirstLabel: 'FIRST STEP',
  christianTruthLabel: 'CHRISTIAN PERSPECTIVE',
  nextStepLabel: 'NEXT STEP',
  commonStruggles: [
    {
      label: 'I feel lost',
      target: 'purpose',
      icon: 'map-marker-question-outline',
    },
    {
      label: "I'm worried",
      target: 'peace',
      icon: 'head-question-outline',
    },
    {
      label: 'I feel alone',
      target: 'hope',
      icon: 'account-outline',
    },
    {
      label: 'I failed',
      target: 'new-start',
      icon: 'restart-alert',
    },
  ],
  questions: [
    'Does God really exist?',
    'Why does God allow suffering?',
    'Why Jesus?',
    'Can God forgive me?',
    'What happens after death?',
    'What does it mean to be saved?',
  ],
  primaryTopics: [
    {
      key: 'hope',
      title: 'Hope',
      subtitle: 'Find light in difficult times.',
      icon: 'sprout',
      accent: '#2F6D3A',
      soft: '#E5F0DF',
    },
    {
      key: 'peace',
      title: 'Peace',
      subtitle: 'Slow down and find a steadier place to stand.',
      icon: 'weather-sunset',
      accent: '#3B7188',
      soft: '#E5F0F3',
    },
    {
      key: 'purpose',
      title: 'Purpose',
      subtitle: 'Explore direction and meaning.',
      icon: 'compass-outline',
      accent: '#9A661C',
      soft: '#F5EAD7',
    },
    {
      key: 'forgiveness',
      title: 'Forgiveness',
      subtitle: 'Face guilt, hurt, and the possibility of grace.',
      icon: 'heart-outline',
      accent: '#A94C3D',
      soft: '#F7E3DF',
    },
    {
      key: 'strength',
      title: 'Strength',
      subtitle: 'Keep going when the day is heavy.',
      icon: 'dumbbell',
      accent: '#496B78',
      soft: '#E4ECEF',
    },
    {
      key: 'new-start',
      title: 'A New Start',
      subtitle: 'Your past does not have to have the final word.',
      icon: 'refresh-circle',
      accent: '#5E7E2C',
      soft: '#E8F0D9',
    },
  ],
  details: {
    hope: {
      title: 'Hope',
      subtitle: 'Find light in difficult times.',
      practicalTitle: 'Start with what you can do today',
      practicalBody:
        'When life feels heavy, make the next step smaller. Eat, rest, ask for help, or talk to someone trustworthy.',
      deeperQuestion:
        'What do you hold onto when you cannot control what happens next?',
      truthTitle: 'Hope can be deeper than circumstances',
      truthBody:
        'In the Christian Gospel, hope is more than positive thinking. It is rooted in God and in what Jesus has done through His death and resurrection.',
      nextTitle: 'A quiet next step',
      nextBody:
        'You can explore Jesus, read a short Bible passage, or simply stay here and think. There is no pressure.',
    },
    peace: {
      title: 'Peace',
      subtitle: 'Slow down and face one thing at a time.',
      practicalTitle: 'Reduce the noise first',
      practicalBody:
        'Breathe slowly, step away from unnecessary stimulation, and identify what is actually within your control today.',
      deeperQuestion:
        'If the problem does not disappear immediately, what could give you a steadier kind of peace?',
      truthTitle: 'Peace that is not dependent on a perfect situation',
      truthBody:
        'Christian faith teaches that we can come to God in fear and uncertainty. Jesus invites people to trust Him, not because the problem is small, but because they do not face it alone.',
      nextTitle: 'Try this',
      nextBody:
        'Tell God plainly what you are afraid of, or continue to Explore Jesus if you want to understand why Christians trust Him.',
    },
    purpose: {
      title: 'Purpose',
      subtitle: 'When you are not sure where your life is going.',
      practicalTitle: 'You do not need the whole map yet',
      practicalBody:
        'Write down the people, responsibilities, abilities, and values entrusted to you. Direction often becomes clearer while you take the next faithful step.',
      deeperQuestion:
        'What if your worth and purpose are not things you have to invent by yourself?',
      truthTitle: 'You were made with meaning',
      truthBody:
        'In the Christian Gospel, life is not an accident. We were created by God to know Him, love others, and live for something larger than ourselves.',
      nextTitle: 'Explore the source of purpose',
      nextBody:
        'Start with the question “Who is Jesus?” and explore how He describes a life with real direction.',
    },
    forgiveness: {
      title: 'Forgiveness',
      subtitle: 'When guilt, shame, or old wounds feel heavy.',
      practicalTitle: 'Face what happened honestly',
      practicalBody:
        'If you hurt someone, own what was wrong and repair what you can. If you were hurt, forgiveness does not mean pretending the harm was acceptable or abandoning healthy boundaries.',
      deeperQuestion:
        'How can we truly be made right with God when we cannot undo everything we have done?',
      truthTitle: 'Forgiveness is grace',
      truthBody:
        'In the Christian Gospel, forgiveness is not something we purchase or earn. Jesus bore the cost of sin at the cross and offers grace to those who turn to Him in repentance and faith.',
      nextTitle: 'Come honestly',
      nextBody:
        'If you want, tell God the truth about your failure and continue exploring what Jesus has done for us.',
    },
    strength: {
      title: 'Strength',
      subtitle: 'When you are tired but still need to keep going.',
      practicalTitle: 'Rest can be part of moving forward',
      practicalBody:
        'Not every kind of exhaustion is solved by pushing harder. Check whether you need sleep, food, rest, another person, or a smaller next task.',
      deeperQuestion:
        'What supports you when your own strength is no longer enough?',
      truthTitle: 'You do not have to rely on yourself alone',
      truthBody:
        'Christian faith teaches that strength can also come through trusting God. That does not replace wise help or responsibility, but it gives a deeper place to stand.',
      nextTitle: 'Ask for help',
      nextBody:
        'Talk to someone trustworthy and, if you want, pray simply: “God, give me strength for the next step.”',
    },
    'new-start': {
      title: 'A New Start',
      subtitle: 'Your weakest moment does not have to become your final chapter.',
      practicalTitle: 'Begin with one real change',
      practicalBody:
        'Choose one thing you need to stop, repair, admit, or begin. A new direction is formed through the decisions that follow.',
      deeperQuestion:
        'What if we need more than a new habit—what if we need new life?',
      truthTitle: 'Jesus invites people into new life',
      truthBody:
        'In the Christian Gospel, a new start is more than self-improvement. Jesus invites us to repent, trust Him, and begin living as people who follow Him.',
      nextTitle: 'You can begin here',
      nextBody:
        'Explore Jesus, ask questions freely, and decide only when you understand the message. There is no countdown and no pressure.',
    },
  },
  questionsIntro:
    'Honest questions are welcome. You do not have to pretend certainty. Choose a question worth exploring and begin there.',
  jesusTitle: 'Explore Jesus',
  jesusIntro:
    'The Christian Gospel is clearly centered on Jesus Christ. Here is a concise summary you can consider without pressure.',
  jesusPoints: [
    'God — You were made with meaning and created to know Him.',
    'Our problem — Sin separates people from God, and we cannot make ourselves right merely through good works.',
    'Jesus Christ — He came into the world, died for our sins, and rose again.',
    'Grace — Salvation is God’s gift; it cannot be earned.',
    'Response — People are invited to repent and place faith in Jesus as Lord and Savior.',
    'New life — Following Jesus is the beginning of a life of knowing and following Him.',
  ],
  helpGuideTitle: 'Help Someone',
  helpGuideIntro:
    'The goal is not to win an argument. Listen first, understand, ask permission, and be clear when sharing the Christian Gospel.',
  helpSteps: [
    {
      title: '1. Listen',
      body: 'Ask: “What feels heaviest for you right now?” Do not begin with a sermon.',
    },
    {
      title: '2. Understand',
      body: 'Listen for fear, guilt, family, loneliness, failure, death, purpose, or a faith question.',
    },
    {
      title: '3. Build a bridge',
      body: 'For example: “Would it be okay if I shared something that helped me understand hope differently?”',
    },
    {
      title: '4. Share the Gospel',
      body: 'Keep it clear and human: God, sin, Jesus, grace, response, and new life.',
    },
    {
      title: '5. Respect the response',
      body: 'If they are interested, continue. If they have questions, listen. If they are not ready, respect that without pressure.',
    },
  ],
};

export function getBuklodLifeCopy(
  language: BuklodLifeLanguage,
): BuklodLifeCopy {
  return language === 'fil' ? FIL : EN;
}

export function getBuklodLifeWallCopy(
  language: BuklodLifeLanguage,
) {
  const copy = getBuklodLifeCopy(language);

  return {
    title: 'LIFE',
    subtitle: copy.brandSubtitle,
    body: copy.brandLine,
    cta: language === 'fil' ? 'Tuklasin' : 'Explore',
  };
}
