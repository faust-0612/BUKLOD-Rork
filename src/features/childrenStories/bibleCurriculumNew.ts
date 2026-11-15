import type { BibleCurriculumSeed } from './bibleCurriculumFactory';
const L=(tl:string,en:string)=>({tl,en});
export const NEW_TESTAMENT_SEEDS: BibleCurriculumSeed[] = [
{
id:'kapanganakan-ni-jesus',emoji:'🌟',age:3,title:L('Ang Kapanganakan ni Jesus','The Birth of Jesus'),reference:'Luke 1:26–38; 2:1–20',
narrative:L(
'Isang anghel ang nagdala kay Maria ng balita: magkakaroon siya ng anak na tatawaging Jesus. Sinabi ng anghel na ang batang ito ay Anak ng Kataas-taasan. Nagtanong si Maria dahil hindi niya maunawaan ang lahat, ngunit tumugon siya nang may pagtitiwala. Nang dumating ang panahon ng pagpapalista sa bayan, naglakbay sina Maria at Jose patungong Bethlehem.',
'An angel brought Mary surprising news: she would have a son named Jesus. The angel said the child would be called Son of the Most High. Mary had questions because she did not understand everything, yet she responded with trust. Later, when people were required to register in their ancestral towns, Mary and Joseph traveled to Bethlehem.',
)+'\n\n'+
'Doon ay ipinanganak si Jesus. Binalot Siya ni Maria ng lampin at inihiga sa isang sabsaban dahil walang silid na matutuluyan para sa kanila. Hindi marangya ang Kaniyang pagsilang. Sa mga burol sa paligid, nagbabantay ang mga pastol sa kanilang mga tupa nang magpakita ang isang anghel at magbalita ng malaking kagalakan para sa lahat ng tao.',
'Jesus was born in Bethlehem. Mary wrapped Him in cloths and laid Him in a manger because there was no guest room available for them. His birth was not surrounded by wealth or splendor. Nearby, shepherds were watching their flocks at night when an angel appeared and announced great joy for all people.',
)+'\n\n'+
'Sinabi ng anghel na ipinanganak ang Tagapagligtas. Nagpunta ang mga pastol upang hanapin ang sanggol at nakita nila sina Maria, Jose, at Jesus. Ikinuwento nila ang magandang balitang kanilang narinig. Iningatan ni Maria ang mga bagay na ito sa kaniyang puso. Ang pagsilang ni Jesus ay paalala na dumating ang pag-ibig ng Diyos sa isang payak na lugar at para sa lahat.',
'The angel announced that the Savior had been born. The shepherds hurried to find the baby and saw Mary, Joseph, and Jesus. They shared the wonderful news they had heard. Mary treasured these things in her heart. Jesus’ birth reminds us that God’s love entered the world in an ordinary place and that the good news was meant for everyone.'
),
moral:L('Mahalaga ang kababaang-loob at pagtanggap sa bawat tao.','Humility and welcoming others matter.'),
spiritual:L('Ipinanganak si Jesus bilang Tagapagligtas, tanda ng dakilang pag-ibig ng Diyos.','Jesus was born as Savior, a sign of God’s great love.'),
prayer:L('Panginoong Jesus, salamat sa Iyong pagdating. Turuan Mo kaming magmahal at tumanggap sa lahat. Amen.','Lord Jesus, thank You for coming. Teach us to love and welcome everyone. Amen.'),
event:{question:L('Saan inihiga ang sanggol na si Jesus?','Where was baby Jesus laid?'),correct:L('Sa sabsaban','In a manger'),wrong:[L('Sa trono','On a throne'),L('Sa malaking bangka','On a large boat')]},
lessonAnswer:L('Ang kababaang-loob ay bahagi ng tunay na pagmamahal.','Humility is part of genuine love.'),
application:L('Batiin at tanggapin ang isang bagong kakilala.','Welcome someone new with kindness.')
},
{
id:'batang-jesus-sa-templo',emoji:'📜',age:6,title:L('Ang Batang Jesus sa Templo','Young Jesus at the Temple'),reference:'Luke 2:41–52',
narrative:L(
'Taun-taon ay naglalakbay ang pamilya ni Jesus patungong Jerusalem upang ipagdiwang ang Paskuwa. Nang labindalawang taong gulang si Jesus, sumama Siya kina Maria at Jose. Pagkatapos ng kapistahan, nagsimula nang umuwi ang grupo, ngunit nanatili si Jesus sa Jerusalem. Inakala ng mga magulang Niya na kasama Siya ng mga kamag-anak at kaibigan.',
'Every year Jesus’ family traveled to Jerusalem for Passover. When Jesus was twelve years old, He went with Mary and Joseph. After the festival, their traveling group began the journey home, but Jesus remained in Jerusalem. His parents thought He was among their relatives and friends and did not realize at first that He was missing.',
)+'\n\n'+
'Nang hindi Siya makita, nabahala sina Maria at Jose at bumalik sa Jerusalem upang hanapin Siya. Pagkalipas ng tatlong araw ay natagpuan nila si Jesus sa templo. Nakaupo Siya kasama ang mga guro, nakikinig at nagtatanong. Namangha ang mga nakarinig sa Kaniyang pag-unawa at mga sagot. Sinabi ni Jesus na nararapat Siyang nasa bahay ng Kaniyang Ama.',
'When Mary and Joseph could not find Him, they were worried and returned to Jerusalem to search. After three days, they found Jesus in the temple, sitting with teachers, listening and asking questions. The people there were amazed at His understanding and answers. Jesus spoke about being in His Father’s house.',
)+'\n\n'+
'Umuwi si Jesus kasama nila sa Nazareth at nagpasakop sa Kaniyang mga magulang. Patuloy Siyang lumago sa karunungan, pangangatawan, at mabuting pakikitungo sa Diyos at sa tao. Mahalaga ang pagtatanong at pag-aaral, ngunit mahalaga rin ang pakikinig sa magulang at pag-iingat sa ating kaligtasan. Ang kaalaman at kabutihan ay sabay na dapat lumago.',
'Jesus went home with His parents to Nazareth and was obedient to them. He continued to grow in wisdom, stature, and favor with God and people. Asking questions and learning are good, but so are listening to parents and keeping everyone informed and safe. Knowledge and kindness should grow together.'
),
moral:L('Magtanong upang matuto at igalang ang magulang at guro.','Ask questions to learn and respect parents and teachers.'),
spiritual:L('Mahalaga kay Jesus ang karunungan at ang Kaniyang kaugnayan sa Ama.','Jesus values wisdom and His relationship with the Father.'),
prayer:L('Jesus, turuan Mo akong makinig, magtanong, at lumago sa karunungan at kabutihan. Amen.','Jesus, help me listen, ask questions, and grow in wisdom and kindness. Amen.'),
event:{question:L('Saan natagpuan si Jesus pagkatapos Siyang hanapin ng mga magulang?','Where did His parents find Jesus?'),correct:L('Sa templo kasama ang mga guro','In the temple with teachers'),wrong:[L('Sa ibabaw ng bundok','On a mountaintop'),L('Sa palengke ng isda','At a fish market')]},
lessonAnswer:L('Ang pag-aaral at paggalang ay magkasamang mahalaga.','Learning and respect belong together.'),
application:L('Magtanong nang magalang at ipaalam sa magulang kung saan pupunta.','Ask respectfully and let your parents know where you are going.')
},
{
id:'bautismo-ni-jesus',emoji:'💧',age:6,title:L('Ang Bautismo ni Jesus','The Baptism of Jesus'),reference:'Matthew 3:13–17; Mark 1:9–11',
narrative:L(
'Sa tabi ng Ilog Jordan, si Juan Bautista ay nananawagan sa mga tao na magsisi at maghanda para sa pagdating ng Panginoon. Binabautismuhan niya ang mga lumalapit bilang tanda ng kanilang pagsisisi. Isang araw ay dumating si Jesus mula sa Galilea upang magpabautismo kay Juan. Nagulat si Juan at pakiramdam niya ay siya ang dapat lumapit kay Jesus.',
'Beside the Jordan River, John the Baptist called people to repent and prepare for the Lord. He baptized those who came to him as a sign of their response. One day Jesus arrived from Galilee and asked John to baptize Him. John was surprised and felt that he was the one who needed to come to Jesus.',
)+'\n\n'+
'Ipinaliwanag ni Jesus na nararapat nilang gawin ang tama ayon sa kalooban ng Diyos. Kaya bininyagan Siya ni Juan sa ilog. Pag-ahon ni Jesus mula sa tubig, nabuksan ang langit at nakita ang Espiritu ng Diyos na bumababang tulad ng kalapati. May tinig mula sa langit na nagpahayag na si Jesus ang minamahal na Anak ng Diyos.',
'Jesus explained that this was the right thing to do in fulfilling God’s purpose. John baptized Him in the river. As Jesus came up out of the water, heaven opened, and the Spirit of God descended like a dove. A voice from heaven declared that Jesus was God’s beloved Son, in whom He was well pleased.',
)+'\n\n'+
'Ang pangyayaring ito ang isa sa mga simula ng hayag na ministeryo ni Jesus. Hindi ito kuwento ng pagsisikap ni Jesus na maging mahalaga; kinilala na Siya ng Ama. Para sa atin, paalala ito na mahalaga ang pagsunod sa Diyos nang may pagpapakumbaba. Maaari ring pag-usapan ng mga bata ang kahulugan ng bautismo kasama ang magulang at mga pinuno ng pananampalataya.',
'This event marked an important beginning of Jesus’ public ministry. It was not about Jesus trying to earn importance; the Father declared His delight in Him. For us, the story teaches humble obedience to God. Children can also ask parents and trusted faith leaders about baptism and what it means in their community.'
),
moral:L('Maging mapagpakumbaba at handang sumunod sa mabuti.','Be humble and ready to do what is right.'),
spiritual:L('Kinilala ng Ama si Jesus bilang Kaniyang minamahal na Anak.','The Father declared Jesus to be His beloved Son.'),
prayer:L('Panginoong Jesus, tulungan Mo akong sumunod sa mabuti nang may pagpapakumbaba. Amen.','Lord Jesus, help me obey what is right with humility. Amen.'),
event:{question:L('Sa aling ilog binautismuhan si Jesus?','In which river was Jesus baptized?'),correct:L('Sa Ilog Jordan','In the Jordan River'),wrong:[L('Sa Ilog Nilo','In the Nile River'),L('Sa Ilog Eufrates','In the Euphrates River')]},
lessonAnswer:L('Ang pagsunod ay maaaring gawin nang may kababaang-loob.','Obedience can be practiced with humility.'),
application:L('Sundin ang isang mabuting paalala nang hindi nagrereklamo.','Follow a good instruction without complaining.')
},
{
id:'pinatahimik-ni-jesus-ang-bagyo',emoji:'⛵',age:3,title:L('Pinatahimik ni Jesus ang Bagyo','Jesus Calms the Storm'),reference:'Mark 4:35–41; Luke 8:22–25',
narrative:L(
'Isang gabi, sinabi ni Jesus sa Kaniyang mga alagad na tumawid sila sa kabilang pampang ng lawa. Sumakay sila sa bangka at nagsimulang maglayag. Pagod si Jesus kaya nahiga Siya at nakatulog. Biglang lumakas ang hangin at nagsipagtaasan ang mga alon. Pumapasok ang tubig sa bangka at natakot ang mga alagad.',
'One evening Jesus told His disciples that they should cross to the other side of the lake. They boarded a boat and began sailing. Jesus was tired, so He lay down and fell asleep. Suddenly a strong wind rose and waves crashed around them. Water was entering the boat, and the disciples became afraid.',
)+'\n\n'+
'Ginising ng mga alagad si Jesus at humingi ng tulong. Tumayo Siya at sinaway ang hangin at ang mga alon. Sinabi Niyang tumahimik ang dagat. Humupa ang hangin at naging payapa ang tubig. Namangha ang mga alagad dahil nakita nila ang kapangyarihan ni Jesus. Tinanong Niya sila kung bakit sila natatakot at kung nasaan ang kanilang pananampalataya.',
'The disciples woke Jesus and asked for help. He stood up and rebuked the wind and the waves. He told the sea to be still. The wind stopped, and the water became calm. The disciples were amazed because they had seen Jesus’ authority. He asked them why they were so afraid and challenged them to trust Him.',
)+'\n\n'+
'Mahalaga ang pananalangin kapag tayo ay natatakot, ngunit mahalaga rin ang pag-iingat. Kung may totoong bagyo, lumayo sa baha at sundin ang tagubilin ng mga nakatatanda at rescuer. Ipinapaalala ng kuwentong ito na maaari nating sabihin kay Jesus ang ating takot. Hindi kailangang magkunwaring walang nararamdamang pangamba upang magkaroon ng pananampalataya.',
'Prayer is helpful when we are frightened, but being careful also matters. During a real storm, stay away from floodwaters and follow the directions of trusted adults and rescuers. This story reminds us that we can tell Jesus about our fears. Faith does not mean pretending that danger or fear is not real.'
),
moral:L('Kapag natatakot, humingi ng tulong at manatiling ligtas.','When afraid, ask for help and stay safe.'),
spiritual:L('May kapangyarihan si Jesus sa hangin at dagat at nakikinig Siya sa mga tumatawag sa Kaniya.','Jesus has authority over wind and sea and hears those who call on Him.'),
prayer:L('Jesus, makasama Ka sana namin sa aming takot at turuan kaming kumilos nang ligtas. Amen.','Jesus, be with us when we are afraid and help us act safely. Amen.'),
event:{question:L('Ano ang ginawa ni Jesus sa malakas na bagyo?','What did Jesus do during the fierce storm?'),correct:L('Pinatahimik Niya ang hangin at alon','He calmed the wind and waves'),wrong:[L('Lumipad Siya palayo','He flew away'),L('Nagtago Siya sa bundok','He hid on a mountain')]},
lessonAnswer:L('Ang tapang ay kasama ang paghingi ng tulong.','Courage includes asking for help.'),
application:L('Sabihin sa nakatatanda kapag may kinatatakutan.','Tell a trusted adult when something frightens you.')
},
{
id:'limang-tinapay-dalawang-isda',emoji:'🍞',age:3,title:L('Limang Tinapay at Dalawang Isda','Five Loaves and Two Fish'),reference:'John 6:1–15; Mark 6:30–44',
narrative:L(
'Napakaraming tao ang sumunod kay Jesus upang marinig ang Kaniyang pagtuturo at makita ang Kaniyang mga ginawa. Nang tumagal ang araw, nag-alala ang mga alagad dahil gutom na ang karamihan. Tinanong ni Jesus kung saan sila makakakuha ng pagkain para sa lahat. Mukhang napakalaking suliranin ito dahil maraming tao at kaunti ang kanilang dala.',
'A great crowd followed Jesus to hear Him teach and to see what He did. As the day went on, the disciples became worried because people were hungry. Jesus asked where food could be found for everyone. It seemed like a huge problem: the crowd was large, and the disciples did not have enough food or money.',
)+'\n\n'+
'May isang bata na may dalang limang tinapay at dalawang isda. Ipinakita ng alagad na si Andres ang pagkaing iyon kay Jesus. Pinaupo ni Jesus ang mga tao. Nagpasalamat Siya sa Diyos at ipinamahagi ang mga tinapay at isda. Kumain ang mga tao hanggang sila ay mabusog. Hindi inangkin ni Jesus ang pagkain para sa iilan lamang.',
'A boy had brought five loaves of bread and two fish. Andrew told Jesus about the boy’s small meal. Jesus asked the people to sit down. He gave thanks to God and distributed the bread and fish. The crowd ate until everyone was satisfied. Jesus cared for the people’s hunger, not only for their questions.',
)+'\n\n'+
'Pagkatapos kumain, inutusan ni Jesus ang mga alagad na tipunin ang mga natira upang walang masayang. Napuno ang labindalawang basket ng natirang piraso. Itinuturo ng kuwento na mahalaga ang pagbabahagi, pasasalamat, at hindi pag-aaksaya. Kahit maliit ang ating maibigay, maaari itong maging bahagi ng malaking kabutihan kapag ibinahagi nang may pag-ibig.',
'After the meal, Jesus told the disciples to collect the leftovers so nothing would be wasted. Twelve baskets were filled with remaining pieces. The story teaches us to share, give thanks, and avoid waste. Even something small can become part of a greater good when it is offered with love and care for others.'
),
moral:L('Magbahagi ng makakaya at huwag mag-aksaya ng pagkain.','Share what you can and do not waste food.'),
spiritual:L('Inaalagaan ni Jesus ang pangangailangan ng mga tao.','Jesus cares about people’s needs.'),
prayer:L('Jesus, salamat sa aming pagkain. Tulungan kaming magbahagi sa nagugutom. Amen.','Jesus, thank You for our food. Help us share with those who are hungry. Amen.'),
event:{question:L('Ano ang dalang pagkain ng bata?','What food did the boy bring?'),correct:L('Limang tinapay at dalawang isda','Five loaves and two fish'),wrong:[L('Tatlong basket ng ubas','Three baskets of grapes'),L('Isang sako ng bigas','A sack of rice')]},
lessonAnswer:L('Magbahagi nang may pasasalamat at pag-iingat.','Share with gratitude and care.'),
application:L('Magbahagi ng pagkain sa nangangailangan kapag ligtas at naaangkop.','Share food with someone in need when safe and appropriate.')
},
{
id:'ang-nawawalang-tupa',emoji:'🐑',age:3,title:L('Ang Nawawalang Tupa','The Lost Sheep'),reference:'Luke 15:1–7; Matthew 18:10–14',
narrative:L(
'Lumapit kay Jesus ang iba’t ibang taong nais makinig sa Kaniya. May ilang pinunong nagreklamo dahil tinatanggap Niya ang mga taong itinuturing nilang makasalanan. Kaya nagkuwento si Jesus tungkol sa isang pastol na may isang daang tupa. Isang araw ay napansin niyang may isang nawawala sa kawan.',
'Many kinds of people came to listen to Jesus. Some leaders complained because He welcomed those they called sinners. Jesus then told a story about a shepherd with one hundred sheep. One day the shepherd noticed that one sheep was missing. Although most of the flock was present, the missing sheep still mattered deeply to him.',
)+'\n\n'+
'Iniwan ng pastol ang siyamnapu’t siyam sa ligtas na lugar at hinanap ang nawawala. Naglakad siya hanggang sa makita ang tupa. Sa halip na paluin o pagalitan, binuhat niya ito sa kaniyang mga balikat at masayang umuwi. Tinawag niya ang kaniyang mga kaibigan at kapitbahay upang makisaya sa pagkakatagpo.',
'The shepherd left the ninety-nine in a safe place and searched for the missing one. He kept looking until he found it. Instead of striking or shaming the sheep, he lifted it onto his shoulders and joyfully carried it home. He invited his friends and neighbors to celebrate that the lost sheep had been found.',
)+'\n\n'+
'Ipinaliwanag ni Jesus na may kagalakan sa langit kapag ang isang taong naligaw ay nagsisisi at bumabalik sa Diyos. Hindi ito dahilan upang lumayo ang bata nang mag-isa; kapag naligaw, humingi agad ng tulong sa mapagkakatiwalaang nakatatanda. Ang diwa ng kuwento ay walang taong walang halaga. May pag-asa sa pagbabalik at pagbabago.',
'Jesus explained that heaven rejoices when a person who has wandered away repents and returns to God. This does not mean children should wander off on their own. If lost, ask a safe, trusted adult for help immediately. The story’s message is that no one is worthless. There is joy in being found, welcomed, and given a new beginning.'
),
moral:L('Huwag isantabi ang isang taong nangangailangan ng pag-aalaga.','Do not overlook someone who needs care.'),
spiritual:L('Minamahal ng Diyos ang bawat tao at nagagalak sa nagbabalik sa Kaniya.','God loves each person and rejoices when someone returns to Him.'),
prayer:L('Jesus, salamat na mahalaga sa Iyo ang bawat isa. Tulungan Mo kaming magmalasakit. Amen.','Jesus, thank You that everyone matters to You. Help us care for others. Amen.'),
event:{question:L('Ilang tupa ang nawawala sa kuwento?','How many sheep were missing in the story?'),correct:L('Isa','One'),wrong:[L('Sampu','Ten'),L('Limampu','Fifty')]},
lessonAnswer:L('Ang bawat tao ay mahalaga at nararapat alagaan.','Every person matters and deserves care.'),
application:L('Kumustahin ang isang taong naiiwan o nalulungkot.','Check on someone who is left out or sad.')
},
{
id:'ang-nawawalang-anak',emoji:'🏠',age:9,title:L('Ang Anak na Nagbalik','The Son Who Came Home'),reference:'Luke 15:11–32',
narrative:L(
'Nagkuwento si Jesus tungkol sa isang ama na may dalawang anak. Humingi ang bunso ng bahagi ng kaniyang mamanahin at umalis papunta sa malayong lugar. Doon ay inubos niya ang pera sa walang-ingat na pamumuhay. Nang dumating ang matinding taggutom, wala siyang sapat na pagkain. Nagtatrabaho siya sa pag-aalaga ng mga baboy at naalala niya ang tahanan.',
'Jesus told a story about a father with two sons. The younger son asked for his inheritance early and left for a faraway country. There he wasted his money through careless living. When famine came, he had too little to eat. While working among pigs, he remembered that even his father’s workers had enough food.',
)+'\n\n'+
'Napagtanto ng anak ang kaniyang pagkakamali. Nagpasya siyang bumalik at amining nagkasala siya sa Diyos at sa kaniyang ama. Habang malayo pa siya, nakita siya ng ama at tumakbo upang yakapin siya. Binigyan siya ng malinis na damit at naghanda ng salu-salo. Hindi binura ng pagyakap ang nangyaring mali; ipinakita nito ang kagalakan sa tunay na pagbabalik.',
'The son recognized his wrongdoing. He decided to return and admit that he had sinned against God and his father. While he was still far away, the father saw him, ran toward him, and embraced him. The father gave him clean clothes and prepared a feast. The welcome did not pretend the wrong choices were good; it celebrated his return.',
)+'\n\n'+
'Ngunit nagalit ang nakatatandang kapatid. Pakiramdam niya ay hindi patas ang pagdiriwang para sa kapatid na umalis. Kinausap siya ng ama at ipinaalalang mahalaga ring magalak sa taong nagbalik. Itinuturo ng kuwento ang pagsisisi, pagpapatawad, at inggit. Kapag nagkamali tayo, may halaga ang pag-amin at pagbabago. Kapag may nagbalik, maaari tayong tumulong sa pagkakasundo.',
'The older brother was angry. He thought it unfair to celebrate someone who had left and wasted so much. The father spoke to him and explained why the return was worth celebrating. This story teaches repentance, forgiveness, and the danger of jealousy. When we do wrong, we can admit it and change. When someone seeks to make things right, we can help restore peace.'
),
moral:L('Ang tunay na paghingi ng tawad ay may kasamang pagbabagong asal.','Real apology includes a change in behavior.'),
spiritual:L('Tinatanggap ng mapagmahal na Ama ang nagsisisi at bumabalik.','The loving Father welcomes those who repent and return.'),
prayer:L('Ama, patawarin Mo ako sa aking pagkakamali at turuan Mo akong magbago at magpatawad. Amen.','Father, forgive my wrong choices and teach me to change and forgive. Amen.'),
event:{question:L('Ano ang ginawa ng ama nang makita ang anak na nagbalik?','What did the father do when he saw his returning son?'),correct:L('Tumakbo siya at niyakap ang anak','He ran and embraced his son'),wrong:[L('Ipinagbawal niyang pumasok ang anak','He forbade the son to enter'),L('Nagtago siya sa bukid','He hid in the fields')]},
lessonAnswer:L('May pag-asa sa pag-amin, pagbabago, at pagpapatawad.','There is hope in confession, change, and forgiveness.'),
application:L('Humingi ng tawad at itama ang isang pagkakamali.','Apologize and correct a mistake.')
},
{
id:'si-zacchaeus-sa-puno',emoji:'🌳',age:6,title:L('Si Zaqueo sa Puno','Zacchaeus in the Tree'),reference:'Luke 19:1–10',
narrative:L(
'Dumaan si Jesus sa lungsod ng Jerico. Maraming taong gustong makakita sa Kaniya. May isang lalaking nagngangalang Zaqueo na punong maniningil ng buwis at mayaman. Maliit siya sa tangkad kaya hindi niya makita si Jesus sa dami ng tao. Tumakbo siya sa unahan at umakyat sa puno ng sikomoro upang makasilip.',
'Jesus passed through the city of Jericho, and a crowd gathered to see Him. A man named Zacchaeus was a wealthy chief tax collector. Because he was short and the people stood in front of him, he could not see Jesus. He ran ahead and climbed a sycamore tree where he could look down at the road.',
)+'\n\n'+
'Nang dumating si Jesus sa tapat ng puno, tumingala Siya at tinawag si Zaqueo sa kaniyang pangalan. Sinabi Niyang pupunta Siya sa bahay ni Zaqueo. Nagulat ang mga tao dahil hindi nila gusto ang maniningil ng buwis. Ngunit malugod na tinanggap ni Zaqueo si Jesus. Nagsimula siyang pag-isipan kung paano niya pakikitunguhan nang patas ang ibang tao.',
'When Jesus reached the tree, He looked up and called Zacchaeus by name. Jesus said He would visit his home. Some people grumbled because they disliked the tax collector. Zacchaeus, however, welcomed Jesus gladly. He began to think about his choices and how he could treat people more fairly instead of using them for his own gain.',
)+'\n\n'+
'Sinabi ni Zaqueo na ibibigay niya ang kalahati ng kaniyang mga pag-aari sa mahihirap at isasauli nang higit ang anumang nakuha niya nang hindi tama. Ipinahayag ni Jesus na dumating ang kaligtasan sa bahay na iyon. Hindi lamang naging maganda ang sinabi ni Zaqueo; ipinakita niya ang pagbabago sa gawa. Kapag nasaktan natin ang iba, dapat din nating sikaping itama ang pinsala.',
'Zacchaeus promised to give half his possessions to the poor and repay generously anyone he had cheated. Jesus announced that salvation had come to that house. Zacchaeus did not stop at kind words; he showed a changed heart through action. When we hurt someone or take what is not ours, we should try to repair the harm rather than make excuses.'
),
moral:L('Ang pagbabago ay nakikita sa tapat na pagbawi at pagbabahagi.','Real change is shown by honest repayment and generosity.'),
spiritual:L('Hinahanap at tinatanggap ni Jesus ang mga taong handang magbago.','Jesus seeks and welcomes people who are willing to change.'),
prayer:L('Jesus, gawin Mo akong tapat at handang itama ang aking pagkakamali. Amen.','Jesus, make me honest and ready to correct my mistakes. Amen.'),
event:{question:L('Bakit umakyat si Zaqueo sa puno?','Why did Zacchaeus climb a tree?'),correct:L('Upang makita si Jesus sa dami ng tao','To see Jesus over the crowd'),wrong:[L('Upang mamitas ng mangga','To pick mangoes'),L('Upang magtago sa ulan','To hide from rain')]},
lessonAnswer:L('Ang pagsisisi ay may kasamang tapat na pagkilos.','Repentance includes honest action.'),
application:L('Isauli ang bagay na hindi sa iyo at humingi ng tawad.','Return something that is not yours and apologize.')
},
{
id:'muling-binuhay-si-lazaro',emoji:'🌿',age:9,title:L('Si Lazaro at ang Pag-asa','Lazarus and Hope'),reference:'John 11:1–44',
narrative:L(
'Magkakaibigan sina Jesus, Maria, Marta, at ang kapatid nilang si Lazaro. Nang magkasakit si Lazaro, nagpadala ng balita ang magkapatid kay Jesus. Ngunit bago dumating si Jesus sa kanilang tahanan sa Betania, namatay si Lazaro. Maraming tao ang dumating upang damayan sina Maria at Marta. Malalim ang kanilang kalungkutan at marami silang tanong.',
'Jesus was close to Mary, Martha, and their brother Lazarus. When Lazarus became sick, the sisters sent word to Jesus. Before Jesus reached their home in Bethany, Lazarus died. Many friends came to comfort Mary and Martha. Their grief was deep, and they struggled with questions about why their brother was gone.',
)+'\n\n'+
'Lumapit si Marta kay Jesus at nagsabi ng kaniyang kalungkutan at pag-asa. Sinabi ni Jesus na Siya ang muling pagkabuhay at ang buhay. Pagdating sa libingan ay nakita rin Niya ang pag-iyak ng mga tao. Naluha si Jesus. Hindi Niya minamaliit ang kanilang pagdadalamhati. Lumapit Siya sa libingang tinatakpan ng malaking bato.',
'Martha met Jesus and spoke honestly about her sorrow and hope. Jesus told her that He is the resurrection and the life. When He came to the tomb, He saw the people weeping. Jesus Himself wept. He did not dismiss their grief or tell them they were wrong to cry. He went to the tomb, which was closed with a large stone.',
)+'\n\n'+
'Pinatanggal ni Jesus ang bato, nagpasalamat sa Ama, at tinawag si Lazaro na lumabas. Lumabas si Lazaro na nakabalot pa sa telang panlibing. Namangha ang mga nakakita. Ang kuwentong ito ay hindi pangakong hindi tayo malulungkot o mawawalan ng mahal sa buhay. Ipinapakita nito ang habag ni Jesus at ang pag-asa ng muling pagkabuhay na Kaniyang ipinapahayag.',
'Jesus told them to remove the stone, thanked the Father, and called Lazarus to come out. Lazarus came out, still wrapped in burial cloths, and the people were amazed. This story does not promise that we will never grieve or lose people we love. It shows Jesus’ compassion and the hope of resurrection that He proclaimed.'
),
moral:L('Samahan at damayan ang mga taong nagdadalamhati.','Stand beside people who are grieving.'),
spiritual:L('Si Jesus ang muling pagkabuhay at ang buhay; may habag Siya sa nagdurusa.','Jesus is the resurrection and the life, and He has compassion for those who suffer.'),
prayer:L('Jesus, samahan Mo ang mga malungkot at bigyan kami ng pag-asa sa gitna ng pagdadalamhati. Amen.','Jesus, comfort those who grieve and give us hope in sorrow. Amen.'),
event:{question:L('Ano ang ginawa ni Jesus nang makita ang mga taong umiiyak?','What did Jesus do when He saw the people grieving?'),correct:L('Siya rin ay umiyak','He wept too'),wrong:[L('Pinagtawanan Niya sila','He laughed at them'),L('Lumayo Siya agad','He immediately walked away')]},
lessonAnswer:L('Ang pakikiramay ay mahalaga sa oras ng lungkot.','Compassion matters in times of grief.'),
application:L('Makinig at damayan ang isang taong nalulungkot.','Listen to and comfort someone who is sad.')
},
{
id:'kamatayan-at-muling-pagkabuhay',emoji:'🌅',age:9,title:L('Ang Krus at Muling Pagkabuhay','The Cross and Resurrection'),reference:'Luke 22–24; John 19–20',
narrative:L(
'Bago Siya dakpin, naghapunan si Jesus kasama ang Kaniyang mga alagad at itinuro ang pagmamahal at paglilingkod. Sa hardin ng Getsemani ay nanalangin Siya nang may matinding kalungkutan ngunit nagtiwala sa kalooban ng Ama. Dinakip Siya, nilitis nang hindi makatarungan, at ipinako sa krus. Namatay si Jesus at inilibing sa isang libingang tinakpan ng bato.',
'Before His arrest, Jesus shared a meal with His disciples and taught them about love and service. In the garden of Gethsemane He prayed through deep sorrow and trusted the Father’s will. He was arrested, subjected to an unjust trial, and crucified. Jesus died, and His body was placed in a tomb closed with a stone.',
)+'\n\n'+
'Maagang pumunta sa libingan ang ilang babaeng tagasunod ni Jesus upang alagaan ang Kaniyang bangkay. Natagpuan nilang naalis ang bato at wala na ang katawan doon. Ipinahayag ng mga anghel na si Jesus ay muling nabuhay. Nagmadali silang magbalita sa mga alagad. Noong una ay nahirapan ang ilan na maniwala dahil napakalaki ng pangyayari.',
'Early in the morning, women who followed Jesus went to the tomb to care for His body. They found that the stone had been moved and His body was no longer there. Angels announced that Jesus had risen. The women hurried to tell the disciples. At first some found the news difficult to believe because it was so astonishing.',
)+'\n\n'+
'Nagpakita ang muling nabuhay na si Jesus sa Kaniyang mga tagasunod at nagdala ng kapayapaan. Ang Pasko ng Pagkabuhay ay pagdiriwang ng tagumpay ng buhay at pag-ibig ng Diyos, hindi pagwawalang-bahala sa sakit na dulot ng kamatayan. Itinuturo ng kuwento na seryoso ang kasamaan at paghihirap, ngunit ang pag-asa kay Cristo ay mas malalim kaysa sa ating takot.',
'The risen Jesus appeared to His followers and brought them peace. Easter celebrates the victory of life and God’s love. It does not ask us to pretend that death and suffering are painless. The story teaches that evil and grief are real, yet Christian hope rests on the risen Christ, whose love is stronger than fear.'
),
moral:L('Magmahal at maglingkod kahit mahirap; huwag mawalan ng pag-asa.','Love and serve through difficulty; do not surrender hope.'),
spiritual:L('Namatay si Jesus at muling nabuhay; sa Kaniya nakaugat ang pag-asang Kristiyano.','Jesus died and rose again; Christian hope is rooted in Him.'),
prayer:L('Panginoong Jesus, salamat sa Iyong pag-ibig at muling pagkabuhay. Turuan Mo akong umasa at magmahal. Amen.','Lord Jesus, thank You for Your love and resurrection. Teach me to hope and love. Amen.'),
event:{question:L('Ano ang natagpuan ng mga babae sa libingan ni Jesus?','What did the women find at Jesus’ tomb?'),correct:L('Nailipat ang bato at wala roon ang katawan ni Jesus','The stone moved and Jesus’ body was gone'),wrong:[L('Isang malaking korona','A large crown'),L('Maraming tinapay at isda','Many loaves and fish')]},
lessonAnswer:L('Ang pag-ibig at pag-asa ay mahalaga kahit may pagdurusa.','Love and hope matter even through suffering.'),
application:L('Magbigay ng pag-asa at pagmamahal sa taong nahihirapan.','Offer hope and love to someone struggling.')
}
];