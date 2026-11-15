/** Keep the Sunday School narrative inside the biblical scene.
 * Earlier dialogue packs sometimes contained a teacher–class Q&A which should
 * appear only in the separate discussion section, never in the story/TTS.
 * Remove classroom exchanges sentence-by-sentence while retaining the
 * biblical scene before and after the interruption.
 */
export function inStoryOnly(scene: string, language: 'tl' | 'en'): string {
  const classroomCue = language === 'tl'
    ? /(?:tanong|sagot|tugon|paliwanag|dagdag|usisa|sabi|wika|itinuro|ipinaliwanag|paalala|tinanong|sumagot)\s+(?:(?:ng|ni|nina)\s+)?(?:mga\s+)?(?:batang(?:\s+nakikinig(?:\s+sa\s+guro)?)?|bata|klase|guro|Liza)(?=\W|$)|(?:nagtanong|sumagot)\s+ang\s+(?:bata|klase)/i
    : /(?:a|the|a listening) (?:child|teacher|class|student)s?\s+(?:asks?|says?|replies?|answers?|explains?|wonders?|responds?|adds?|tells?)\b|(?:asks?|says?|replies?|answers?|explains?|wonders?|responds?|adds?|tells?)\s+(?:a|the)\s+(?:child|teacher|class|student)s?\b/i;
  // Remove only classroom remarks, retaining later biblical events. The
  // closing quote is part of the sentence, not the whitespace separator.
  // Walk punctuation boundaries without RegExp lookbehind (Android Hermes
  // compatibility). Keep quoted dialogue intact, including closing marks.
  const sentences: string[] = [];
  let start = 0;
  for (let i = 1; i < scene.length - 1; i++) {
    if (!/\s/.test(scene[i])) continue;
    const before = scene[i - 1] === '”' ? scene[i - 2] : scene[i - 1];
    if (!before || !'.!?'.includes(before)) continue;
    let next = i + 1;
    while (next < scene.length && /\s/.test(scene[next])) next++;
    if (!/[A-ZÁÉÍÓÚÑ“]/u.test(scene[next] ?? '')) continue;
    sentences.push(scene.slice(start, i).trim());
    start = next;
    i = next - 1;
  }
  sentences.push(scene.slice(start).trim());
  let result = sentences.filter(sentence => !classroomCue.test(sentence)).join(' ').trim();
  // A two-line exchange can leave an orphaned quotation mark when just the
  // teacher's sentence was removed. Do not expose malformed speech.
  const count = (char: string) => result.split(char).length - 1;
  if (count('”') > count('“')) result = result.replace(/”\s*$/, '');
  if (count('“') > count('”')) result = result.replace(/^“/, '');
  return result.trim();
}


/** Scripture-grounded, character-to-character paraphrases for the two reports
 * that exposed the unwanted classroom dialogue and other key examples.
 * Each array holds: first scene TL/EN, second scene TL/EN.
 * These are NOT quotations from a particular Bible translation.
 */
export const REVISED_BIBLICAL_SCENES: Record<string, readonly [string, string, string, string]> = {
  'abraham-tawag': [
    'Sinabi ng Diyos kay Abram sa diwa ng Genesis 12: “Umalis ka sa iyong lupain, sa iyong mga kamag-anak, at sa sambahayan ng iyong ama. Pumunta ka sa lupang ipapakita Ko sa iyo. Gagawin kitang isang malaking bayan at pagpapalain kita.” Hindi ibinigay sa kaniya ang bawat detalye ng daan. Tinipon ni Abram ang mga kasamang maglalakbay, kasama si Sarai at ang kaniyang pamangking si Lot, at iniwan ang nakasanayang tahanan.',
    'In this paraphrase of Genesis 12, God told Abram: “Leave your country, your relatives, and your father’s household. Go to the land I will show you. I will make you into a great nation and bless you.” God did not give Abram every detail of the road ahead. Abram gathered his household, including Sarai and his nephew Lot, and left the familiar place where they had lived.',
    'Pagdating sa Canaan, nagpakita ang Diyos kay Abram at nangako, sa diwa ng Genesis 12, na ibibigay ang lupaing iyon sa kaniyang magiging lahi. Nagtayo si Abram ng altar bilang tugon sa pangakong narinig. Habang nagpapatuloy siya sa paglalakbay, nagtayo rin siya ng mga tolda at sumamba sa Panginoon. Hindi niya kailangang mag-imbento ng sarili niyang kasagutan upang magtiwala; pinanghawakan niya ang sinabi ng Diyos.',
    'When Abram reached Canaan, God appeared to him and promised, in the sense of Genesis 12, that the land would be given to his descendants. Abram built an altar in response to the promise. He continued traveling, setting up tents and worshiping the Lord along the way. His story does not record a speech in which he claims to know the future; it shows him responding through action.',
  ],
  'joseph-panaginip-bethlehem': [
    'Habang pinag-iisipan ni Jose kung paano haharapin ang kalagayan ni Maria, nagpakita sa kaniya ang anghel ng Panginoon sa panaginip. Sinabi ng anghel sa diwa ng Mateo 1: “Jose, anak ni David, huwag kang matakot na tanggapin si Maria bilang asawa. Ang sanggol na dinadala niya ay mula sa Espiritu Santo. Isisilang niya ang isang anak na lalaki, at Jesus ang ipapangalan mo sa Kaniya.” Ang mensahe ay hindi simpleng aliw lamang; may ipinagkatiwalang pananagutan kay Jose.',
    'While Joseph considered how to respond to Mary’s situation, an angel of the Lord appeared to him in a dream. In this paraphrase of Matthew 1, the angel said: “Joseph, son of David, do not be afraid to take Mary as your wife. The child she carries is from the Holy Spirit. She will bear a son, and you are to name Him Jesus.” The message was both reassurance and a serious responsibility entrusted to Joseph.',
    'Nang magising si Jose, ginawa niya ang ipinag-utos ng anghel at tinanggap si Maria bilang kaniyang asawa. Hindi itinala ng Ebanghelyo ni Mateo ang kaniyang sinabi nang magising; ang mahalaga sa salaysay ay ang kaniyang ginawa. Pinangalanan niya ang sanggol na Jesus ayon sa ibinigay na tagubilin. Sa gitna ng isang mahirap na kalagayan, inuna niya ang maingat at tapat na pananagutan.',
    'When Joseph awoke, he did as the angel directed and took Mary as his wife. Matthew does not record words Joseph spoke on waking; the account tells us what he did. He named the child Jesus as instructed. In a situation that must have required careful thought, Joseph’s response is shown through responsible action rather than through an invented conversation.',
  ],
  'kapanganakan-hesus': [
    'Naglakbay sina Jose at Maria patungong Bethlehem dahil sa utos na magparehistro. Nasa huling bahagi na ng pagdadalantao ni Maria. Inilalarawan ng Lucas 2 ang pagdating nila sa bayan at ang kakulangan ng angkop na matutuluyan. Walang naitalang usapan ng isang may-ari ng bahay-panuluyan o palitan ng salita nina Maria at Jose sa tagpong ito, kaya ang pagsasalaysay ay nakatuon sa mga nangyari.',
    'Joseph and Mary traveled to Bethlehem because of the order to register. Mary was expecting her child, and the journey brought them to the town of David. Luke 2 describes the circumstances of their arrival but does not record a conversation with an innkeeper or words exchanged between Mary and Joseph during the birth. The narrative stays with what the Gospel actually tells us happened.',
    'Dumating ang panahon ng panganganak ni Maria habang nasa Bethlehem sila. Isinilang niya ang kaniyang panganay na anak, binalot sa tela, at inihiga sa sabsaban dahil walang lugar para sa kanila sa karaniwang silid. Walang palasyo, marangyang silid, o magarbong pagtitipon na inilalarawan dito. Ang mismong pagdating ng sanggol na si Jesus ang sentro ng tagpo.',
    'While they were in Bethlehem, the time came for Mary to give birth. She bore her firstborn son, wrapped Him in cloths, and placed Him in a manger because there was no room for them in the guest space. The Gospel does not describe a royal palace, a lavish nursery, or a dramatic conversation at the doorway. The birth of Jesus Himself is at the center of the scene.',
  ],
  'samson': [
    'Sa mga pangyayari sa Hukom 16, paulit-ulit na hinikayat ni Delilah si Samson na sabihin ang lihim ng kaniyang pambihirang lakas. Sa pagsasalaysay, tinanong niya kung paano siya maaaring igapos. Sa una ay hindi nagbigay ng tapat na sagot si Samson. Ngunit sa bandang huli ay sinabi niya ang tungkol sa kaniyang buhok, na kaugnay ng pagkakatalaga niya sa Diyos mula pagkabata.',
    'In Judges 16, Delilah repeatedly pressed Samson to tell her the secret of his unusual strength. She asked how he might be restrained. At first he did not give her a truthful answer. Eventually he told her about his uncut hair, connected to the special dedication of his life to God from childhood. That trust was betrayed, and his captors took away his freedom.',
    'Nang maging bihag na si Samson, naranasan niya ang bigat ng kaniyang mga pagkakamali. Sa huling bahagi ng salaysay, nanalangin siya sa Diyos, sa diwa ng Hukom 16: “Panginoong Diyos, alalahanin Mo ako at bigyan Mo pa ako ng lakas.” Hindi ipinapakita ng kuwento na sapat ang lakas upang maitama ang bawat maling pasiya; inilalarawan din nito ang pagdurusa at pananagutan.',
    'As a captive, Samson experienced the terrible consequences of his choices. In the last part of the account, he prayed to God, in the sense of Judges 16: “Lord God, remember me and give me strength once more.” The story does not suggest that physical power can undo every harmful decision. It also shows loss, suffering, and the seriousness of how strength is used.',
  ],
  'abraham-bituin': [
    'Isang gabi, dinala ng Diyos si Abram sa labas at itinuro ang malawak na langit. Bago iyon, ipinahayag ni Abram ang kaniyang pangamba: “Panginoong Diyos, ano po ang maibibigay Mo sa akin gayong wala pa akong anak?” Sa diwa ng Genesis 15, tiniyak ng Diyos na magmumula sa kaniya ang kaniyang magiging tagapagmana. “Tumingala ka at subukan mong bilangin ang mga bituin,” sabi ng Diyos sa pagsasalaysay. “Ganyan karami ang magiging lahi mo.” Hindi mabilang ni Abram ang mga bituin, ngunit pinaniwalaan niya ang pangako ng Diyos kahit hindi pa niya nakikita ang katuparan.',
    'One night, God led Abram outside and directed his eyes toward the vast sky. Earlier Abram had voiced his worry: “Lord God, what can You give me when I still have no child?” In this paraphrase of Genesis 15, God assured him that his heir would come from his own family. “Look up and try to count the stars,” God told him in the retelling. “That is how numerous your descendants will be.” Abram could not count the stars, yet he trusted the promise even before he could see its fulfillment.',
    'Makalipas ang maraming taon, muli silang nangusap tungkol sa pangako. Ayon sa Genesis 17, sinabi ng Diyos kay Abraham na si Sara mismo ang magkakaanak at na Isaac ang magiging pangalan ng kanilang anak. Hindi naitago ni Abraham ang kaniyang pagtataka; napaluhod siya at natawa sa bigat ng balita. Nang maisilang si Isaac, nagpahayag din si Sara ng kagalakan. Sa diwa ng Genesis 21, sinabi niya, “Binigyan ako ng Diyos ng dahilan upang tumawa, at makikigalak ang makakarinig ng nangyari.” Ang batang matagal nilang hinintay ay naroon na sa kanilang piling.',
    'Many years later, the promise was renewed. In Genesis 17 God told Abraham that Sarah herself would bear a son and that the child would be named Isaac. Abraham was astonished; he bowed down and laughed at the extraordinary news. When Isaac was finally born, Sarah also expressed joy. In this paraphrase of Genesis 21 she said, “God has given me a reason to laugh, and everyone who hears will rejoice with me.” The child for whom they had waited so long was finally in their arms.',
  ],
  'joseph-panaginip': [
    'Isang araw, nagkuwento si Jose sa kaniyang mga kapatid tungkol sa unang panaginip niya. “Nasa bukid tayo at nagtatalian ng mga bigkis ng trigo,” sabi niya sa pagsasalaysay ng Genesis 37. “Tumayo ang aking bigkis, at ang mga bigkis ninyo ay lumapit at yumukod dito.” Hindi natuwa ang mga kapatid. “Ibig mo bang sabihing maghahari ka sa amin?” mariin nilang itinanong. Sa halip na mawala ang inggit, lalo silang nainis kay Jose dahil sa kaniyang sinabi at sa pagtatanging nakikita nila sa kanilang ama.',
    'One day Joseph told his brothers about his first dream. “We were out in the field binding sheaves of grain,” he said in this paraphrase of Genesis 37. “My sheaf stood upright, while yours gathered around it and bowed down.” His brothers were not pleased. “Do you really think you will rule over us?” they asked sharply. Instead of easing the jealousy, Joseph’s words made the tension worse, especially because the brothers already felt their father favored him.',
    'May isa pang panaginip si Jose. “Nakita ko ang araw, ang buwan, at labing-isang bituin na yumuyukod sa akin,” ikinuwento niya sa pamilya. Narinig ito ni Jacob at pinagsabihan siya: “Ano ang ibig sabihin niyan? Tayo bang iyong ama, ina, at mga kapatid ay yuyukod sa iyo?” Hindi pa nauunawaan ni Jose ang lahat ng ipinahihiwatig ng mga panaginip. Nanatiling naiinggit ang kaniyang mga kapatid, ngunit iningatan ni Jacob sa kaniyang isip ang narinig. Hindi pa tapos ang kasaysayan ni Jose; marami pa siyang daraanang pagsubok bago maunawaan ng pamilya ang nangyari.',
    'Joseph had another dream. “I saw the sun, the moon, and eleven stars bowing down to me,” he told his family. Jacob heard and challenged him: “What is this dream? Are your father, mother, and brothers to bow before you?” Joseph did not yet understand all that his dreams would mean. His brothers remained jealous, but Jacob kept the matter in mind. Joseph’s story was far from finished; many trials lay ahead before his family would understand what had happened.',
  ],
  'joseph-patawad': [
    'Nang pumunta sa Egipto ang mga kapatid ni Jose upang bumili ng pagkain, humarap sila sa makapangyarihang tagapangasiwa nang hindi nakikilalang si Jose pala iyon. Kilala niya sila, ngunit hindi sila agad nakilala. Sa pagsasalaysay ng Genesis 42–44, nagtanong si Jose tungkol sa kanilang pamilya at nakinig sa mga sagot. Nang mabalitaan niyang buhay pa ang kaniyang ama at nakita niyang ipinag-aalala na nila ang bunso nilang kapatid, nakadama siya ng matinding damdamin. Sinubok niya kung tunay na nagbago ang kanilang pakikitungo sa isa’t isa bago niya ipinahayag kung sino siya.',
    'When Joseph’s brothers came to Egypt seeking food, they stood before a powerful official without recognizing that he was Joseph. He knew them, but they did not know him. In this retelling of Genesis 42–44, Joseph asked about their family and listened to their answers. Learning that his father was alive and seeing their concern for their youngest brother stirred deep feelings in him. He watched to see whether their care for one another had changed before revealing his identity.',
    'Sa wakas, hindi na napigilan ni Jose ang sarili. “Ako si Jose! Buhay pa ba ang aking ama?” pahayag niya sa diwa ng Genesis 45. Natakot at natigilan ang kaniyang mga kapatid. Ngunit sinabi niyang lumapit sila at ipinaliwanag niyang, sa kabila ng masamang ginawa nila, ginamit ng Diyos ang kaniyang pagdating sa Egipto upang mapanatiling buhay ang marami sa panahon ng taggutom. Nang maglaon, muling tiniyak ni Jose sa kanila, ayon sa Genesis 50: “Binalak ninyo akong saktan, ngunit ginamit ito ng Diyos para sa kabutihan at pagliligtas ng maraming buhay.” Nagpatuloy siyang maglaan ng pagkain at pangangalaga sa kanilang pamilya.',
    'At last Joseph could no longer contain his feelings. “I am Joseph! Is my father still alive?” he declared in this paraphrase of Genesis 45. His brothers froze in fear. Joseph invited them nearer and explained that, despite the wrong done to him, God had used his journey to Egypt to preserve lives during the famine. Later, in the sense of Genesis 50, he reassured them: “You intended to harm me, but God brought good from it and saved many lives.” He continued providing food and care for the family.',
  ],
};
