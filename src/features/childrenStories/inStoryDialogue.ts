/** Keep the Sunday School narrative inside the biblical scene.
 * Earlier dialogue packs sometimes contained a teacher–class Q&A which should
 * appear only in the separate discussion section, never in the story/TTS.
 * Cut before the FIRST classroom exchange while preserving the biblical
 * character dialogue that precedes it.
 */
export function inStoryOnly(scene: string, language: 'tl' | 'en'): string {
  const cue = language === 'tl'
    ? /(?:tanong|sagot|tugon|paliwanag|dagdag|usisa|sabi|wika|itinuro|ipinaliwanag|paalala|tinanong|sumagot)\s+(?:(?:ng|ni|nina)\s+)?(?:mga\s+)?(?:batang(?:\s+nakikinig(?:\s+sa\s+guro)?)?|bata|klase|guro|Liza)(?=\W|$)|(?:nagtanong|sumagot)\s+ang\s+(?:bata|klase)/i
    : /(?:a|the|a listening) (?:child|teacher|class|student)s?\s+(?:asks?|says?|replies?|answers?|explains?|wonders?|responds?|adds?|tells?)\b|(?:asks?|says?|replies?|answers?|explains?|wonders?|responds?|adds?|tells?)\s+(?:a|the)\s+(?:child|teacher|class|student)s?\b/i;
  const marker = cue.exec(scene);
  if (!marker) return scene.trim();
  const openingQuote = scene.lastIndexOf('“', marker.index);
  // Q&A starts with a quoted question; remove it, not just its attribution.
  const sentenceEnd = Math.max(
    scene.lastIndexOf('. ', marker.index),
    scene.lastIndexOf('! ', marker.index),
    scene.lastIndexOf('? ', marker.index),
  );
  const cut = openingQuote >= 0 && marker.index - openingQuote < 260
    ? openingQuote
    : Math.max(0, sentenceEnd + 2);
  return scene.slice(0, cut).trim();
}

/** Scripture-grounded, character-to-character paraphrases for the two reports
 * that exposed the unwanted classroom dialogue and other key examples.
 * Each array holds: first scene TL/EN, second scene TL/EN.
 * These are NOT quotations from a particular Bible translation.
 */
export const REVISED_BIBLICAL_SCENES: Record<string, readonly [string, string, string, string]> = {
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
