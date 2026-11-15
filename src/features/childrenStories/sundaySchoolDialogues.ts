import type { StoryLocalized } from './catalog';

/** Original bilingual dramatized teaching scenes. Scripture-related speech is
 * a faithful PARAPHRASE unless the source passage is explicitly named; never
 * present these dialogue passages as word-for-word Bible translation. */
export type StoryDialogueScene = { afterParagraph: number; speech: StoryLocalized };
export const SUNDAY_SCHOOL_DIALOGUES: Record<string, StoryDialogueScene[]> = {
  "maliit-na-ilaw": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "“Paano kung may nangangailangan sa labas?” tanong ni Mila. “Titingin muna tayo kung ligtas at sasama ako sa iyo,” sagot ng nanay. “Hindi kailangang ilagay sa panganib ang sarili para makatulong.” Tumango si Mila at hinawakan ang maliit nilang lampara.",
        "en": "“What if someone needs help outside?” Mila asked. “First we'll check that it's safe, and I'll go with you,” Mom said. “Helping never means putting yourself in danger.” Mila nodded and held their little lamp."
      }
    },
    {
      "afterParagraph": 1,
      "speech": {
        "tl": "Huminto si Aling Rosa at marahang nagtanong, “Mila, hindi ka ba natatakot sa dilim?” Sumagot si Mila, “Opo, natatakot din po ako. Pero kasama ko si Nanay, at gusto po naming makauwi kayo nang ligtas.” Hinawakan ng nanay ni Mila ang kaniyang balikat. “Ang tapang ay hindi kawalan ng takot. Minsan, ang tapang ay ang pagtulong kahit kinakabahan tayo.”",
        "en": "Mrs. Rosa paused and asked softly, “Mila, aren't you afraid of the dark?” Mila answered, “I am afraid too. But Mom is with me, and we want to help you get home safely.” Mila's mother rested a hand on her shoulder. “Courage doesn't always mean feeling no fear. Sometimes courage means helping even while you're nervous.”"
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "“May flashlight ako!” tawag ng kapitbahay. “Ako ang magdadala ng tubig,” dagdag ng isa. Napangiti si Aling Rosa. “Hindi na pala ako nag-iisa.” “Marami po tayong maliliit na ilaw,” sabi ni Mila, “pero kapag sama-sama, maliwanag ang daan.”",
        "en": "“I have a flashlight!” one neighbor called. “I'll bring water,” another added. Mrs. Rosa smiled. “I'm not alone after all.” “We each have a little light,” Mila said, “but together we can brighten the way.”"
      }
    }
  ],
  "david-at-ang-tapang": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "Mula sa kabilang panig ng lambak, malakas na sumigaw si Goliat: “Pumili kayo ng lalaban sa akin!” Napatingin ang mga sundalo sa isa't isa. “Napakalaki niya,” bulong ng ilan. Ngunit hindi sinukat ni David ang buong laban sa laki ng kalaban. Inalala niya ang mga pagkakataong iniligtas siya ng Diyos habang nagpapastol.",
        "en": "From the other side of the valley, Goliath shouted, “Choose someone to fight me!” The soldiers looked at one another. “He's enormous,” some whispered. Yet David did not measure the whole battle by the size of his opponent. He remembered God's help while he cared for the sheep."
      }
    },
    {
      "afterParagraph": 1,
      "speech": {
        "tl": "“Bata ka pa,” sabi ni Haring Saul nang marinig ang nais ni David. Magalang na sumagot si David, “Noong may leon at oso na sumalakay sa mga tupa, tinulungan ako ng Panginoon. Nagtitiwala rin ako sa Kaniya ngayon.” Pinakinggan siya ni Saul. Hindi sinabi ni David na madali ang laban. Ang sinabi niya ay hindi siya nag-iisa sa paghaharap dito.",
        "en": "“You are still young,” King Saul said when he heard David's request. David answered respectfully, “When a lion and a bear attacked the sheep, the Lord helped me. I trust Him now as well.” Saul listened. David did not pretend the fight would be easy. He believed he would not face it alone."
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "Nang mapalapit si David, nanlait si Goliat: “Bakit batang may tungkod ang ipinadala ninyo?” Hindi sumagot si David ng pang-iinsulto. Malinaw niyang sinabi, “Dumating ka na may espada at sibat, ngunit haharap ako sa iyo sa pangalan ng Panginoon.” Sa harap ng takot ng iba, ipinahayag ni David kung kanino siya nagtitiwala.",
        "en": "As David approached, Goliath mocked him: “Why have you sent a boy carrying a stick?” David did not answer with insults. He said clearly, “You come with sword and spear, but I come in the name of the Lord.” Before everyone watching, David declared whom he trusted."
      }
    },
    {
      "afterParagraph": 3,
      "speech": {
        "tl": "Pagkatapos ng pambihirang tagumpay, hindi ang kaniyang sariling laki ang pinuri ni David. Ang ipinahayag niya bago ang laban ay pagtitiwala sa Panginoon. “Sa Panginoon ang laban,” ang diwa ng sinabi niya sa 1 Samuel 17. Hindi ito paanyaya para makipaglaban ang mga bata, kundi paalala na ang tapang ay may pananalig at karunungan.",
        "en": "After the extraordinary victory, David had not boasted about his own size. His declaration before the battle had been about trust in the Lord. “The battle belongs to the Lord,” conveys his words in 1 Samuel 17. This is not an invitation for children to fight, but a reminder that courage needs faith and wisdom."
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "“Kung may umaapi sa kaklase ko, dapat ko bang suntukin siya para maging matapang?” tanong ng isang batang nakikinig. “Hindi,” sagot ng guro. “Ang ligtas na tapang ay pagsasabi ng totoo at paghingi ng tulong sa nakatatanda.” “Kaya po pala may tapang na hindi nakikipagsuntukan,” sabi ng bata.",
        "en": "“If someone bullies my classmate, should I punch them to show courage?” a child asked. “No,” the teacher answered. “Safe courage means speaking truthfully and asking a trusted adult for help.” “So courage doesn't have to mean fighting,” the child said."
      }
    }
  ],
  "bangka-ng-pag-asa": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "Sa pagsasalaysay ng tagubilin sa Genesis, sinabi ng Diyos kay Noe: “Gumawa ka ng arka na may sapat na silid. Sundin mo ang mga sukat at tagubiling ibibigay Ko. Papasukin mo rito ang iyong pamilya at ang mga hayop ayon sa Aking utos.” Tahimik na nakinig si Noe. Hindi niya alam ang lahat ng mangyayari sa hinaharap, ngunit sinimulan niyang gawin ang ipinagagawa ng Diyos.",
        "en": "In this retelling of the instructions in Genesis, God told Noah: “Build an ark with enough rooms. Follow the measurements and directions I give you. Bring your family and the animals aboard as I command.” Noah listened carefully. He did not know every detail of what would happen, but he began doing what God had instructed."
      }
    },
    {
      "afterParagraph": 1,
      "speech": {
        "tl": "Habang nagtatrabaho, may mga araw na pagod ang pamilya. “Tatay, matagal pa po ba?” maaaring naitanong ng isang anak sa pagsasalaysay na ito. “Marami pa tayong gagawin,” tugon ni Noe, “kaya magtulungan tayo at magpatuloy.” Hindi binabanggit sa Biblia ang eksaktong usapang ito; inilalarawan lamang nito ang mahabang pagsunod at pagtutulungan.",
        "en": "As they worked, there must have been tiring days. “Father, do we still have a long way to go?” one child might ask in this dramatization. “There is still much to do,” Noah replies, “so let's help one another and keep going.” The Bible does not record this exact exchange; it illustrates the family's long work of obedience."
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "Sa ating pagsasadula, habang umuulan ay nagtanong ang isang kapamilya, “Kailan kaya tayo makalalabas?” Maingat na sumagot si Noe, “Maghihintay tayo hanggang ligtas at tama na ang panahon.” Hindi nakatala ang eksaktong usapang ito sa Genesis. Ipinapadama nito ang pagtitiis at pag-aalaga sa loob ng arka habang naghihintay ang pamilya.",
        "en": "In this dramatization, a family member asks during the rain, “When will we be able to go outside?” Noah answers carefully, “We will wait until the time is right and safe.” Genesis does not record this exact conversation. It helps children imagine the family's patient waiting and care inside the ark."
      }
    },
    {
      "afterParagraph": 3,
      "speech": {
        "tl": "Pagkatapos ng baha, ipinaliwanag ng Diyos ang Kaniyang tipan. Sa pagsasalaysay na ito, sinabi Niya: “Tingnan ninyo ang bahaghari. Ito ang tanda ng Aking pangako.” Tumingala ang pamilya ni Noe sa makulay na langit. Ang nakikita nilang mga kulay ay paalala ng katapatan ng Diyos, hindi pangakong hindi na kailanman uulan.",
        "en": "After the flood, God explained His covenant. In this retelling, He said, “Look at the rainbow. It is a sign of My promise.” Noah's family looked up at the colorful sky. Its colors reminded them of God's faithfulness, not a promise that rain would never fall again."
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "“Kung may baha ngayon, gagawa rin ba tayo ng arka?” tanong ng isang bata. “Hindi iyon ang tagubilin para sa atin,” paliwanag ng guro. “Makinig tayo sa mga opisyal na babala at lumikas kung kinakailangan.” Naunawaan ng bata na kasama ng pananampalataya ang paghahanda at pagsunod sa mga taong nangangalaga sa kaligtasan.",
        "en": "“If a flood comes today, should we build an ark?” a child asked. “That is not the instruction for us,” the teacher explained. “We follow official warnings and evacuate when needed.” The child understood that faith belongs alongside preparation and listening to people responsible for safety."
      }
    }
  ],
  "si-pagong-at-ang-buto": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "“Bakit mo dadalhin ang butong iyan?” tanong ni Maya. “Itatanim ko,” sagot ni Pagong. “Paano kung walang tumubo?” usisa ng ibon. “Pag-aaralan ko kung ano ang kailangan nito,” sabi ni Pagong. “Ang pagtitiyaga ay kasama ng pagkatuto.”",
        "en": "“Why are you carrying that seed?” Sparrow asked. “I'll plant it,” Turtle said. “What if nothing grows?” the bird wondered. “I'll learn what it needs,” Turtle replied. “Patience also means learning.”"
      }
    },
    {
      "afterParagraph": 1,
      "speech": {
        "tl": "Isang maya ang lumapag sa bakod. “Pagong, bakit mo dinidiligan ang lupang wala namang nakikitang halaman?” tanong nito. “Dahil may ginagawa sa ilalim ng lupa kahit hindi ko pa nakikita,” sagot ni Pagong. “Paano kung hindi ito tumubo?” muling tanong ng maya. “Mag-aaral ako kung ano ang kailangan ng buto, pero hindi ako susuko dahil lang mabagal ang pagbabago.”",
        "en": "A sparrow landed on the fence. “Turtle, why water soil when you can't even see a plant?” it asked. “Because something can be happening under the ground even when I cannot see it,” Turtle replied. “What if it never grows?” asked the sparrow. “Then I'll learn what the seed needs. But I won't give up simply because change is slow.”"
      }
    },
    {
      "afterParagraph": 3,
      "speech": {
        "tl": "“May maliit nang dahon!” masayang sigaw ni Pagong. Lumipad si Maya upang makita. “Patawad at tinawanan kita noon. Maaari ba akong tumulong ngayon?” “Siyempre,” sagot ni Pagong. “Mas maraming makikinabang kung sama-sama nating aalagaan ang puno.”",
        "en": "“There's a tiny leaf!” Turtle cheered. Sparrow flew closer. “I'm sorry I laughed before. Can I help now?” “Of course,” Turtle said. “More friends will benefit if we care for the tree together.”"
      }
    }
  ],
  "bituin-ni-bitu": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "“Tay, paano kung mahirap ang buong araw?” tanong ni Bitu. “Maaari nating kilalanin ang hirap at hanapin pa rin ang isang bagay na ipinagpapasalamat,” sagot ng tatay. “Hindi kailangang magkunwaring masaya kapag malungkot.” Napahinga nang maluwag si Bitu.",
        "en": "“Dad, what if the whole day was difficult?” Bitu asked. “We can admit it was hard and still find something to be grateful for,” Dad answered. “You don't have to pretend to be happy when you're sad.” Bitu felt relieved."
      }
    },
    {
      "afterParagraph": 1,
      "speech": {
        "tl": "“Tay, puwede po bang maliit na bagay lang ang ipagpasalamat?” tanong ni Bitu. “Siyempre,” sabi ng tatay. “Ang isang mabait na salita, isang basong tubig, o ang kaibigang nakinig sa iyo ay mahalaga rin.” Nag-isip si Bitu. “Kung ganoon, salamat din po sa pag-upo ninyo rito at sa pakikinig sa akin.” Niyakap siya ng kaniyang tatay.",
        "en": "“Dad, can I be thankful for very small things?” Bitu asked. “Of course,” her father replied. “A kind word, a glass of water, or a friend who listens matters too.” Bitu thought for a moment. “Then I'm thankful that you're sitting here and listening to me.” Her father hugged her."
      }
    },
    {
      "afterParagraph": 3,
      "speech": {
        "tl": "“Bukas po, pasasalamatan ko si Ana sa krayola,” sabi ni Bitu. “Magandang plano,” tugon ng tatay. “At kung may nasungitan ka, puwede kang humingi ng tawad.” “Gusto ko pong ipakita ang pasasalamat, hindi lang sabihin,” sagot ni Bitu.",
        "en": "“Tomorrow I'll thank Ana for the crayon,” Bitu said. “Good plan,” Dad replied. “And if you spoke unkindly, you can apologize.” “I want to show my gratitude, not just say it,” Bitu answered."
      }
    }
  ],
  "ang-mabuting-kapitbahay": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "Tinanong ng dalubhasa si Jesus: “Sino nga po ang aking kapwa?” Sa halip na magbigay lamang ng maikling kahulugan, ginamit ni Jesus ang isang kuwento upang hamunin ang puso ng nakikinig. Sa pagsasalaysay na ito, tila inaanyayahan Niya ang bawat isa: “Habang nakikinig ka, isipin mo kung sino ang huminto upang tumulong.”",
        "en": "The expert asked Jesus, “And who is my neighbor?” Instead of offering only a short definition, Jesus told a story that would challenge his listener's heart. In this retelling, it is as though He invites everyone listening: “As you hear the story, notice who stops to help.”"
      }
    },
    {
      "afterParagraph": 1,
      "speech": {
        "tl": "Sa pagsasadula sa klase, maaaring umusal ang sugatang manlalakbay, “May makakakita kaya sa akin?” Hindi nakasulat sa Lucas 10 na sinabi niya iyon; tumutulong lamang ang salitang ito na maunawaan ng bata ang kaniyang takot at pangangailangan. Tahimik ang mga nakikinig habang nagpapatuloy ang kuwento ni Jesus.",
        "en": "In a classroom dramatization, the injured traveler may whisper, “Will anyone notice me?” Luke 10 does not say he spoke those words; they simply help children understand his fear and need. The listeners grow quiet as Jesus' story continues."
      }
    },
    {
      "afterParagraph": 3,
      "speech": {
        "tl": "Nang makarating sila sa bahay-panuluyan, kinausap ng Samaritano ang tagapamahala. “Alagaan mo siya,” sabi niya ayon sa diwa ng kuwento ni Jesus. “Narito ang bayad para sa kaniyang pangangailangan. Kung may dagdag pang magagastos, babayaran ko sa aking pagbabalik.” Hindi natapos ang pagtulong sa isang mabait na salita. Naglaan siya ng oras, pag-aalaga, at sariling yaman.",
        "en": "When they reached the inn, the Samaritan spoke to the innkeeper. “Take care of him,” he said, following Jesus' parable. “Here is money for what he needs. If you spend more, I will repay you when I return.” Helping did not end with kind words. The Samaritan gave his time, care, and resources."
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "Sa pagtatapos, nagtanong si Jesus kung sino sa tatlo ang naging tunay na kapwa ng taong nasugatan. Ang sagot ng dalubhasa ay ang taong nagpakita ng awa. Pagkatapos ay sinabi ni Jesus sa diwa ng Lucas 10:37, “Humayo ka at gawin mo rin ang gayon.” Ang mahalagang tanong ay hindi lamang “Sino ang kapwa ko?” kundi “Paano ako magiging mabuting kapwa?”",
        "en": "At the end, Jesus asked which of the three had truly been a neighbor to the injured man. The expert answered that it was the one who showed mercy. Then Jesus told him, in the sense of Luke 10:37, “Go and do likewise.” The important question was not only “Who is my neighbor?” but also “How can I be a good neighbor?”"
      }
    },
    {
      "afterParagraph": 5,
      "speech": {
        "tl": "“Bakit po ang Samaritano ang naging mabuting kapwa?” tanong ng bata. “Dahil hindi niya hinayaang pigilan ng pagkakaiba nila ang kaniyang awa,” sagot ng guro. “Kung may nasaktan ngayon, hihingi muna tayo ng tulong sa nakatatanda o emergency responders upang manatiling ligtas habang tumutulong.”",
        "en": "“Why was the Samaritan the good neighbor?” a child asked. “Because he did not let differences prevent him from showing mercy,” the teacher answered. “Today, if someone is hurt, we first involve trusted adults or emergency responders so we can help safely.”"
      }
    }
  ],
  "lola-sa-hardin": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "“Bakit po iba-iba ang pag-aalaga ninyo sa halaman?” tanong ni Lea. “Dahil iba-iba ang pangangailangan nila,” sagot ni Lola Ising. “Parang tao po?” singit ni Ben. “Oo. Bago tumulong, mahalagang makinig kung anong tulong ang kailangan.”",
        "en": "“Why do you care for each plant differently?” Lea asked. “Because each one has different needs,” Grandma Ising said. “Like people?” Ben added. “Yes. Before helping, it matters to listen to what someone needs.”"
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "“Lola, kailangan po bang perpekto agad ang pagtulong?” tanong ni Ben habang hawak ang pandilig. “Hindi, apo,” sabi ni Lola. “Mas mahalaga na makinig, matuto, at maging maingat.” Sumingit si Lea, “Ako po ang magwawalis sa tuyong daan para hindi kayo madulas.” “Napakagandang tulong niyan,” sabi ni Lola, “dahil inisip ninyo muna ang kaligtasan.”",
        "en": "“Grandma, do we have to do everything perfectly the first time?” Ben asked, holding the watering can. “No, dear,” Grandma said. “What matters is that you listen, learn, and take care.” Lea added, “I'll sweep the dry pathway so you won't slip.” “That's wonderful help,” Grandma said, “because you thought about safety first.”"
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "“Mas maaliwalas po ang hardin!” tuwang-tuwang sabi ni Ben. “At hindi na kayo mag-isang nagbubuhat,” dagdag ni Lea. Hinawakan ni Lola ang kanilang mga kamay. “Ang pinakamagandang regalo ay ang oras na ibinigay ninyo, hindi lang ang malinis na mga paso.”",
        "en": "“The garden looks brighter!” Ben cheered. “And you don't have to carry everything alone,” Lea added. Grandma held their hands. “The best gift was the time you gave me, not just the clean flowerpots.”"
      }
    }
  ],
  "alon-at-ang-kabibe": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "“Bakit kailangan mong sumigaw nang malakas?” tanong ni Kabibe. “Para makita ng lahat kung gaano ako kahalaga!” sagot ni Alon. “Mahalaga ka kahit marunong kang tumahimik,” sabi ni Kabibe. Hindi pa ito lubos na naunawaan ni Alon.",
        "en": "“Why do you always shout?” Shell asked. “So everyone will know how important I am!” Wave answered. “You can matter even when you are quiet,” Shell said. Wave did not understand yet."
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "Mahinang nagsalita ang isang munting alimango: “Hindi namin kailangan ang mas malakas na alon. Kailangan namin ng oras para makahanap ng ligtas na sulok.” Tahimik na nakinig si Alon. “Akala ko sapat na ang lakas ko,” amin niya. Sumagot si Kabibe, “Mas nagiging kapaki-pakinabang ang lakas kapag may kasamang pakikinig.”",
        "en": "A little crab spoke softly: “We don't need a bigger wave. We need time to find a safe corner.” Wave listened in silence. “I thought being strong was enough,” he admitted. Shell replied, “Strength becomes more helpful when it is joined with listening.”"
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "“Patawad, Kabibe. Akala ko ang lakas ang sagot sa lahat,” sabi ni Alon. “Ang mahalaga ay handa kang matuto,” tugon ni Kabibe. “Sa susunod, magtatanong muna ako,” pangako ni Alon. “At makikinig,” paalala ni Kabibe habang nakangiti.",
        "en": "“I'm sorry, Shell. I thought strength answered everything,” Wave said. “What matters is being willing to learn,” Shell replied. “Next time I'll ask first,” Wave promised. “And listen,” Shell added with a smile."
      }
    }
  ],
  "si-jonas-at-ang-dagat": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "Ayon sa unang kabanata ng Jonas, sinabi ng Diyos sa kaniyang propeta: “Bumangon ka. Pumunta ka sa Nineve at ipahayag ang babala laban sa kanilang kasamaan.” Ngunit nagsimulang lumayo si Jonas. Sa ganitong pagsasalaysay, wari'y tinatanong niya ang sarili: “Bakit doon pa? Paano kung ayaw nilang makinig?” Hindi ibinigay ng Biblia ang eksaktong tanong na ito; inilalarawan nito ang pag-iwas ni Jonas.",
        "en": "According to Jonah chapter one, God instructed His prophet: “Get up. Go to Nineveh and announce the warning against its wickedness.” But Jonah turned the other way. In this dramatization, he seems to ask himself, “Why there? What if they refuse to listen?” Scripture does not record those exact questions; they express Jonah's attempt to flee."
      }
    },
    {
      "afterParagraph": 1,
      "speech": {
        "tl": "“Bakit ka natutulog?” tanong ng kapitan kay Jonas habang umuuga ang barko. Nang mapag-usapan nila ang nangyari, sinabi ni Jonas na tumatakas siya sa Panginoon. “Ano ang gagawin namin sa iyo upang humupa ang dagat?” tanong ng mga mandaragat. Sumagot si Jonas ayon sa salaysay: “Ihulog ninyo ako sa dagat.” Gayunman, sinubukan muna nilang magsagwan upang iligtas siya.",
        "en": "“How can you be sleeping?” the captain asked Jonah as the ship rocked. When the sailors learned what was happening, Jonah admitted he was fleeing the Lord. “What should we do to you so the sea will grow calm?” the sailors asked. Jonah answered in the biblical account, “Throw me into the sea.” Even so, the sailors first tried to row to safety."
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "Sa loob ng malaking isda, nanalangin si Jonas. Sa pagsasalaysay para sa mga bata, maaari nating ipahayag ang diwa ng Jonas 2: “Panginoon, naririnig Mo ang aking panalangin kahit ako ay nasa kalaliman. Sa Iyo nanggagaling ang kaligtasan.” Hindi ito eksaktong sipi mula sa isang salin, kundi pagpapaliwanag ng kaniyang panalangin.",
        "en": "Inside the great fish, Jonah prayed. This child-friendly retelling expresses the sense of Jonah 2: “Lord, You hear my prayer even in the deep. Salvation comes from You.” This is not an exact quotation from a translation, but an explanation of his prayer."
      }
    },
    {
      "afterParagraph": 3,
      "speech": {
        "tl": "Muling dumating ang salita ng Diyos kay Jonas: “Pumunta ka sa Nineve. Ibigay mo sa kanila ang mensaheng ipapahayag Ko.” Ngayon ay pumunta si Jonas. Habang nangangaral siya, nagsimulang tumugon ang mga tao. Ang hari mismo ay nagpahayag na dapat tumalikod sa karahasan at masamang gawa. Hindi lang takot ang ipinakita nila; sinikap nilang magbago.",
        "en": "God's word came to Jonah a second time: “Go to Nineveh. Proclaim the message I give you.” This time Jonah went. As he preached, the people began to respond. Even the king called the people to turn away from violence and wrongdoing. They showed not only fear but a willingness to change."
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "Nang magalit si Jonas sa habag ng Diyos, tinanong siya ng Panginoon kung tama ba ang kaniyang matinding galit. Sa huling bahagi ng kuwento, ginamit ng Diyos ang halaman na nagbigay ng lilim at biglang nalanta upang tanungin si Jonas tungkol sa kaniyang awa sa mga tao ng Nineve. Hindi inilalahad ng Biblia ang huling sagot ni Jonas. Iniiwan tayo ng kuwento na may sariling tanong: “Handa rin ba akong magpakita ng habag?”",
        "en": "When Jonah became angry at God's mercy, the Lord questioned whether his anger was right. In the final part of the story, God used the plant that gave shade and then withered to challenge Jonah about mercy toward Nineveh's people. The Bible does not tell us Jonah's final answer. It leaves us with a question of our own: “Am I willing to show mercy too?”"
      }
    },
    {
      "afterParagraph": 5,
      "speech": {
        "tl": "“Bakit po binigyan ng Diyos ng pagkakataong magbago ang Nineve?” tanong ng bata. “Dahil mahalaga sa Kaniya ang pagsisisi at buhay ng mga tao,” sagot ng guro. “Ang awa ay hindi pagwawalang-bahala sa masamang gawa. Kasama rito ang pagtalikod sa mali at pananagutan.”",
        "en": "“Why did God give Nineveh a chance to change?” a child asked. “Because repentance and people's lives matter to Him,” the teacher replied. “Mercy does not mean ignoring wrongdoing. It includes turning away from harm and accepting responsibility.”"
      }
    }
  ],
  "tatlong-salitang-mahalaga": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "“Maaari po bang humiram?” tanong ni Niko kay Ana. “Oo, salamat at nagtanong ka muna,” sagot ni Ana. “Ibabalik ko po pagkatapos,” pangako ni Niko. Napagtanto niyang ang magalang na salita ay unang hakbang sa paggalang din sa gamit ng iba.",
        "en": "“May I borrow these?” Niko asked Ana. “Yes, thanks for asking first,” Ana replied. “I'll return them afterward,” Niko promised. He realized that polite words are the first step toward respecting other people's belongings."
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "“Ben, galit ka pa ba sa akin?” mahinang tanong ni Niko habang inayos nila ang mga bloke. Sumagot si Ben, “Nalungkot ako nang masira ang bahay ko, pero natutuwa akong tinulungan mo akong ayusin ito.” Tumango si Niko. “Sa susunod, titingin muna ako bago abutin ang mga laruan.” “Maaari tayong maging mas maingat na magkaibigan,” sabi ni Ben.",
        "en": "“Ben, are you still angry with me?” Niko asked quietly as they rebuilt the blocks. “I felt sad when my house broke,” Ben answered, “but I'm glad you're helping me fix it.” Niko nodded. “Next time, I'll look carefully before reaching for more toys.” “We can learn to be more careful friends,” Ben said."
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "“Kung sinabi kong patawad, okay na ba kahit ulitin ko ang pagkakamali?” tanong ni Niko. “Kailangan ding matuto at baguhin ang susunod na kilos,” sagot ng guro. “Makikinig din tayo sa damdamin ng nasaktan.” “Gusto ko pong ayusin ang nagawa ko,” sabi ni Niko.",
        "en": "“If I say sorry, is it okay to repeat the mistake?” Niko asked. “We also need to learn and change what we do next,” the teacher said. “And we listen to the person who was hurt.” “I want to make things right,” Niko replied."
      }
    }
  ],
  "puno-ng-pangarap": [
    {
      "afterParagraph": 1,
      "speech": {
        "tl": "“Kapag nagtanim tayo, mawawala na po ba ang baha?” tanong ni Jojo. “Maraming dahilan ang baha,” paliwanag ng guro. “Mahalaga rin ang ligtas na kanal, babala, at paghahanda ng komunidad.” Sumagot si Mara, “Magsisimula po kami sa mga bagay na maaari naming gawin nang ligtas.”",
        "en": "“Will planting trees stop all the floods?” Jojo asked. “Floods have many causes,” the teacher explained. “Safe drainage, warnings, and community preparedness also matter.” Mara replied, “We'll begin with what we can do safely.”"
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "“Guro, kapag nagtanim po tayo, hindi na ba babaha?” tanong ni Jojo. “Hindi ganoon kasimple,” sagot ng guro. “Kailangan nating alagaan ang mga puno at makipagtulungan din sa komunidad para sa ligtas na daluyan ng tubig.” “Kung gayon,” sabi ni Mara, “magagawa natin ang bahagi natin habang humihingi ng tulong sa mga taong may tamang kaalaman.” Ngumiti ang guro. “Iyan ang responsableng pagkilos.”",
        "en": "“Teacher, if we plant trees, will the floods stop?” Jojo asked. “It isn't that simple,” the teacher answered. “We must care for the trees and work with the community on safe drainage too.” “Then,” said Mara, “we can do our part and ask knowledgeable people for help with the rest.” The teacher smiled. “That is responsible action.”"
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "“May mga punlang hindi tumubo,” malungkot na sabi ni Jojo. “Totoo, pero may natutuhan tayo,” sagot ni Mara. “Ang isang mabuting proyekto ay hindi kailangang magkunwaring perpekto,” dagdag ng guro. “Mahalagang matuto sa resulta at magpatuloy nang may pag-iingat.”",
        "en": "“Some seedlings didn't grow,” Jojo said sadly. “That's true, but we learned something,” Mara replied. “A worthwhile project doesn't need to pretend that every result was perfect,” the teacher added. “We learn from the results and keep working carefully.”"
      }
    }
  ],
  "gabi-ng-payapang-ulan": [
    {
      "afterParagraph": 0,
      "speech": {
        "tl": "“Paano po kung magkamali ako bukas?” tanong ni Lira. “Lahat ay natututo,” sagot ng nanay. “Sino kaya ang puwede mong lapitan sa paaralan kapag nahirapan ka?” “Ang guro ko po,” sabi ni Lira. “Magandang plano iyan,” tugon ng nanay.",
        "en": "“What if I make a mistake tomorrow?” Lira asked. “Everyone learns,” Mom replied. “Who could you ask for help at school?” “My teacher,” Lira said. “That's a good plan,” Mom answered."
      }
    },
    {
      "afterParagraph": 2,
      "speech": {
        "tl": "“Nanay, maaari po ba nating ipagdasal kahit maliit na pag-aalala lang?” tanong ni Lira. “Oo naman,” sagot ng nanay. “Mahalaga sa Diyos ang nilalaman ng puso mo. Maaari kang magsabi sa Kaniya at maaari ka ring humingi ng tulong sa amin.” “Kung mahirapan po ako bukas, magtatanong ako sa guro,” sabi ni Lira. “Magandang plano,” sagot ng nanay, “at hindi mo kailangang gawin ang lahat nang mag-isa.”",
        "en": "“Mom, can we pray even about a small worry?” Lira asked. “Of course,” her mother replied. “You can tell God what is in your heart, and you can also ask us for help.” “If I struggle tomorrow, I'll ask my teacher,” Lira said. “That's a good plan,” her mother answered, “and you don't have to do everything alone.”"
      }
    },
    {
      "afterParagraph": 4,
      "speech": {
        "tl": "“Hindi ko po kailangang magaling agad sa lahat, ano?” tanong ni Lira. “Hindi,” sagot ng nanay. “Maaari kang makinig, magtanong, at sumubok muli.” Ngumiti si Lira. “Kapag nag-aalala po ako, sasabihin ko sa inyo.” “Palagi akong handang makinig,” tugon ng nanay.",
        "en": "“I don't need to be good at everything right away, do I?” Lira asked. “No,” Mom answered. “You can listen, ask, and try again.” Lira smiled. “When I'm worried, I'll tell you.” “I'm always here to listen,” Mom said."
      }
    }
  ]
};
