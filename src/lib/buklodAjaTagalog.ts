/** Original, caregiver/adolescent-facing questions based on AJA 2.0 themes.
 * Not an official AJA algorithm, professional tool, or clinical diagnosis.
 * Responses are held in React memory only; no analytics, network or persistence.
 */
export type AjaBand = "early" | "late";
export type AjaAnswer = "yes" | "no" | "unsure" | "skip";
export type AjaSeverity = "danger" | "consult" | "info";
export type AjaSection =
  | "Agad na kaligtasan" | "Kalusugan" | "Tahanan" | "Pag-aaral"
  | "Pagkain" | "Kaibigan at aktibidad" | "Substances"
  | "Pagdadalaga at pagbibinata" | "Emosyon" | "Kaligtasan";
export type AjaQuestion = {
  id: string;
  section: AjaSection;
  prompt: string;
  note: string;
  severity: AjaSeverity;
  sensitive?: boolean;
};
export const AJA_BANDS: { id: AjaBand; label: string }[] = [
  { id: "early", label: "10–14 taong gulang" },
  { id: "late", label: "15–19 taong gulang" },
];
// Core danger questions come first and cannot be skipped.
export const AJA_QUESTIONS: AjaQuestion[] = [
  { id: "consciousness", section: "Agad na kaligtasan", severity: "danger", prompt: "May matinding hirap sa paghinga, walang malay, o malubhang pinsala ngayon?", note: "Kung oo o hindi sigurado, tumawag sa 911 o pumunta sa emergency room." },
  { id: "imminent_selfharm", section: "Agad na kaligtasan", severity: "danger", sensitive: true, prompt: "Iniisip mo bang saktan ang iyong sarili ngayon, o may agarang panganib na magawa mo ito?", note: "Kung posibleng may agarang panganib, humingi ng tulong sa 911, emergency department at mapagkakatiwalaang taong kasama mo." },
  { id: "imminent_violence", section: "Agad na kaligtasan", severity: "danger", sensitive: true, prompt: "May taong nananakot o nananakit sa iyo ngayon, at hindi ka ligtas sa kinaroroonan mo?", note: "Lumipat sa ligtas na lugar kung maaari at humingi ng agarang tulong; hindi mo kailangang sagutin pa ang ibang tanong." },
  { id: "medical_concern", section: "Kalusugan", severity: "consult", prompt: "May sintomas, sakit, o problemang pangkalusugan na patuloy na lumalala o nakaaapekto sa araw-araw?", note: "Ipa-assess sa nurse, doktor, o adolescent-friendly health service." },
  { id: "sleep", section: "Kalusugan", severity: "consult", prompt: "Matagal na bang nahihirapang makatulog o sobrang inaantok at nahihirapang gumawa ng karaniwang gawain?", note: "Pwedeng kaugnay ito ng maraming dahilan; hindi ito diagnosis." },
  { id: "routine", section: "Kalusugan", severity: "info", prompt: "Gusto mo bang magtanong tungkol sa checkup, bakuna, paglaki, o pagdadalaga/pagbibinata?", note: "Maaaring pag-usapan sa adolescent health worker." },
  { id: "home", section: "Tahanan", severity: "consult", sensitive: true, prompt: "Madalas ka bang hindi panatag o walang mapagkakatiwalaang taong makausap sa bahay?", note: "Pwedeng humingi ng suporta sa pinagkakatiwalaang adult o professional." },
  { id: "home_violence", section: "Tahanan", severity: "consult", sensitive: true, prompt: "Nakakaranas ka ba ng pananakit, pananakot, o pamimilit sa bahay, kahit hindi ito nangyayari ngayon?", note: "Hindi kailangan magbigay ng pangalan o detalye rito. Humingi ng ligtas na suporta." },
  { id: "school", section: "Pag-aaral", severity: "consult", prompt: "Nahihirapan ka ba sa pag-aaral, trabaho, o attendance dahil sa stress o problema?", note: "Maaaring makatulong ang guidance counselor o health worker." },
  { id: "bullying", section: "Pag-aaral", severity: "consult", sensitive: true, prompt: "Nakakaranas ka ba ng bullying, panghihiya, o pang-aabuso sa paaralan o online?", note: "Hindi kailangan magbigay ng pagkakakilanlan o screenshots." },
  { id: "nutrition", section: "Pagkain", severity: "consult", prompt: "Madalas bang kapos ang pagkain o nahihirapan kang kumain nang sapat?", note: "Pwedeng tumulong ang health worker sa nutrisyon at access sa pagkain." },
  { id: "eating", section: "Pagkain", severity: "consult", sensitive: true, prompt: "May matinding pag-aalala sa timbang o mga nakasasamang gawi kaugnay ng pagkain?", note: "Kumonsulta sa professional; hindi ito pagsusuri ng eating disorder." },
  { id: "social", section: "Kaibigan at aktibidad", severity: "consult", prompt: "Madalas mo bang maramdamang nag-iisa ka o wala kang mapagkakatiwalaang kaibigan?", note: "May suportang maaaring makuha mula sa trusted adult o counselor." },
  { id: "activity", section: "Kaibigan at aktibidad", severity: "info", prompt: "Gusto mo bang pag-usapan ang ligtas na ehersisyo, online time, o pahinga?", note: "Pangkalahatang wellness at prevention topic." },
  { id: "pressure_substances", section: "Substances", severity: "consult", sensitive: true, prompt: "Napipilitan ka bang gumamit ng alak, sigarilyo, vape, o ibang substance?", note: "Maaaring humingi ng tulong nang walang paghusga." },
  { id: "substance_risk", section: "Substances", severity: "consult", sensitive: true, prompt: "May pag-inom o paggamit ba ng substance na ikinababahala mo o nakaaapekto sa iyong kalusugan?", note: "Kausapin ang trained health professional." },
  { id: "puberty", section: "Pagdadalaga at pagbibinata", severity: "info", sensitive: true, prompt: "May gusto ka bang itanong tungkol sa puberty, katawan, o reproductive health?", note: "Humingi ng age-appropriate, confidential na impormasyon sa health professional." },
  { id: "sexual_pressure", section: "Pagdadalaga at pagbibinata", severity: "consult", sensitive: true, prompt: "May nakaranas ka ba ng hindi gustong paghawak, pamimilit, o sexual violence?", note: "Hindi mo kailangang magpaliwanag dito. Humingi ng tulong sa trained professional; kapag nasa panganib ngayon, tumawag sa 911." },
  { id: "reproductive_concern", section: "Pagdadalaga at pagbibinata", severity: "consult", sensitive: true, prompt: "May concern ka ba tungkol sa menstruation, pregnancy, STI, o sexual health na gusto mong masuri?", note: "Makipag-ugnayan sa adolescent-friendly service; huwag mag-self-diagnose." },
  { id: "low_mood", section: "Emosyon", severity: "consult", sensitive: true, prompt: "Halos araw-araw ka bang nalulungkot, balisa, o walang gana sa loob ng ilang linggo?", note: "Kailangan ng maunawain at propesyonal na pakikinig, hindi diagnosis ng app." },
  { id: "past_selfharm", section: "Emosyon", severity: "consult", sensitive: true, prompt: "Nagkaroon ka ba dati ng pag-iisip o gawain na manakit ng sarili, kahit hindi ito agarang panganib ngayon?", note: "Mahalagang makausap ka ng trained professional; kung lumalapit ang panganib, dumiretso sa emergency care." },
  { id: "online_safety", section: "Kaligtasan", severity: "consult", sensitive: true, prompt: "May online harassment, pagbabanta, exploitation, o pressure na nakaaapekto sa iyong kaligtasan?", note: "Huwag mag-upload ng screenshots o sensitive details dito." },
  { id: "physical_safety", section: "Kaligtasan", severity: "consult", prompt: "Nababahala ka ba sa aksidente, pananakit, o panganib sa biyahe, bahay, o komunidad?", note: "Kausapin ang mapagkakatiwalaang adult at health/safety services." },
  { id: "private_support", section: "Kaligtasan", severity: "info", prompt: "Gusto mo bang malaman kung paano humingi ng pribadong payo sa adolescent-friendly health service?", note: "Maaaring ipaliwanag ng clinic ang confidentiality at mga legal na limitasyon nito." },
];
export const AJA_REFERENCE = "https://tciurbanhealth.org/wp-content/uploads/2024/04/15-AJA-2.0-HANDBOOK-2023.pdf";
export const WHO_ADOLESCENT_REFERENCE = "https://www.who.int/publications-detail-redirect/9789241599962";
export function ajaDisposition(answers: Record<string, AjaAnswer>): "emergency" | "consult" | "review" {
  if (AJA_QUESTIONS.some(q => q.severity === "danger" && (answers[q.id] === "yes" || answers[q.id] === "unsure"))) return "emergency";
  if (AJA_QUESTIONS.some(q => q.severity === "consult" && (answers[q.id] === "yes" || answers[q.id] === "unsure"))) return "consult";
  // Unanswered or intentionally undisclosed immediate safety questions cannot
  // produce a reassuring result.
  if (AJA_QUESTIONS.some(q => q.severity === "danger" && answers[q.id] !== "no")) return "consult";
  return "review";
}
export function ajaHandoffTopics(answers: Record<string, AjaAnswer>): string[] {
  const topics = new Set(AJA_QUESTIONS.filter(q => answers[q.id] === "yes" || answers[q.id] === "unsure").map(q => q.section));
  return [...topics];
}
