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
