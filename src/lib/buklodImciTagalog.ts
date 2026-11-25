/**
 * Educational, Tagalog caregiver prompts informed by WHO IMCI and the Philippine
 * IMCI chart (PH version, January 2015). These are NOT automated clinical
 * classifications, diagnostic criteria or treatment rules. Local clinician
 * chart edition and assessment remain authoritative.
 *
 * No persistence, analytics, remote calls or identifiers. Callers keep answers
 * only in transient component state.
 */
export type ImciAge = 'young_infant' | 'child' | 'older';
export type ImciAnswer = 'yes' | 'no' | 'unsure';
export type ImciLevel = 'danger' | 'priority' | 'information';

export type ImciQuestion = {
  id: string;
  question: string;
  explanation: string;
  level: ImciLevel;
  topic?: string;
};

const INFANT: ImciQuestion[] = [
  { id: 'infant_feed', level: 'danger', question: 'Nahihirapan bang dumede o hindi makasuso nang maayos ang sanggol?', explanation: 'Para sa sanggol na wala pang 2 buwan, mahalagang masuri agad ang pagbabago sa pagdede.' },
  { id: 'infant_seizure', level: 'danger', question: 'Nagkaroon ba ng kombulsyon o pangingisay?', explanation: 'Kahit huminto na ang pangingisay, kailangan ng agarang medikal na tulong.' },
  { id: 'infant_breath', level: 'danger', question: 'Mahirap o napakabilis ba ang paghinga, o malalim na lumulubog ang dibdib?', explanation: 'Huwag maghintay na matapos ang gabay kung may hirap sa paghinga.' },
  { id: 'infant_temp', level: 'danger', question: 'May lagnat ba, sobrang init, o hindi karaniwang malamig ang katawan?', explanation: 'Ang lagnat o mababang temperatura sa batang wala pang 2 buwan ay kailangang masuri agad.' },
  { id: 'infant_response', level: 'danger', question: 'Halos hindi ba gumagalaw, napakahina, o mahirap gisingin ang sanggol?', explanation: 'Hindi normal ang kawalan ng reaksyon o halos walang galaw.' },
  { id: 'infant_yellow', level: 'danger', question: 'Nanilaw ba sa unang 24 oras mula kapanganakan, o naninilaw ang palad o talampakan?', explanation: 'Ang mga palatandaang ito ay kailangang matingnan agad sa ospital.' },
  { id: 'infant_stool', level: 'priority', question: 'May pagtatae ba o napansin ang pagbabago sa pagdumi?', explanation: 'Ipatingin ang sanggol sa health worker; huwag magbigay ng gamot nang walang payo.' },
  { id: 'infant_jaundice', level: 'priority', question: 'Nanilaw ba ang balat o mata ng sanggol matapos ang unang araw?', explanation: 'Ipasuri ang paninilaw sa health professional; lalo nang huwag maghintay kung lumalala.' },
  { id: 'infant_navel', level: 'priority', question: 'May nana o pamumula ba sa pusod, o may mga pigsa o pantal na may nana?', explanation: 'Maaaring kailanganin ng medikal na pagsusuri ang posibleng impeksiyon.' },
  { id: 'infant_feeding', level: 'information', question: 'May tanong ka ba tungkol sa pagpapasuso, timbang, o iskedyul ng bakuna?', explanation: 'Maaaring humingi ng tulong sa midwife, nurse, o doktor.' },
  { id: 'infant_umbilical_discharge', topic: "Posibleng impeksiyon", level: 'priority', question: "May paglabas ba ng nana sa pusod o lumalaking pamumula sa paligid nito?", explanation: "Kailangang matingnan sa health facility; agarang referral kung may lagnat o pananamlay." },
  { id: 'infant_skin_pustules', topic: "Posibleng impeksiyon", level: 'priority', question: "May malalaking o maraming butlig na may nana sa balat?", explanation: "Masuri ang impeksiyon sa bata." },
  { id: 'infant_eyes', topic: "Ibang sintomas", level: 'priority', question: "May pamamaga o nana sa mata?", explanation: "Ipa-check ang mata sa health professional." },
  { id: 'infant_vomiting', topic: "Pagkain", level: 'priority', question: "Madalas ba ang pagsuka o may pagbabago sa normal na pagdede?", explanation: "Magpa-assess lalo na kung nauubusan ng ihi o hirap dumede." },
  { id: 'infant_urine', topic: "Pagdede at tubig sa katawan", level: 'priority', question: "Kapansin-pansin bang mas kakaunti ang basang lampin o ihi kaysa karaniwan?", explanation: "Kailangang masuri ang feeding at hydration." },
  { id: 'infant_weight', topic: "Paglaki", level: 'information', question: "May alalahanin ba sa pagdagdag ng timbang o naitalang mababang timbang?", explanation: "Dalhin ang timbang/growth record sa clinician." },
  { id: 'infant_feeding_support', topic: "Pagdede", level: 'information', question: "Kailangan ba ng tulong sa wastong latch, dalas ng breastfeeding, o feeding support?", explanation: "Humingi ng counseling sa trained health worker." },
  { id: 'infant_postnatal', topic: "Follow-up", level: 'information', question: "Kailangan ba ng newborn checkup, postnatal follow-up, o bakuna?", explanation: "Magpa-schedule sa primary care clinic." },
];

const CHILD: ImciQuestion[] = [
  { id: 'child_drink', level: 'danger', question: 'Hindi ba makainom o makasuso ang bata?', explanation: 'Isang pangkalahatang danger sign sa IMCI para sa batang 2 buwan hanggang wala pang 5 taon.' },
  { id: 'child_vomit', level: 'danger', question: 'Isinusuka ba ang lahat ng iniinom o kinakain?', explanation: 'Kung walang naiiwang inumin, kailangan ng agarang pagsusuri.' },
  { id: 'child_seizure', level: 'danger', question: 'Nagkaroon ba ng kombulsyon o pangingisay habang may sakit?', explanation: 'Kahit huminto ang pangingisay, kailangang magpatingin agad.' },
  { id: 'child_response', level: 'danger', question: 'Napakahina, hindi karaniwang inaantok, mahirap gisingin, o walang malay?', explanation: 'Ang pagbabago sa kamalayan ay isang danger sign.' },
  { id: 'child_breath', level: 'danger', question: 'May matinding hirap sa paghinga, malalim na pag-urong ng dibdib, o maingay na paghinga kahit kalmado?', explanation: 'Huwag hintayin ang iba pang tanong kung hirap huminga ang bata.' },
  { id: 'child_cough', level: 'priority', question: 'May ubo ba o hindi pangkaraniwang bilis ng paghinga?', explanation: 'Ipa-check ang paghinga sa health worker, lalo na kung tumatagal o lumalala ang ubo.' },
  { id: 'child_diarrhea', level: 'priority', question: 'May pagtatae ba, lalo na kung umuunti ang ihi o hirap uminom?', explanation: 'Suriin ng health worker ang posibleng dehydration; huwag ipagpaliban kung lumalala.' },
  { id: 'child_blood', level: 'priority', question: 'May dugo ba sa dumi?', explanation: 'Kailangang suriin ng health professional sa lalong madaling panahon.' },
  { id: 'child_fever', level: 'priority', question: 'May lagnat ba o pabalik-balik na mainit ang katawan?', explanation: 'Mahalaga ang tagal ng lagnat at ibang sintomas; kumonsulta kung may sakit ang bata.' },
  { id: 'child_ear', level: 'priority', question: 'Masakit ba ang tainga o may lumalabas na likido o nana?', explanation: 'Ipatingin para masuri ang tainga.' },
  { id: 'child_rash', level: 'priority', question: 'May pantal ba na kasabay ng lagnat, o kakaibang pamumutla?', explanation: 'Ipatingin para masuri ang ibang dahilan ng sintomas at posibleng anemia o impeksiyon.' },
  { id: 'child_growth', level: 'information', question: 'May alalahanin ba sa pagkain, paglaki, o timbang?', explanation: 'Maaaring ipasuri ang nutrisyon at growth chart.' },
  { id: 'child_vaccine', level: 'information', question: 'May tanong ba tungkol sa bakuna o vitamin supplements?', explanation: 'Dalhin ang child health record sa barangay health center.' },
  { id: 'child_noisy_breath', topic: "Paghinga", level: 'priority', question: "May kakaibang ingay sa paghinga kahit nakapahinga?", explanation: "Kailangan ng pisikal na pag-assess ng paghinga." },
  { id: 'child_long_cough', topic: "Paghinga", level: 'priority', question: "Mahigit dalawang linggo na bang may ubo o hirap sa paghinga?", explanation: "Ipatingin ang tagal ng sintomas at posibleng exposure." },
  { id: 'child_long_diarrhea', topic: "Pagtatae", level: 'priority', question: "May pagtatae bang tumatagal nang dalawang linggo o higit pa?", explanation: "Kailangan ng pagsusuri; huwag basta mag-self-medicate." },
  { id: 'child_repeated_vomiting', topic: "Pagtatae / pagkain", level: 'priority', question: "Madalas bang sumusuka kasabay ng pagtatae o hirap uminom?", explanation: "Posibleng dehydration; kung lahat ng iniinom ay isinusuka, emergency." },
  { id: 'child_long_fever', topic: "Lagnat", level: 'priority', question: "Umuulit o tumatagal ba ang lagnat nang higit sa karaniwan?", explanation: "Ipatingin sa clinician upang matukoy ang naaangkop na assessment." },
  { id: 'child_rash_measles', topic: "Lagnat at pantal", level: 'priority', question: "May lagnat at malawakang pantal, pamumula ng mata, o sipon?", explanation: "Kumonsulta agad at ipaalam ang sintomas bago pumasok sa clinic." },
  { id: 'child_ear_swelling', topic: "Tainga", level: 'priority', question: "May pamamaga o matinding sakit sa likod ng tainga?", explanation: "Ipa-assess agad, mas mainam sa araw na ito." },
  { id: 'child_ear_duration', topic: "Tainga", level: 'priority', question: "May matagal na paglabas ng likido o nana sa tainga?", explanation: "Ipa-check ang tainga at tagal ng paglabas." },
  { id: 'child_both_feet_swollen', topic: "Nutrisyon", level: 'priority', question: "Kapansin-pansin bang namamaga ang magkabilang paa o may matinding pagpayat?", explanation: "Kailangan ng agarang assessment ng nutrisyon; huwag ipagpaliban." },
  { id: 'child_pallor', topic: "Anemia / nutrisyon", level: 'priority', question: "Napakaputla ba ng palad o kapansin-pansing maputla ang bata?", explanation: "Maaaring kailangan ng pagsusuri para sa anemia o iba pang dahilan." },
  { id: 'child_feeding_problem', topic: "Feeding", level: 'information', question: "May problema sa dami, dalas, o kalidad ng pagkain at pag-inom?", explanation: "Maaaring humingi ng individualized nutrition counseling." },
  { id: 'child_growth_chart', topic: "Paglaki", level: 'information', question: "May growth monitoring record ba na kailangan ipa-review?", explanation: "Dalhin ang updated growth chart sa health center." },
  { id: 'child_immunization_gap', topic: "Bakuna", level: 'information', question: "May hindi tiyak o posibleng naantalang bakuna ayon sa vaccination card?", explanation: "Ipa-check ang record sa immunization center." },
  { id: 'child_followup', topic: "Follow-up", level: 'information', question: "May nagdaang gamutan o dating sakit na kailangan ng follow-up?", explanation: "Dalhin ang medical records at follow-up instructions." },
];

const OLDER: ImciQuestion[] = [
  { id: 'older_response', level: 'danger', question: 'May kombulsyon, pagkawala ng malay, o mahirap bang gisingin?', explanation: 'Humingi ng agarang medikal na tulong.' },
  { id: 'older_breath', level: 'danger', question: 'May matinding hirap sa paghinga o paninikip ng dibdib?', explanation: 'Maaaring emergency ito; humingi agad ng tulong.' },
  { id: 'older_drink', level: 'danger', question: 'Hindi ba makainom o tuloy-tuloy na isinusuka ang lahat ng iniinom?', explanation: 'Kailangan ng agarang pagsusuri kung hindi makainom.' },
  { id: 'older_concern', level: 'priority', question: 'May lagnat, pananakit, pagtatae, o ibang sintomas na ikinababahala?', explanation: 'Ang batang 5 taong gulang pataas ay nangangailangan ng age-appropriate assessment, hindi under-five IMCI classification.' },
];

export const IMCI_AGE_OPTIONS: {id: ImciAge; label: string; subtitle: string}[] = [
  { id: 'young_infant', label: 'Wala pang 2 buwan', subtitle: 'Bagong silang hanggang 59 araw' },
  { id: 'child', label: '2 buwan–wala pang 5 taon', subtitle: 'IMCI para sa batang wala pang 5 taong gulang' },
  { id: 'older', label: '5 taon pataas', subtitle: 'Pangkalahatang safety check, hindi under-five IMCI' },
];

export function getImciQuestions(age: ImciAge): ImciQuestion[] {
  return age === 'young_infant' ? INFANT : age === 'child' ? CHILD : OLDER;
}

export function getImciOutcome(age: ImciAge, answers: Readonly<Record<string, ImciAnswer>>): 'emergency' | 'consult' | 'review' {
  const questions = getImciQuestions(age);
  if (questions.some(q => q.level === 'danger' && (answers[q.id] === 'yes' || answers[q.id] === 'unsure'))) return 'emergency';
  if (questions.some(q => q.level === 'priority' && (answers[q.id] === 'yes' || answers[q.id] === 'unsure'))) return 'consult';
  return 'review';
}

export const IMCI_PHL_REFERENCE = 'https://platform.who.int/docs/default-source/mca-documents/policy-documents/operational-guidance/PHL-MN-62-01-OPERATIONALGUIDANCE-2015-eng-IMCI-Children-2m-5yrs.pdf';
export const IMCI_WHO_REFERENCE = 'https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/child-health/integrated-management-of-childhood-illness/';
