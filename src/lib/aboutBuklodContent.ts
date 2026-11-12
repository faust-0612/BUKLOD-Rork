/**
 * Public-facing, editorially reviewed founder story and reusable presentation copy.
 *
 * Keep verifiable biography separate from aspirations and interpretations.
 * Never imply undisclosed official partnerships, guaranteed income, or ministry
 * ownership of the founder's commercial activities.
 */
export const BUKLOD_FOUNDER = {
  name: 'Faustino Jr. M. Gabut',
  roles: 'Founder & Developer of BUKLOD • Registered Nurse • Educator • Mission Director',
  descriptor: 'Isang buhay ng pagkatuto, paglilingkod, at pagbuo ng mga tulay sa pagitan ng mga tao.',
  introduction:
    'Lumaki sa Sta. Ines, Tanay, Rizal, at naging Registered Nurse noong 2010. Sa paglilingkod sa mga komunidad, pagtuturo, at gawaing misyon, nakita niya kung gaano kahalaga ang pagkakataong marinig, maturuan, at masuportahan ang bawat tao.',
  story: [
    'Nagsimula ang kaniyang propesyonal na paglalakbay sa nursing at community health. Mula sa health education at pagbisita sa mga liblib na pamayanan hanggang sa pagtuturo, naging malinaw ang isang aral: ang pinakamakabuluhang kaalaman ay yaong nakararating sa taong nangangailangan nito.',
    'Sa paglilingkod bilang Mission Director ng MZB Ministry Inc., lalo niyang nakita ang halaga ng pagtutulungan, malasakit, responsableng pamumuno, at ugnayan ng iba’t ibang komunidad.',
    'Mula rito ay binuo niya ang BUKLOD: isang platapormang naglalayong gawing mas kapaki-pakinabang, makabuluhan, at magkakaugnay ang digital na buhay. Hindi lamang isang lugar para mag-post, kundi isang puwang para sa pagkatuto, paglikha, pakikipag-usap, at sama-samang pagkilos.',
    'Kasabay ng teknolohiya ay patuloy ang kaniyang interes sa edukasyon, community development, at malikhaing panitikan, kabilang ang orihinal na kuwentong Kabihasnang Ligaw.',
    'Malawak ang mga pangarap para sa komunidad, ngunit simple ang hinahangad na personal na buhay: sapat na panahon para sa pamilya, pag-aaral, pananampalataya, at paglilingkod. Para sa kaniya, ang tagumpay ay hindi lamang kung gaano kalayo ang narating mo, kundi kung ilang tao ang natulungan mong makasulong.',
  ],
  message:
    'Hindi ko nais na magkaroon lamang tayo ng isa pang app. Nais kong makatulong sa pagbuo ng isang komunidad kung saan may lugar ang bawat isa, may saysay ang pakikilahok, at may pagkakataong tumulong at matulungan.',
} as const;

export const BUKLOD_PRINCIPLES = [
  { title: 'Paglilingkod bago pagkilala', detail: 'Ang posisyon ay pananagutan. Mas mahalaga ang epekto sa buhay ng tao kaysa sa pangalan o titulo.' },
  { title: 'Pagkatuto na nagiging aksiyon', detail: 'Hindi sapat ang kaalaman kung hindi ito naibabahagi at nagagamit upang mapabuti ang buhay ng iba.' },
  { title: 'Katotohanan at pananagutan', detail: 'Ang tiwala ay binubuo sa malinaw na salita, tapat na pangako, at pag-ako sa mga pagkukulang.' },
  { title: 'Pagkakaisa nang may pagkakaiba', detail: 'Hindi kailangang magkapareho ang lahat para makinig, magtulungan, at magkaroon ng iisang mabuting layunin.' },
  { title: 'Pangarap na may disiplina', detail: 'Ang malalaking adhikain ay kailangang samahan ng matiyagang paggawa, pag-aayos, at patuloy na pagpapahusay.' },
  { title: 'Pamilya at simpleng pamumuhay', detail: 'Ang tagumpay ay dapat magbigay ng puwang sa mga mahal sa buhay, kapahingahan, at mga bagay na may tunay na halaga.' },
] as const;

export const BUKLOD_VISIONS = [
  {
    title: 'Isang komunidad na may saysay',
    body: 'Isang digital na espasyo kung saan ang pakikipag-ugnayan ay may kasamang pagkatuto, pakikipagtulungan, at pagdamay.',
  },
  {
    title: 'Mas maraming pagkakataon para sa lahat',
    body: 'Mas madaling makaugnay ang mga paaralan, simbahan, organisasyon, at lokal na pamayanan para sa magkakatuwang na proyekto.',
  },
  {
    title: 'Teknolohiyang malapit sa tao',
    body: 'Isang produktong patuloy na pinapahusay para sa tunay na pangangailangan, kabilang ang abot-kayang pag-access at mas ligtas na pakikilahok.',
  },
] as const;

export type BuklodAudience = 'church' | 'faith' | 'school' | 'organization' | 'business' | 'public';

export type BuklodPitch = {
  key: BuklodAudience;
  name: string;
  need: string;
  opener: string;
  shortTalk: string;
  fullTalk: string;
  demo: readonly string[];
  questions: readonly string[];
  close: string;
};

export const BUKLOD_PITCHES: readonly BuklodPitch[] = [
  {
    key: 'church',
    name: 'Christ-centered Church',
    need: 'Discipleship, announcements, youth/family engagement, fellowship, and ministry coordination.',
    opener: 'Paano kung mas madali nating mapanatili ang ugnayan ng mga kapatid kahit wala sila sa church building?',
    shortTalk: 'Ang BUKLOD ay isang community platform na dinisenyo para sa mas makabuluhang koneksiyon. Puwede nating ipakita kung paano magamit ang mga grupo, Connect, at faith-based content bilang tulong sa komunikasyon, pagkatuto, at pang-araw-araw na fellowship. Hindi nito papalitan ang simbahan; maaari itong maging karagdagang tulay sa pagitan ng mga tao.',
    fullTalk: 'Magandang araw po. Naniniwala ako na mahalaga ang personal na pagtitipon, ngunit mahalaga rin ang pag-aalaga sa relasyon ng mga tao sa pagitan ng mga pagtitipon. Binuo ko ang BUKLOD bilang isang espasyong may komunidad, pakikipag-ugnayan, at pagkatuto. Nais kong ipakita ang mga grupo, mensahe, at faith-content na maaari ninyong subukan. Magsimula tayo sa isang maliit na grupo, tanungin ang mga miyembro kung nakatutulong, at saka magpasya kung gusto ninyong palawakin. Walang kailangang pangakong hindi natin kayang tuparin.',
    demo: ['Buksan ang Home at ipakita ang nilalamang kasalukuyang available.', 'Ipakita ang Cluster o ang pinahihintulutang group workspace.', 'Ipakita ang Connect at isang totoong communication flow.', 'Kung available, ipakita ang Bible/Daily Reading o devotion content.'],
    questions: ['Anong communication gap ang pinakamahirap sa inyong ministry?', 'Mas kailangan ba ninyo ang youth engagement, discipleship, o announcements?'],
    close: 'Kung interesado kayo, subukan natin sa isang maliit na grupo at kunin ang tapat ninyong feedback.',
  },
  {
    key: 'faith',
    name: 'Other Faith Communities',
    need: 'Community communications, transparent purpose, and voluntary participation without misrepresenting beliefs.',
    opener: 'May paraan ba para mas mapadali ang komunikasyon ng inyong komunidad nang malinaw kung ano ang platform at saan ito nagmula?',
    shortTalk: 'Ang BUKLOD ay isang community app na may Christian roots at may general community features. Hindi kailangang magkapareho ang paniniwala para masuri kung kapaki-pakinabang ang mga tools nito. Ipapakita ko ang totoong functions, mga limitasyon, at kung ano ang opsyonal. Ang inyong sariling pagpapasya at kalayaan sa paniniwala ay igagalang.',
    fullTalk: 'Salamat sa oras. Bilang founder, mahalaga sa akin ang tapat na pagpapakilala: ang BUKLOD ay may pinagmulan sa Christian service, at may bahagi rin itong para sa mas pangkalahatang komunidad. Ang pag-uusap natin ay tungkol sa praktikal na komunikasyon at sama-samang gawain. Walang nakatagong requirement na magpalit ng paniniwala, walang pangakong kikita, at walang sapilitang kontribusyon. Maaari nating tingnan ang features na talagang angkop sa inyo, at malaya kayong magpasya.',
    demo: ['Ipakita ang Wall at general community sharing.', 'Ipakita ang Cluster o group communication.', 'Ipaliwanag ang privacy at user choice nang tapat.', 'Linawin kung aling content ang faith-specific at opsyonal.'],
    questions: ['Ano ang pinakamahalagang communication need ninyo?', 'Aling mga feature ang komportable kayong subukan?'],
    close: 'Maaari ninyong subukan ang general community features nang walang anumang nakatagong kondisyon.',
  },
  {
    key: 'school',
    name: 'School / Educators',
    need: 'Teacher–student communication, meaningful engagement, classroom support, quizzes, and learning activities.',
    opener: 'Paano kung may mas madaling paraan para manatiling connected ang guro at estudyante kahit tapos na ang klase?',
    shortTalk: 'Bilang isang guro, alam kong mahalaga ang malinaw na communication at mga gawain na madaling balikan. Sa BUKLOD, makikita ang community at learning-oriented features; maaari rin nating suriin ang Classroom, Quiz, at attendance tools kung enabled sa kasalukuyang deployment. Ang susi ay isang maliit na pilot at aktuwal na feedback ng guro at estudyante.',
    fullTalk: 'Magandang araw. Isa akong Registered Nurse at educator, kaya naiintindihan ko ang hamon ng pag-follow up, pakikipag-ugnayan, at pagbuo ng makabuluhang aktibidad. Gusto kong ipakita ang BUKLOD bilang posibleng dagdag na tulong, hindi awtomatikong kapalit ng inyong opisyal na learning management system. Susuriin natin nang live ang mga available na features, ang kailangan sa privacy at admin permissions, at kung may saysay ang isang pilot sa isang klase bago ito palawakin.',
    demo: ['Ipakita ang available na student/community dashboard.', 'Kung enabled, ipakita ang Classroom, Quiz, at attendance workflows.', 'Ipakita ang Connect para sa pinahihintulutang class discussion.', 'Ipaliwanag ang teacher controls at data/privacy review bago ang pilot.'],
    questions: ['Saan pinaka-maraming oras ang nauubos ng teachers?', 'Anong approval at student privacy requirements ang kailangan ninyo?'],
    close: 'Pumili tayo ng isang klase at isang malinaw na sukatan ng tagumpay bago mag-expand.',
  },
  {
    key: 'organization',
    name: 'Organizations / NGOs',
    need: 'Member coordination, organized updates, project participation, and community action.',
    opener: 'Paano natin masisigurong hindi lang nababasa ang announcement kundi may aktuwal na nagagawa ang komunidad?',
    shortTalk: 'Ang BUKLOD ay nakatuon sa pagpapalakas ng ugnayan at pakikilahok. Maipapakita rito ang Wall, group spaces, at Connect para makita kung makatutulong sa inyong updates at coordination. Maaari nating subukan sa isang team at alamin kung nakababawas ito ng kalituhan sa komunikasyon.',
    fullTalk: 'Ang isang organisasyon ay mas nagiging epektibo kapag madaling makinig, makibahagi, at kumilos ang mga miyembro. Ito ang problemang sinusubukang tugunan ng BUKLOD. Hindi ko ipapangakong lahat ng inyong proseso ay mayroon na agad sa app. Ipapakita ko ang kasalukuyang gumagana, ililista ang mga kailangang integrasyon, at magmumungkahi ng maliit na pilot para masubukan ang tunay na pakinabang.',
    demo: ['Ipakita ang Wall o announcement post.', 'Ipakita ang Cluster/workspace kung enabled sa account.', 'Ipakita ang Connect para sa team conversation.', 'Tukuyin ang approval, privacy, at moderation process para sa pilot.'],
    questions: ['Saan nadedelay ang inyong koordinasyon?', 'Ilang miyembro at anong team ang angkop para sa pilot?'],
    close: 'Magsimula tayo sa isang project o team at sukatin ang aktuwal na engagement.',
  },
  {
    key: 'business',
    name: 'Businesses / Sponsors',
    need: 'Community awareness, appropriate promotion, sponsorship, and transparent commercial terms.',
    opener: 'Paano makikilala ang inyong negosyo ng isang komunidad sa paraang malinaw at kapaki-pakinabang?',
    shortTalk: 'May community and promotional opportunities na maaari nating pag-usapan sa BUKLOD, depende sa available at approved placements. Ipapakita ko ang user experience at ang proseso ng ad o sponsorship review. Hindi ako mangangako ng reach, benta, o income nang walang tunay na datos.',
    fullTalk: 'Ang layunin ng BUKLOD ay bumuo ng mas makahulugang community engagement. Kung nais ninyong mag-advertise o mag-sponsor, mahalaga ang angkop na audience, malinaw na terms, at moderation. Titingnan natin ang available placements, approval requirements, at current reporting. Anumang presyo, duration, at resulta ay kailangang maitala sa aktuwal na kasunduan; walang garantisadong benta o impression.',
    demo: ['Ipakita ang aktuwal na user journey sa Home/Wall.', 'Ipakita lang ang sponsorship/advertising flow kung available.', 'Ipaliwanag ang admin approval at content rules.', 'Tukuyin ang reporting at kasunduan bago tumanggap ng bayad.'],
    questions: ['Ano ang layunin ninyo: awareness, leads, o community support?', 'Anong creative assets at budget range ang handa ninyo?'],
    close: 'Kung akma, maghanda tayo ng malinaw na proposal na may terms at measurable goals.',
  },
  {
    key: 'public',
    name: 'General Public / Friends',
    need: 'Meaningful social connections, sharing, learning, and a positive community experience.',
    opener: 'Gusto mo bang mas makabuluhan ang oras mo sa social media?',
    shortTalk: 'Subukan ang BUKLOD—isang social at community app kung saan puwedeng makipag-ugnayan, magbahagi, at makisali sa mga grupo at makabuluhang gawain. Hindi lang scroll; may oportunidad ding matuto, tumulong, at magkaroon ng bagong koneksiyon. Tingnan natin mismo sa app kung ano ang magagamit mo ngayon.',
    fullTalk: 'Alam natin kung gaano karaming oras ang nauubos sa social media. Ang tanong: may napapala ba tayong makabuluhan dito? Kaya ko binuo ang BUKLOD—para pagsamahin ang social sharing, community connections, at mas purposeful na pakikilahok. May mga feature itong patuloy na pinapahusay, kaya gusto kong ipakita sa iyo ang aktuwal na gumagana ngayon. Kung nagustuhan mo, puwede kang magsimula sa sarili mong profile at komunidad.',
    demo: ['Ipakita ang Home, Wall, at aktuwal na post.', 'Ipakita ang Cluster para sa mga grupong may iisang interes.', 'Ipakita ang Connect para sa pakikipag-usap.', 'Ipakita kung paano nagsisimula ang user at saan makikita ang privacy options.'],
    questions: ['Ano ang pinakaayaw mo sa social media ngayon?', 'Mas gusto mo bang makakilala, matuto, o makisali sa community?'],
    close: 'Buksan natin ang BUKLOD at subukan mo mismo: https://buklod.expo.app',
  },
];

export const BUKLOD_PRESENTATION_DISCLOSURE =
  'Ang BUKLOD ay may Christian roots at may pangkalahatang community features. Ang ilang function ay nakadepende sa account, permissions, at kasalukuyang release. Maaaring suportado ito ng ads at may hiwalay na approval at terms para sa sponsorship. Walang garantisadong kita, audience reach, o resulta. Ang anumang suporta sa ministry ay dapat malinaw, boluntaryo, at hiwalay sa commercial transaction.';

export function getBuklodPitch(key: BuklodAudience): BuklodPitch {
  return BUKLOD_PITCHES.find(item => item.key === key) ?? BUKLOD_PITCHES[0];
}

export function formatBuklodPitch(pitch: BuklodPitch): string {
  return [
    'BUKLOD • ' + pitch.name,
    '',
    'Opening:',
    pitch.opener,
    '',
    '30–45 second introduction:',
    pitch.shortTalk,
    '',
    'Full short talk:',
    pitch.fullTalk,
    '',
    'What to demonstrate:',
    ...pitch.demo.map((step, index) => String(index + 1) + '. ' + step),
    '',
    'Questions to ask:',
    ...pitch.questions.map(question => '• ' + question),
    '',
    'Next step:',
    pitch.close,
    '',
    BUKLOD_PRESENTATION_DISCLOSURE,
    '',
    'https://buklod.expo.app',
  ].join('\n');
}
