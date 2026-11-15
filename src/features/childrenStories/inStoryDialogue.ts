/** Keep the Sunday School narrative inside the biblical scene.
 * Earlier dialogue packs sometimes contained a teacher–class Q&A which should
 * appear only in the separate discussion section, never in the story/TTS.
 * Cut before the FIRST classroom exchange while preserving the biblical
 * character dialogue that precedes it.
 */
export function inStoryOnly(scene: string, language: 'tl' | 'en'): string {
  const classroomCue = language === 'tl'
    ? /(?:tanong|sagot|tugon|paliwanag|dagdag|usisa|sabi|wika|itinuro|ipinaliwanag|paalala|tinanong|sumagot)\s+(?:(?:ng|ni|nina)\s+)?(?:mga\s+)?(?:batang(?:\s+nakikinig(?:\s+sa\s+guro)?)?|bata|klase|guro|Liza)(?=\W|$)|(?:nagtanong|sumagot)\s+ang\s+(?:bata|klase)/i
    : /(?:a|the|a listening) (?:child|teacher|class|student)s?\s+(?:asks?|says?|replies?|answers?|explains?|wonders?|responds?|adds?|tells?)\b|(?:asks?|says?|replies?|answers?|explains?|wonders?|responds?|adds?|tells?)\s+(?:a|the)\s+(?:child|teacher|class|student)s?\b/i;
  // Remove only classroom remarks, retaining later biblical events. The
  // closing quote is part of the sentence, not the whitespace separator.
  const sentences = scene.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ“])|(?<=[.!?]”)\s+(?=[A-ZÁÉÍÓÚÑ“])/u);
  let result = sentences.filter(sentence => !classroomCue.test(sentence)).join(' ').trim();
  // A two-line exchange can leave an orphaned quotation mark when just the
  // teacher's sentence was removed. Do not expose malformed speech.
  const count = (char: string) => result.split(char).length - 1;
  if (count('”') > count('“')) result = result.replace(/”\s*$/, '');
  if (count('“') > count('”')) result = result.replace(/^“/, '');
  return result.trim();
}


/** Factual in-scene elaboration for passages that become too brief when
 * inappropriate classroom dialogue is removed. No fictional teacher speech.
 * These passages are pedagogical retellings, not verbatim Bible translations. */
export const BIBLICAL_SCENE_DETAILS: Record<string, {tl: string; en: string}> = {
  'sampung-utos': {
    tl: 'Sa Bundok Sinai, ipinahayag ang mga utos na gagabay sa buhay ng bayan. Kabilang dito ang katapatan sa Diyos, paggalang sa magulang, at pag-iwas sa pagnanakaw, pagsisinungaling, at pananakit. Hindi ito basta mga tuntuning isinulat lamang; bahagi ito ng tipang dapat nilang alalahanin sa pang-araw-araw.',
    en: 'At Mount Sinai, the people received commandments that would guide how they lived together. They were taught faithfulness to God, respect for parents, and the importance of rejecting theft, false witness, and violence. These words belonged to their covenant with God and were meant to shape everyday choices, not simply be remembered as a list of rules.',
  },
  'labindalawang-espiya': {
    tl: 'Dinala ng mga tagapagmasid ang mga bunga mula sa Canaan upang ipakita ang kasaganaan ng lupain. Ngunit nang ikuwento nila ang matatandang lungsod at malalakas na naninirahan doon, natakot ang karamihan. Sina Josue at Caleb ay nagpaalala na huwag basta talikuran ang ipinangakong paglalakbay.',
    en: 'The scouts returned carrying fruit from Canaan, evidence that the land was fertile. Their report also described fortified cities and powerful inhabitants, and fear spread through the camp. Joshua and Caleb urged the people not to abandon the journey because of that fear. The community had to decide whether to trust the promise they had received or surrender to discouragement.',
  },
  'samson': {
    tl: 'Si Samson ay may pambihirang lakas, ngunit hindi ito naging pananggalang sa kaniyang maling mga pasiya. Dahil sa pagtitiwala sa mga taong nanlinlang sa kaniya, siya ay nahuli at nawalan ng kalayaan. Sa bandang huli, nanalangin siya sa Diyos sa gitna ng kaniyang matinding paghihirap.',
    en: 'Samson had extraordinary strength, yet strength did not protect him from unwise choices. The story describes how deception and misplaced trust led to his capture, and how he lost the freedom he once had. He experienced suffering and isolation. In the final part of his life, he turned to God in prayer. It is a serious story about power, weakness, and the consequences of decisions, not a game about fighting.',
  },
  'ezekiel-buto': {
    tl: 'Sa pangitain, lumakad si Ezekiel sa isang lambak na puno ng tuyong mga buto. Inutusan siyang sabihin ang mensahe ng Diyos; nagsama-sama ang mga buto at nagkaroon ng laman. Nang dumating ang hininga ng buhay, naging larawan ito ng pag-asang muling ibibigay sa bayan.',
    en: 'In the vision, Ezekiel stood in a valley filled with dry bones, a picture of a people who had almost lost hope. God instructed him to speak to the bones, and they came together, forming bodies. Breath then entered them. The vision was explained as a promise that God had not forgotten His people, even though exile and loss had made them feel as hopeless as dried bones.',
  },
  'panalangin-ama': {
    tl: 'Itinuro ni Jesus na ang pananalangin ay hindi pagtatanghal upang hangaan ng iba. Maaaring lumapit ang tao sa Ama nang may katapatan at humingi ng pang-araw-araw na pagkain, kapatawaran, at tulong upang makaiwas sa kasamaan. Ang panalangin ay nagtuturo ring magpatawad sa kapwa.',
    en: 'Jesus taught His followers that prayer should not become a performance for public admiration. He invited them to address God as Father and to ask for daily bread, forgiveness, and help when facing temptation. They were also to remember the needs of others and to practice forgiveness themselves. The prayer offered a pattern for trusting God in ordinary daily life.',
  },
  'matalino-bahay': {
    tl: 'Inilarawan ni Jesus ang dalawang taong nagtayo ng bahay. Parehong dumating ang ulan, baha, at malakas na hangin, ngunit magkaiba ang kinalabasan dahil magkaiba ang pundasyon. Ginamit Niya ang tagpong ito upang ipakita ang kahalagahan ng pakikinig at pagsasabuhay ng mabuting aral.',
    en: 'Jesus told of two builders who made different choices about where to place their houses. Heavy rain fell, floods rose, and strong winds beat against both homes. The house built on rock remained standing, while the one built on sand collapsed. Jesus used the picture to explain that hearing His teaching is not enough; a person must also live by what has been heard.',
  },
  'nawawalang-barya': {
    tl: 'Sa talinghaga ni Jesus, may babaeng may sampung barya at nawalan ng isa. Nagsindi siya ng ilawan at maingat na nagwalis habang hinahanap ito. Nang matagpuan, tinawag niya ang mga kaibigan at kapitbahay upang makigalak. Mahalaga sa babae ang nawalang barya.',
    en: 'In Jesus’ parable, a woman had ten silver coins and discovered that one was missing. She lit a lamp, swept her house, and searched with care until she found it. When the lost coin was recovered, she called her friends and neighbors to rejoice with her. Jesus used this familiar moment of searching and celebration to describe joy when one person turns back to God.',
  },
  'mayamang-hangal': {
    tl: 'Sa talinghaga, naging sagana ang ani ng isang mayamang lalaki. Nagplano siyang gibain ang kaniyang mga kamalig at magtayo ng mas malalaki upang doon itago ang lahat. Ngunit ipinaalala sa kuwento na hindi hawak ng tao ang haba ng kaniyang buhay at hindi kayamanan lamang ang nagbibigay ng kabuluhan dito.',
    en: 'A rich farmer’s land produced such an abundant harvest that he wondered where to store it all. He planned to tear down his barns and build larger ones, then live at ease surrounded by his possessions. But in Jesus’ parable, the man’s life was demanded that very night. The story challenges the belief that storing more wealth can guarantee a secure or meaningful future.',
  },
  'buto-mustasa': {
    tl: 'Ikinumpara ni Jesus ang kaharian ng Diyos sa isang napakaliit na buto ng mustasa. Kapag itinanim at lumago, mas lumalaki ito kaysa sa inaasahan, at nagiging halaman na may mga sanga kung saan nakakapagpahinga ang mga ibon. Ang maliit na simula ay hindi dapat maliitin.',
    en: 'Jesus asked His listeners to picture a tiny mustard seed. In the parable, someone plants this seed in the ground, where it begins its growth unnoticed. It does not suddenly appear as a large plant; it grows from a small beginning. Over time it becomes large enough to spread branches that offer a place for birds. The picture helped His listeners imagine how God’s kingdom can grow from beginnings that appear insignificant to human eyes.',
  },
  'mabuting-pastol': {
    tl: 'Gumamit si Jesus ng larawan ng pastol na pumapasok sa tamang pintuan at tumatawag sa kaniyang mga tupa sa pangalan. Nakikilala ng mga tupa ang tinig ng nangangalaga sa kanila. Ipinagkaiba Niya ang mapagmalasakit na pastol sa taong tumatakas kapag dumating ang panganib.',
    en: 'Jesus described a shepherd who knows his sheep and calls them by name. The sheep recognize his voice and follow him because they know whom they can trust. A hired worker may run away when danger comes, but the good shepherd stays and cares for the flock. Jesus used this image to describe His own care and His willingness to lay down His life for the sheep.',
  },
  'sampung-ketongin': {
    tl: 'Sa paglalakbay ni Jesus, sampung taong may sakit sa balat ang tumawag mula sa malayo upang humingi ng awa. Pinapunta Niya sila sa mga pari, at habang naglalakad ay gumaling sila. Isa lamang ang bumalik upang magpasalamat; isang Samaritano ang taong iyon.',
    en: 'As Jesus traveled, ten people suffering from a skin disease called out to Him from a distance and asked for mercy. He directed them to show themselves to the priests. While they were on their way, they were healed. One of them noticed what had happened and returned, praising God and thanking Jesus. This person was a Samaritan, a detail that surprised those listening to the story.',
  },
  'dakilang-utos': {
    tl: 'Sa bundok sa Galilea, nakipagtipon si Jesus sa mga alagad. Ipinagkatiwala Niya sa kanila ang pagpunta sa iba’t ibang bayan, pagtuturo sa mga tao na sundin ang Kaniyang itinuro, at pagbibinyag. Tiniyak din Niya na sasamahan Niya sila sa kanilang gawain.',
    en: 'On a mountain in Galilee, the disciples gathered to meet the risen Jesus. He commissioned them to go to the nations, make disciples, baptize, and teach others to obey what He had commanded. The task would take them beyond the places they knew. Jesus also promised that He would remain with them always, even as they carried the message into unfamiliar places.',
  },
  'barnabas-paulo': {
    tl: 'Nang mahirap pang pagkatiwalaan si Saulo dahil sa kaniyang nakaraan, si Barnabas ang tumulong upang marinig ng mga alagad ang kuwento ng pagbabago niya. Sa kalaunan, hinanap niya si Saulo upang makasama sa pagtuturo sa Antioquia. Naging mahalaga ang pagtutulungan sa paglago ng unang iglesya.',
    en: 'After Saul’s conversion, some believers were afraid of him because he had persecuted followers of Jesus. Barnabas helped the apostles hear what had happened and gave Saul an opportunity to be known by his changed actions. Later Barnabas traveled to Tarsus to find him and brought him to Antioch, where they taught together. His encouragement helped make room for someone learning to live differently.',
  },
  'baluti-diyos': {
    tl: 'Ginamit ni Pablo ang larawan ng baluti upang ipaliwanag ang paninindigan sa pananampalataya: katotohanan bilang sinturon, katuwiran bilang panangga, kapayapaan bilang kasuotan sa paa, pananampalataya bilang kalasag, at kaligtasan bilang helmet. Kasama rin ang salita ng Diyos at panalangin.',
    en: 'Paul described the armor of God as a picture of spiritual readiness. He spoke of truth like a belt, righteousness like a breastplate, readiness to share peace like sturdy shoes, faith like a shield, salvation like a helmet, and God’s word like a sword. He ended by urging continued prayer. The picture was a lesson in standing firm through truth and faith, not an invitation to hurt anyone.',
  },
  'bagong-langit-lupa': {
    tl: 'Sa pangitain sa Pahayag, inilarawan ni Juan ang bagong langit at bagong lupa at ang banal na lungsod na bumababa mula sa Diyos. Ipinahayag ang pag-asang makakasama ng Diyos ang Kaniyang bayan at hindi na maghahari ang kamatayan, pagluha, at pagdadalamhati.',
    en: 'In John’s vision, he saw a new heaven and a new earth, and the holy city coming down from God. A voice announced that God would dwell with His people. The vision spoke of tears wiped away, mourning brought to an end, and death no longer ruling over life. The passage offered hope to communities who had experienced fear and suffering, pointing toward the promise of God making all things new.',
  },
};

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
