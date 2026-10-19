/**
 * ABAKA ng Bagong Likha
 * Sunday-school lessons for BUKLOD. Each letter is an original lesson.
 * The A–Z outline is only a reference to Robert J. Sargent’s
 * The ABC’s of Christian Growth (1978). This file is not that book.
 */
export type FaithBibleReference = {
  label: string;
  bookNo: number;
  chapter: number;
  verse: number;
  endVerse?: number;
};

export type AbcBlockKind =
  | 'heading'
  | 'body'
  | 'question'
  | 'homework'
  | 'memory'
  | 'notes';

export type AbcBlock = {
  id: string;
  text: string;
  kind: AbcBlockKind;
  answerable: boolean;
  refs: FaithBibleReference[];
};

export type AbcLesson = {
  id: string;
  code: string;
  title: string;
  order: number;
  sourcePages: [number, number];
  blocks: AbcBlock[];
  references: FaithBibleReference[];
};

export const ABC_SOURCE = {
  title: 'ABAKA ng Bagong Likha',
  englishTitle: 'A Sunday-school path from A to Z, with Jesus at the center',
  author: 'Robert J. Sargent',
  copyright:
    'Sanggunian lamang ang balangkas na A–Z ng The ABC’s of Christian Growth (1978). Ang mga araling ito ay sariling teksto ng BUKLOD para sa Sunday school.',
  sourceLabel: 'ABAKA ng Bagong Likha',
} as const;

type Verse = FaithBibleReference;

function v(
  label: string,
  bookNo: number,
  chapter: number,
  verse: number,
  endVerse?: number,
): Verse {
  return endVerse == null
    ? { label, bookNo, chapter, verse }
    : { label, bookNo, chapter, verse, endVerse };
}

type Piece = {
  text: string;
  kind?: AbcBlockKind;
  answerable?: boolean;
  refs?: Verse[];
};

function lesson(
  id: string,
  code: string,
  title: string,
  order: number,
  pieces: Piece[],
): AbcLesson {
  const blocks: AbcBlock[] = pieces.map((piece, index) => ({
    id: `b${String(index + 1).padStart(3, '0')}`,
    text: piece.text.replace(/\s+/g, ' ').trim(),
    kind: piece.kind ?? 'body',
    answerable: Boolean(piece.answerable),
    refs: piece.refs ?? [],
  }));

  for (const block of blocks) {
    if (
      block.answerable &&
      (/^[_\s.—-]+$/.test(block.text) || block.text.length < 24)
    ) {
      throw new Error(
        `ABAKA ${id} ${block.id} has a blank that is not a real question.`,
      );
    }
  }

  const references: Verse[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    for (const ref of block.refs) {
      const key = `${ref.bookNo}:${ref.chapter}:${ref.verse}`;
      if (seen.has(key)) continue;
      seen.add(key);
      references.push(ref);
    }
  }

  return {
    id,
    code,
    title,
    order,
    sourcePages: [order + 1, order + 1],
    blocks,
    references,
  };
}

const q = (
  text: string,
  refs: Verse[],
): Piece => ({
  text,
  kind: 'question',
  answerable: true,
  refs,
});

export const ABC_LESSONS: AbcLesson[] = [
  lesson('intro', 'Panimula', 'Paano gamitin ang ABAKA', 0, [
    {
      kind: 'heading',
      text: 'ABAKA ng Bagong Likha',
    },
    {
      text: 'Ang ABAKA ay landas ng Sunday school mula titik A hanggang Z. Isang katotohanan bawat Linggo. Ang bagong likha ay ang taong na kay Kristo: luma na ang dating buhay, bago na ang buhay na galing sa Dios (2 Corinto 5:17). Si Hesus ang sentro ng bawat titik, hindi ang guro at hindi ang grupo.',
      refs: [v('2 Corinto 5:17', 47, 5, 17)],
    },
    {
      text: 'Ganito ang aralin: basahin nang malakas ang talata, sagutin ang tanong mula sa talatang iyon, pag-usapan nang mahinahon, at magtapos sa panalangin. Ang sagot na hinahanap ay nasa Biblia. Ang huling tanong ay para sa sarili mong hakbang ngayong linggo.',
    },
    {
      kind: 'notes',
      text: 'Sanggunian lamang ang may-akda ng lumang balangkas na A–Z, si Robert J. Sargent (1978). Hindi sipi ng aklat niya ang mga salita rito. Kung ang isang liksyon ay humihila palayo kay Hesus patungo sa isang kampo, ibalik sa titik at sa ebanghelyo.',
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: ang sinumang na kay Kristo ay bagong likha na.',
      refs: [v('2 Corinto 5:17', 47, 5, 17)],
    },
  ]),

  lesson(
    'prelim-01',
    'P1',
    'Ano ang kaligtasan kay Hesus',
    1,
    [
      {
        kind: 'heading',
        text: 'P1 — Kaligtasan bago ang paglago',
      },
      {
        text: 'Hindi premyo ang kaligtasan sa taong mabait. Ito ay pagliligtas ng Dios mula sa kasalanan at kamatayan, sa pamamagitan ng biyaya, sa pananampalataya kay Hesukristo. Siya ang namatay para sa ating mga kasalanan at nabuhay na mag-uli. Ang tinatanggap Siya ay nagiging anak ng Dios.',
        refs: [
          v('Roma 3:23', 45, 3, 23),
          v('Roma 6:23', 45, 6, 23),
          v('Efeso 2:8-9', 49, 2, 8, 9),
        ],
      },
      {
        kind: 'memory',
        text: 'Kabisaduhin ang diwa: ang biyaya ng Dios ang nagliligtas, sa pananampalataya, hindi ang gawa upang walang magmalaki.',
        refs: [v('Efeso 2:8-9', 49, 2, 8, 9)],
      },
      q(
        'Buksan ang Roma 3:23. Ano ang estado ng lahat ng tao sa harap ng Dios, ayon sa talatang ito?',
        [v('Roma 3:23', 45, 3, 23)],
      ),
      q(
        'Buksan ang Roma 6:23. Ano ang kabayaran ng kasalanan, at ano ang kaloob ng Dios kay Cristo Hesus na ating Panginoon?',
        [v('Roma 6:23', 45, 6, 23)],
      ),
      q(
        'Buksan ang Juan 1:12. Ano ang karapatan ng mga tumanggap kay Hesus at sumampalataya sa Kanyang pangalan?',
        [v('Juan 1:12', 43, 1, 12)],
      ),
      q(
        'Buksan ang Gawa 4:12. Mayroon bang ibang pangalan na ibinigay sa tao upang tayo ay maligtas? Isulat ang sagot mula sa talata.',
        [v('Gawa 4:12', 44, 4, 12)],
      ),
      {
        kind: 'homework',
        answerable: true,
        text: 'Sa isang pangungusap, isulat kung bakit si Hesus — hindi ang iyong mabuting gawa — ang iyong kaligtasan.',
        refs: [v('Juan 14:6', 43, 14, 6)],
      },
      {
        kind: 'notes',
        text: 'Para sa guro: huwag hiyain ang taong nagtatanong. Iharap si Kristo nang malinaw, at huwag dagdagan ng tuntunin ng grupo bago maunawaan ang ebanghelyo.',
      },
    ],
  ),

  lesson(
    'prelim-02',
    'P2',
    'Ano ang hinihintay ng Dios sa anak Niya',
    2,
    [
      {
        kind: 'heading',
        text: 'P2 — Lumago kay Kristo',
      },
      {
        text: 'Ang sanggol na mananampalataya ay tunay nang anak. Hindi siya binabayaran ng Dios para maging anak. Hinihintay Niyang lumago: magmahal kay Hesus, marinig ang Salita, manalangin, at makiisa sa iglesya. Ang paglago ay bunga ng buhay, hindi bayad sa kaligtasan.',
        refs: [
          v('1 Pedro 2:2', 60, 2, 2),
          v('2 Pedro 3:18', 61, 3, 18),
        ],
      },
      {
        kind: 'memory',
        text: 'Kabisaduhin ang diwa: lumago sa biyaya at sa pagkakilala sa ating Panginoong Jesus.',
        refs: [v('2 Pedro 3:18', 61, 3, 18)],
      },
      q(
        'Buksan ang 1 Pedro 2:2. Ano ang dapat nasain ng bagong mananampalataya, gaya ng sanggol sa gatas, at bakit?',
        [v('1 Pedro 2:2', 60, 2, 2)],
      ),
      q(
        'Buksan ang Efeso 4:15. Saan tayo dapat lumago, at sino ang ulo na patungo sa Kanya ang paglago?',
        [v('Efeso 4:15', 49, 4, 15)],
      ),
      q(
        'Buksan ang Mikas 6:8. Ano ang tatlong bagay na ipinakita ng Dios na mabuti, sa halip na mabigat na seremonya lamang?',
        [v('Mikas 6:8', 33, 6, 8)],
      ),
      q(
        'Buksan ang Juan 15:5. Kung hiwalay tayo kay Hesus, ano ang ating magagawa? Isulat ang sagot ng Panginoon.',
        [v('Juan 15:5', 43, 15, 5)],
      ),
      {
        kind: 'homework',
        answerable: true,
        text: 'Isulat ang isang paraan ng paglago na sisimulan mo ngayong linggo: Salita, panalangin, o pagmamahal sa kapatid.',
      },
      {
        kind: 'notes',
        text: 'Para sa guro: huwag gawing unang hinihingi ang pera o ang estilo ng damit. Ang unang hinihintay ng Ama ay ang anak na manatili kay Hesus.',
      },
    ],
  ),

  lesson('lesson-01', 'A', 'Awa — katiyakan ng kaligtasan', 3, [
    {
      kind: 'heading',
      text: 'A — Awa. Ang katiyakan ay hawak ni Hesus.',
    },
    {
      text: 'Ang awa ng Dios ang dahilan kung bakit may katiyakan ang mananampalataya. Hindi ito ang damdamin ng pinakamagandang araw mo. Si Hesus ang nangako, ang Salita ang nagsasabi, at ang Espiritu ang sumasaksi na tayo ay anak. Ang pagdududa ay puwedeng dumalaw. Ang sagot ay bumalik sa pangako, hindi sa pagkukunwari na wala kang takot.',
      refs: [
        v('1 Juan 5:11-13', 62, 5, 11, 13),
        v('Juan 10:27-29', 43, 10, 27, 29),
      ],
    },
    {
      text: 'May babala rin ang Biblia laban sa pusong tumatalikod. Ang tunay na pananampalataya ay nananatili kay Kristo. Hindi ito lisensya para mamuhay nang laban sa Kanya. At hindi rin ibig sabihin na isang kasalanan ay bubura sa krus. Ang katiyakan at ang pagbabantay ay magkapit.',
      refs: [v('Roma 8:1', 45, 8, 1), v('1 Juan 2:19', 62, 2, 19)],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: isinulat ito upang malaman ninyong may buhay na walang hanggan kayo na sumasampalataya sa Anak.',
      refs: [v('1 Juan 5:13', 62, 5, 13)],
    },
    q(
      'Buksan ang 1 Juan 5:11-12. Saan inilagay ng Dios ang buhay na walang hanggan, at sino ang may buhay?',
      [v('1 Juan 5:11-12', 62, 5, 11, 12)],
    ),
    q(
      'Buksan ang Juan 10:28-29. Ano ang sinabi ni Hesus tungkol sa mga tupa Niya at sa kamay ng Ama?',
      [v('Juan 10:28-29', 43, 10, 28, 29)],
    ),
    q(
      'Buksan ang Roma 8:1. Ano ang wala na sa mga na kay Cristo Hesus?',
      [v('Roma 8:1', 45, 8, 1)],
    ),
    q(
      'Buksan ang Roma 8:38-39. Mayroon bang nilalang na makapaghihiwalay sa atin sa pag-ibig ng Dios na na kay Cristo Hesus? Isulat ang diwa ng sagot.',
      [v('Roma 8:38-39', 45, 8, 38, 39)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Kapag dumating ang pagdududa ngayong linggo, aling pangako ni Hesus ang babalikan mo? Isulat ang talata at kung bakit.',
      refs: [v('Juan 10:28', 43, 10, 28)],
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag sabihing “hindi ka tunay na Kristiyano” dahil lang nag-alinlangan. Ituro ang krus. Huwag din sabihing “sigurado ka na, gawin mo ang gusto mo.”',
    },
  ]),

  lesson('lesson-02', 'B', 'Biblia — salita na humahantong kay Hesus', 4, [
    {
      kind: 'heading',
      text: 'B — Biblia. Ang Salita ay hininga ng Dios.',
    },
    {
      text: 'Ang Biblia ay sulat ng Dios sa pamamagitan ng mga tao, kapaki-pakinabang upang ituro, sawayin, ituwid, at sanayin sa katuwiran. Hindi ito librong pampalamuti. Ang sentro ng Kasulatan ay si Kristo: ang batas, ang mga propeta, at ang mga sulat ay humahantong sa Kanya.',
      refs: [
        v('2 Timoteo 3:16-17', 55, 3, 16, 17),
        v('Lucas 24:27', 42, 24, 27),
      ],
    },
    {
      text: 'Iningatan ng Dios ang Kanyang salita sa maraming tapat na kasulatan at saling-wika. Ang malinaw na salin sa wikang naiintindihan mo ay kaloob, hindi kakumpitensya ng ebanghelyo. Basahin kasama ng iglesya. Huwag gawing sariling hari ang opinyon mo, at huwag ding gawing idolo ang isang edisyon sa Ingles.',
      refs: [v('Awit 119:105', 19, 119, 105), v('Juan 5:39', 43, 5, 39)],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: ang salita ng Dios ay lampara sa paa at ilaw sa landas.',
      refs: [v('Awit 119:105', 19, 119, 105)],
    },
    q(
      'Buksan ang 2 Timoteo 3:16. Ano ang pinagmulan ng lahat ng Kasulatan, at sa anong apat na bagay ito kapaki-pakinabang?',
      [v('2 Timoteo 3:16', 55, 3, 16)],
    ),
    q(
      'Buksan ang Juan 5:39. Ano ang sinabi ni Hesus na tinuturo ng mga Kasulatan tungkol sa Kanya?',
      [v('Juan 5:39', 43, 5, 39)],
    ),
    q(
      'Buksan ang Lucas 24:27. Sino ang ipinaliwanag ni Hesus mula sa buong Kasulatan sa daan patungong Emmaus?',
      [v('Lucas 24:27', 42, 24, 27)],
    ),
    q(
      'Buksan ang Santiago 1:22. Ano ang dapat gawin sa salita, bukod sa pakikinig lamang?',
      [v('Santiago 1:22', 59, 1, 22)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Pumili ng isang maikling talata ngayong linggo. Isulat kung paano ka nito inilalapit kay Hesus, hindi lang kung ano ang natutuhan mong impormasyon.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag ituro na isang Ingles na salin lamang ang salita ng Dios. Ituro ang katapatan ng Kasulatan at si Kristo bilang susi nito.',
    },
  ]),

  lesson('lesson-03', 'C', 'Cristo at ang Kanyang iglesya', 5, [
    {
      kind: 'heading',
      text: 'C — Cristo ang ulo. Ang iglesya ay Kanyang katawan.',
    },
    {
      text: 'Itinayo ni Hesus ang Kanyang iglesya. Siya ang ulo, hindi ang pastor, hindi ang tradisyon, at hindi ang isang pangalan ng grupo. Ang iglesya ay mga taong tinawag Niya, nagtitipon sa Salita, panalangin, bautismo, hapunan, pag-aaruga, at misyon. Mahalaga ang lokal na iglesya. Hindi nito pag-aari ang ebanghelyo.',
      refs: [
        v('Mateo 16:18', 40, 16, 18),
        v('Colosas 1:18', 51, 1, 18),
        v('Gawa 2:42', 44, 2, 42),
      ],
    },
    {
      text: 'Maaari tayong magkaiba ng awit, ng kaayusan, at ng ilang paliwanag. Hindi tayo puwedeng magkaiba kung sino si Hesus at kung paano lumiligtas ang Dios. Ang pagmamahal sa sariling iglesya ay hindi dahilan para hamakin ang kapatid na nananatili sa ebanghelyo sa ibang tahanan.',
      refs: [v('Efeso 1:22-23', 49, 1, 22, 23)],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: si Kristo ang ulo ng iglesya.',
      refs: [v('Colosas 1:18', 51, 1, 18)],
    },
    q(
      'Buksan ang Mateo 16:18. Sino ang nagsabing “itatayo ko ang aking iglesya,” at kanino ang iglesya ayon sa panghalip?',
      [v('Mateo 16:18', 40, 16, 18)],
    ),
    q(
      'Buksan ang Colosas 1:18. Ano ang tungkulin ni Kristo sa iglesya?',
      [v('Colosas 1:18', 51, 1, 18)],
    ),
    q(
      'Buksan ang Gawa 2:42. Ano ang apat na bagay na pinagpatuloy ng unang iglesya?',
      [v('Gawa 2:42', 44, 2, 42)],
    ),
    q(
      'Buksan ang Juan 13:34-35. Paano makikilala ng mundo ang mga alagad ni Hesus?',
      [v('Juan 13:34-35', 43, 13, 34, 35)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang paraan ng paglilingkod sa iyong lokal na iglesya ngayong linggo na nagpapakita kay Hesus, hindi ng sariling pangalan.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag ituro na isang denominasyon lamang ang tunay na iglesya. Ituro si Kristo bilang ulo, at ang lokal na tipanan bilang tahanan ng pagsunod.',
    },
  ]),

  lesson('lesson-04', 'D', 'Daan — araw-araw na lakad kay Hesus', 6, [
    {
      kind: 'heading',
      text: 'D — Daan. Araw-araw na sumusunod sa Panginoon.',
    },
    {
      text: 'Tinawag ni Hesus ang alagad na magkaila araw-araw, pasanin ang krus, at sumunod. Ang daan ay hindi palabas para mapansin. Ito ay tahimik na katapatan: Salita, panalangin, pagpapasalamat, at gawaing ginagawa para sa Panginoon. Ang isang araw na bagsak ay hindi ang wakas. Bumangon at lumakad muli sa Kanya.',
      refs: [v('Lucas 9:23', 42, 9, 23), v('Colosas 3:17', 51, 3, 17)],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: kung ang sinuman ay sumusunod sa akin, magkaila siya araw-araw at buhatin ang kanyang krus.',
      refs: [v('Lucas 9:23', 42, 9, 23)],
    },
    q(
      'Buksan ang Lucas 9:23. Ano ang tatlong bahagi ng tawag ni Hesus sa sumusunod sa Kanya?',
      [v('Lucas 9:23', 42, 9, 23)],
    ),
    q(
      'Buksan ang Awit 1:2. Saan nasisiyahan ang taong pinagpala, araw at gabi?',
      [v('Awit 1:2', 19, 1, 2)],
    ),
    q(
      'Buksan ang 1 Tesalonica 5:16-18. Ano ang tatlong utos ni Pablo na angkop sa araw-araw?',
      [v('1 Tesalonica 5:16-18', 52, 5, 16, 18)],
    ),
    q(
      'Buksan ang Colosas 3:17. Sa kaninong pangalan dapat gawin ang salita at gawa, at kanino tayo magpasalamat?',
      [v('Colosas 3:17', 51, 3, 17)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Pumili ng isang oras bukas. Isulat kung ano ang gagawin mo roon kasama ni Hesus: basahin, manalangin, o magpasalamat.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag gawing scorecard ang debosyon. Ang daan ay paglapit, hindi paligsahan.',
    },
  ]),

  lesson('lesson-05', 'E', 'Kaaway — talunan na ni Hesus', 7, [
    {
      kind: 'heading',
      text: 'E — Ang kaaway. Totoo siya. Natalo na siya.',
    },
    {
      text: 'May kaaway ang bayan ng Dios. Sinungaling siya at tagapag-akusa. Para siyang leong umaatungal, kaya kailangan ang pagbabantay. Ngunit sa krus at sa pagkabuhay na mag-uli, winasak ni Hesus ang may hawak ng kamatayan. Lumalaban tayo sa pananampalataya, sa katotohanan, at sa dugo ng Kordero — hindi sa takot at hindi sa pang-iinsulto.',
      refs: [
        v('1 Pedro 5:8-9', 60, 5, 8, 9),
        v('Hebreo 2:14', 58, 2, 14),
        v('Apocalipsis 12:11', 66, 12, 11),
      ],
    },
    {
      text: 'Ang mga taong hindi pa sumasampalataya ay hindi paligsahan ng pangalan. Sila ang mga taong iniibig ng Dios at pinagkamatayan ni Kristo. Ang kaaway ay ang mandaraya, hindi ang kapitbahay.',
      refs: [v('Juan 3:16', 43, 3, 16)],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: labanan ninyo ang diyablo, at siya ay tatakas sa inyo.',
      refs: [v('Santiago 4:7', 59, 4, 7)],
    },
    q(
      'Buksan ang Juan 8:44. Ano ang dalawang katangian ng diyablo na sinabi ni Hesus tungkol sa kasinungalingan?',
      [v('Juan 8:44', 43, 8, 44)],
    ),
    q(
      'Buksan ang Hebreo 2:14. Sa pamamagitan ng ano winasak ni Hesus ang may hawak ng kapangyarihan ng kamatayan?',
      [v('Hebreo 2:14', 58, 2, 14)],
    ),
    q(
      'Buksan ang 1 Pedro 5:8-9. Ano dapat ang ginagawa ng mananampalataya, at sa ano siya matatag?',
      [v('1 Pedro 5:8-9', 60, 5, 8, 9)],
    ),
    q(
      'Buksan ang Apocalipsis 12:11. Ano ang tatlong bagay na ginamit upang magtagumpay laban sa tagapag-akusa?',
      [v('Apocalipsis 12:11', 66, 12, 11)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang kasinungalingan na madalas pumapasok sa isip mo, at ang isang katotohanan tungkol kay Hesus na sasagot doon.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag takutin ang bata o ang baguhan. Huwag tawaging anak ng diyablo ang kaklase. Ituro ang tagumpay ni Kristo at ang pag-ibig sa kapwa.',
    },
  ]),

  lesson('lesson-06', 'F', 'Pamilya — tahanan sa ilalim ni Hesus', 8, [
    {
      kind: 'heading',
      text: 'F — Pamilya. Si Kristo muna, bago ang papel ng bawat isa.',
    },
    {
      text: 'Ang mag-asawa, ang magulang, at ang anak ay tinawag sa ilalim ni Kristo. Ang asawang lalaki ay umiibig gaya ng pag-ibig ni Kristo sa iglesya, na nag-alay ng sarili. Ang asawang babae ay gumagalang sa ilalim ng Panginoon, hindi sa ilalim ng takot. Ang magulang ay hindi nagpapagalit sa anak. Ang anak ay nagpaparangal. Ang pagiging walang asawa ay marangal din sa Panginoon.',
      refs: [
        v('Efeso 5:21-25', 49, 5, 21, 25),
        v('Efeso 6:1-4', 49, 6, 1, 4),
        v('1 Corinto 7:7-8', 46, 7, 7, 8),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: magpasakop kayo sa isa’t isa dahil sa paggalang kay Kristo.',
      refs: [v('Efeso 5:21', 49, 5, 21)],
    },
    q(
      'Buksan ang Genesis 2:18. Ano ang sinabi ng Dios na hindi mabuti, at ano ang gagawin Niya?',
      [v('Genesis 2:18', 1, 2, 18)],
    ),
    q(
      'Buksan ang Efeso 5:25. Paano dapat ibigin ng mga asawang lalaki ang kanilang asawa?',
      [v('Efeso 5:25', 49, 5, 25)],
    ),
    q(
      'Buksan ang Efeso 6:4. Ano ang bawal gawin ng mga ama, at ano ang dapat nilang gawin?',
      [v('Efeso 6:4', 49, 6, 4)],
    ),
    q(
      'Buksan ang Marcos 10:13-16. Paano tinanggap ni Hesus ang mga bata, at ano ang sinabi Niya sa mga alagad?',
      [v('Marcos 10:14-16', 41, 10, 14, 16)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang salita o gawa ngayong linggo na magpapalapit ng iyong tahanan — o ng taong kasama mo — kay Hesus.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag gamitin ang “ulo ng tahanan” para takpan ang galit o pananakit. Ang halimbawa ay ang krus. Protektahan ang bata. Ang karahasan ay hindi pagsunod.',
    },
  ]),

  lesson('lesson-07', 'G', 'Dios — Ama, Anak, at Espiritu Santo', 9, [
    {
      kind: 'heading',
      text: 'G — Dios. Iisa. Tatlong persona. Kilala natin Siya kay Hesus.',
    },
    {
      text: 'Ang Dios ay iisa. Wala nang ibang Dios. Kasabay nito, kinikilala ng Biblia ang Ama, ang Anak, at ang Espiritu Santo bilang Dios, magkakasama sa paglikha, sa bautismo, at sa pagbabasbas. Hindi ito tatlong dios. Hindi rin ito isang persona na nagpapalit lang ng maskara. Si Hesus ang nagpakilala sa Ama. Ang nakakita sa Kanya ay nakakita sa Ama.',
      refs: [
        v('Deuteronomio 6:4', 5, 6, 4),
        v('Mateo 28:19', 40, 28, 19),
        v('Juan 1:1', 43, 1, 1),
        v('Juan 14:9', 43, 14, 9),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: ang Salita ay Dios, at ang Salita ay nagkatawang-tao.',
      refs: [v('Juan 1:1', 43, 1, 1), v('Juan 1:14', 43, 1, 14)],
    },
    q(
      'Buksan ang Deuteronomio 6:4. Ilan ang Panginoon ayon sa pagpapahayag na ito?',
      [v('Deuteronomio 6:4', 5, 6, 4)],
    ),
    q(
      'Buksan ang Juan 1:1. Ano ang sinabi tungkol sa Salita at sa Dios?',
      [v('Juan 1:1', 43, 1, 1)],
    ),
    q(
      'Buksan ang Mateo 28:19. Sa anong isang pangalan — at sa anong tatlong persona — tayo binabautismuhan?',
      [v('Mateo 28:19', 40, 28, 19)],
    ),
    q(
      'Buksan ang 2 Corinto 13:14. Sino ang tatlong binanggit sa basbas, at anong kaloob ang galing sa bawat isa?',
      [v('2 Corinto 13:14', 47, 13, 14)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang katotohanan tungkol sa Dios na nakita mo kay Hesus, hindi lang sa ideya.',
      refs: [v('Juan 14:9', 43, 14, 9)],
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag paliitin si Hesus bilang “mabuting guro lang,” at huwag dagdagan ng ikaapat na persona. Ang hiwaga ay sinasamba, hindi nilulusutan.',
    },
  ]),

  lesson('lesson-08', 'H', 'Espiritu Santo — nagpapatotoo kay Hesus', 10, [
    {
      kind: 'heading',
      text: 'H — Ang Banal na Espiritu. Hindi Siya pumapalit kay Hesus. Inilalapit Niya tayo kay Hesus.',
    },
    {
      text: 'Ang Espiritu Santo ay Dios, ang Tagapagtanggol na ipinangako ni Hesus. Siya ang sumusumbat sa kasalanan, sa katuwiran, at sa paghatol. Siya ang nagsisilang muli, nananahan sa mananampalataya, at sumisigaw na tayo ay anak. Ang bunga Niya ay pag-ibig, kagalakan, kapayapaan, pagtitiyaga, kagandahang-loob, kabutihan, katapatan, kaamuan, at pagpipigil.',
      refs: [
        v('Juan 16:8-14', 43, 16, 8, 14),
        v('Roma 8:15-16', 45, 8, 15, 16),
        v('Galacia 5:22-23', 48, 5, 22, 23),
      ],
    },
    {
      text: 'May mga kaloob Siya para sa ikabubuti ng iglesya. Ang kaloob ay hindi patunay na mas ligtas ka kaysa sa kapatid. Ang palabas na walang pag-ibig ay walang saysay. Huwag patayin ang Espiritu, at huwag din Siya gawing ingay na hindi tumuturo kay Kristo. Ang gawain Niyang malinaw ay luwalhatiin si Hesus.',
      refs: [v('1 Corinto 12:4-7', 46, 12, 4, 7), v('Juan 16:14', 43, 16, 14)],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: ang Espiritu ay magpaparangal kay Hesus.',
      refs: [v('Juan 16:14', 43, 16, 14)],
    },
    q(
      'Buksan ang Juan 16:13-14. Kanino manggagaling ang sinasabi ng Espiritu, at sino ang Kanyang luluwalhatiin?',
      [v('Juan 16:13-14', 43, 16, 13, 14)],
    ),
    q(
      'Buksan ang Juan 16:8. Ano ang tatlong bagay na pagsusumbatan ng Espiritu sa sanlibutan?',
      [v('Juan 16:8', 43, 16, 8)],
    ),
    q(
      'Buksan ang Roma 8:9. Kanino ang Espiritu, at ano ang sinabi tungkol sa taong wala ang Espiritu ni Kristo?',
      [v('Roma 8:9', 45, 8, 9)],
    ),
    q(
      'Buksan ang Galacia 5:22-23. Pangalanan ang bunga ng Espiritu. Alin sa mga ito ang pinaka kailangan mo ngayon?',
      [v('Galacia 5:22-23', 48, 5, 22, 23)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Hingin sa Espiritu ngayong linggo na ipakita si Hesus sa isang konkretong ugali. Isulat kung alin.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag pag-awayin ang klase sa “may himala pa ba.” Ituro ang persona ng Espiritu, ang bunga, at si Hesus bilang luwalhati Niya.',
    },
  ]),

  lesson('lesson-09', 'I', 'Ilubog — bautismo ng sumasampalataya', 11, [
    {
      kind: 'heading',
      text: 'I — Ilubog. Larawan ng pagkamatay at pagkabuhay kasama ni Kristo.',
    },
    {
      text: 'Inutos ni Hesus na gumawa ng mga alagad at bautismuhan sila. Sa Bagong Tipan, ang binabautismuhan ay taong tumugon na sa ebanghelyo. Ang paglubog sa tubig ay larawan ng pagkalibing at pagkabuhay kasama ni Kristo. Hindi ang tubig ang naghuhugas ng kasalanan. Ang dugo ni Hesus ang nagliligtas. Ang bautismo ay pagsunod at hayag na pag-amin.',
      refs: [
        v('Mateo 28:19', 40, 28, 19),
        v('Roma 6:3-4', 45, 6, 3, 4),
        v('Gawa 8:36-38', 44, 8, 36, 38),
      ],
    },
    {
      text: 'Itinuturo natin ang paglubog dahil iyon ang larawan ng salita at ng mga ulat. Hindi natin ginagawang hatol na ang kapatid na iba ang natutunan ay hindi anak ng Dios. Ang kaligtasan ay kay Kristo. Ang bautismo ay sagot ng budhi sa Kanya, hindi kapalit Niya.',
      refs: [v('1 Pedro 3:21', 60, 3, 21)],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: nalibing tayong kasama ni Kristo sa bautismo, upang lumakad sa panibagong buhay.',
      refs: [v('Roma 6:4', 45, 6, 4)],
    },
    q(
      'Buksan ang Gawa 8:36-38. Ano ang hiningi ng bating taga-Etiopia bago siya binautismuhan, at saan siya bumaba?',
      [v('Gawa 8:36-38', 44, 8, 36, 38)],
    ),
    q(
      'Buksan ang Roma 6:4. Ano ang larawan ng bautismo, at anong uri ng buhay ang dapat nating lakaran pagkatapos?',
      [v('Roma 6:4', 45, 6, 4)],
    ),
    q(
      'Buksan ang Gawa 2:38. Ano ang dalawang bagay na sinabi ni Pedro, at kaninong pangalan ang binanggit sa bautismo?',
      [v('Gawa 2:38', 44, 2, 38)],
    ),
    q(
      'Buksan ang Efeso 2:8-9. Ano ang hindi nagliligtas, upang walang magmalaki? Iugnay ito sa tubig ng bautismo.',
      [v('Efeso 2:8-9', 49, 2, 8, 9)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Kung nabautismuhan ka na, isulat kung ano ang ipinapahayag noon tungkol kay Hesus. Kung hindi pa, isulat ang isang tanong na iaalok mo sa iyong pastor.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: ituro nang malinaw ang bautismo ng sumasampalataya at ang larawan ng paglubog. Huwag kutyain ang ibang iglesya. Huwag sabihing ang tubig ang tagapagligtas.',
    },
  ]),

  lesson('lesson-10', 'J', 'Jesus — ang sentro ng lahat ng titik', 12, [
    {
      kind: 'heading',
      text: 'J — Jesus. Ganap na Dios. Ganap na tao. Iisang Tagapagligtas.',
    },
    {
      text: 'Si Hesus ang Salita na naging tao. Siya ang larawan ng Dios na hindi nakikita, ang panganay ng lahat ng nilikha sa kahulugang Siya ang una at ang puno, at ang tagapagpagkasundo sa krus. Siya ay tunay na tao: nagutom, tumangis, namatay. Siya ay tunay na Dios: pinatawad ang kasalanan, tumanggap ng pagsamba, nabuhay na mag-uli. Walang ibang daan patungo sa Ama.',
      refs: [
        v('Juan 1:14', 43, 1, 14),
        v('Colosas 1:15-20', 51, 1, 15, 20),
        v('Juan 14:6', 43, 14, 6),
        v('Filipos 2:6-11', 50, 2, 6, 11),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: si Hesus ang daan, ang katotohanan, at ang buhay.',
      refs: [v('Juan 14:6', 43, 14, 6)],
    },
    q(
      'Buksan ang Juan 1:1 at 1:14. Ano ang Salita noong pasimula, at ano ang nangyari sa Salita?',
      [v('Juan 1:1', 43, 1, 1), v('Juan 1:14', 43, 1, 14)],
    ),
    q(
      'Buksan ang Filipos 2:8-11. Ano ang anyo ng pagsunod ni Hesus hanggang kamatayan, at anong pangalan ang ibinigay sa Kanya?',
      [v('Filipos 2:8-11', 50, 2, 8, 11)],
    ),
    q(
      'Buksan ang Colosas 1:19-20. Ano ang kinalugdan ng Ama na manahan kay Kristo, at paano Niya pinagkasundo ang lahat?',
      [v('Colosas 1:19-20', 51, 1, 19, 20)],
    ),
    q(
      'Buksan ang 1 Corinto 15:3-4. Ano ang pinakabuod ng ebanghelyo na tinanggap ni Pablo tungkol sa pagkamatay at pagkabuhay ni Kristo?',
      [v('1 Corinto 15:3-4', 46, 15, 3, 4)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang katotohanan tungkol kay Hesus na hindi mo puwedeng alisin nang hindi gumuho ang iyong pag-asa.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: ito ang puso ng ABAKA. Kung maganda ang asal ng klase pero malabo si Hesus, hindi pa natatapos ang aralin.',
    },
  ]),

  lesson('lesson-11', 'K', 'Kapatiran — pamilya dahil kay Kristo', 13, [
    {
      kind: 'heading',
      text: 'K — Kapatiran. Anak tayo sa pamamagitan ni Hesus, hindi sa apelyido.',
    },
    {
      text: 'Ang tumanggap kay Hesus ay tumatanggap ng karapatang maging anak. Ang Espiritu ang nagpapatotoo na tayo ay tagapagmana kasama ni Kristo. Sa Kanya, wala nang pader ng lahi, katayuan, o kasarian na humahati sa pamilya ng Dios. Ang kapatiran ay bunga ng bagong kapanganakan, hindi ng kasaysayan ng isang grupo.',
      refs: [
        v('Juan 1:12-13', 43, 1, 12, 13),
        v('Roma 8:15-17', 45, 8, 15, 17),
        v('Galacia 3:26-28', 48, 3, 26, 28),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: masdan ninyo kung gaano kalaking pag-ibig ang ibinigay ng Ama upang tayo ay tawaging mga anak.',
      refs: [v('1 Juan 3:1', 62, 3, 1)],
    },
    q(
      'Buksan ang Juan 1:12-13. Paano nagiging anak ang tao — sa dugo, sa laman, o sa Dios?',
      [v('Juan 1:12-13', 43, 1, 12, 13)],
    ),
    q(
      'Buksan ang Roma 8:15-16. Anong espiritu ang tinanggap natin, at ano ang sinasaksihan Niya?',
      [v('Roma 8:15-16', 45, 8, 15, 16)],
    ),
    q(
      'Buksan ang Galacia 3:28. Ano ang nangyayari sa mga dating hati kapag tayo ay na kay Cristo Hesus?',
      [v('Galacia 3:28', 48, 3, 28)],
    ),
    q(
      'Buksan ang 1 Juan 4:20-21. Ano ang hindi puwedeng sabihin ng taong namumuhi sa kapatid na nakikita?',
      [v('1 Juan 4:20-21', 62, 4, 20, 21)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang pangalan ng isang kapatid na paiibigin mo ngayong linggo sa isang konkretong tulong, dahil kayo ay iisang pamilya kay Kristo.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag palitan ang kapatiran ng mahabang lista ng “tunay na angkan” ng iglesya. Ang angkan ay si Kristo.',
    },
  ]),

  lesson('lesson-12', 'L', 'Alaala — hapunan ng Panginoon', 14, [
    {
      kind: 'heading',
      text: 'L — Alaala. Ang hapunan ay pag-alaala at pagpapahayag ng kamatayan ni Hesus.',
    },
    {
      text: 'Noong gabi bago Siya ipagkanulo, kumuha si Hesus ng tinapay at kopa. Sinabi Niyang gawin ito bilang pag-alaala sa Kanya. Sa tuwing kakain at iinom, ipinapahayag ng iglesya ang kamatayan ng Panginoon hanggang sa Siya ay dumating. Hindi ito meryenda. Hindi rin ito paraang maging Diyos ang tinapay na sinasamba nang hiwalay kay Kristo. Siya ang bisita ng mesa. Ang tinapay at ang kopa ay tanda ng katawan at dugo na ibinigay para sa atin.',
      refs: [
        v('Lucas 22:19-20', 42, 22, 19, 20),
        v('1 Corinto 11:23-26', 46, 11, 23, 26),
      ],
    },
    {
      text: 'Bago lumapit, sinusuri ng tao ang sarili. Ang mesa ay para sa mga sumasampalataya kay Kristo at lumalapit nang mapayapa. Ang iglesya ang nag-aasikaso nito. Hindi ito pang-isahan sa sulok, at hindi rin sandata para hiyain ang panauhin. Hindi nito pinapalitan ang krus. Inaalala nito ang krus.',
      refs: [v('1 Corinto 11:27-29', 46, 11, 27, 29)],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: gawin ninyo ito bilang pag-alaala sa akin.',
      refs: [v('Lucas 22:19', 42, 22, 19)],
    },
    q(
      'Buksan ang Lucas 22:19-20. Ano ang sinabi ni Hesus na gawin sa tinapay at sa kopa?',
      [v('Lucas 22:19-20', 42, 22, 19, 20)],
    ),
    q(
      'Buksan ang 1 Corinto 11:26. Ano ang ipinapahayag tuwing kinakain ang tinapay at iniinom ang kopa, at hanggang kailan?',
      [v('1 Corinto 11:26', 46, 11, 26)],
    ),
    q(
      'Buksan ang 1 Corinto 11:28. Ano ang dapat gawin ng tao bago kumain at uminom?',
      [v('1 Corinto 11:28', 46, 11, 28)],
    ),
    q(
      'Buksan ang Mateo 26:27-28. Para sa ano ang dugo ng tipan ayon kay Hesus?',
      [v('Mateo 26:28', 40, 26, 28)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Sa susunod na hapunan ng Panginoon, ano ang aalalahanin mo tungkol sa kamatayan ni Hesus? Isulat ito ngayon.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag gawing debate ang buong oras. Sabihin nang payak: alaala, pasasalamat, pagpapahayag, pagsusuri. Si Hesus ang nasa gitna ng mesa.',
    },
  ]),

  lesson('lesson-13', 'M', 'Misyon — sinugo dahil sinugo si Hesus', 15, [
    {
      kind: 'heading',
      text: 'M — Misyon. Sinugo Niya tayo gaya ng pagsugo ng Ama sa Kanya.',
    },
    {
      text: 'Ang lahat ng kapangyarihan ay kay Hesus. Kaya Niya sinugo ang iglesya: gumawa ng mga alagad, bautismuhan, at turuan silang sundin ang lahat ng iniutos Niya. Ang saksi ay nagsisimula sa iyong lugar at umaabot hanggang sa dulo ng lupa. Ang ilan ay isinusugo nang malayo. Ang iglesya ang nagpapatunay, nagpapadala, at tumutulong. Ang misyon ay si Hesus, hindi ang pangalan ng kampanya.',
      refs: [
        v('Mateo 28:18-20', 40, 28, 18, 20),
        v('Gawa 1:8', 44, 1, 8),
        v('Juan 20:21', 43, 20, 21),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: maging mga saksi kayo, at ako ay kasama ninyo hanggang sa wakas.',
      refs: [v('Gawa 1:8', 44, 1, 8), v('Mateo 28:20', 40, 28, 20)],
    },
    q(
      'Buksan ang Juan 20:21. Kanino inihambing ni Hesus ang pagsugo Niya sa mga alagad?',
      [v('Juan 20:21', 43, 20, 21)],
    ),
    q(
      'Buksan ang Gawa 1:8. Ano ang tatanggapin ng mga alagad, at saan sila magiging saksi?',
      [v('Gawa 1:8', 44, 1, 8)],
    ),
    q(
      'Buksan ang Roma 10:14. Bakit kailangan ang tagapagbalita kung mananampalataya ang tao?',
      [v('Roma 10:14', 45, 10, 14)],
    ),
    q(
      'Buksan ang Gawa 13:2-3. Sino ang nagsabi ng pagsugo kina Bernabe at Saulo, at ano ang ginawa ng iglesya?',
      [v('Gawa 13:2-3', 44, 13, 2, 3)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang pangalan ng isang taong ipapanalangin at lalapitan mo ngayong linggo tungkol kay Hesus.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: ang bata at ang matanda ay parehong saksi. Huwag ipakitang ang misyonero lang ang may bahagi.',
    },
  ]),

  lesson('lesson-14', 'N', 'Isinilang muli — bagong likha kay Kristo', 16, [
    {
      kind: 'heading',
      text: 'N — Bagong kapanganakan. Gawa ng Dios, hindi pag-aayos ng asal.',
    },
    {
      text: 'Sinabi ni Hesus kay Nicodemo na kailangan ng tao na ipanganak na muli upang makita ang kaharian. Ang kapanganakang ito ay sa Espiritu at sa salita, hindi sa tubig bilang mahika at hindi sa pagtigil ng bisyo. Mabuti ang pagbabago ng ugali. Hindi iyon ang bagong likha. Ang bagong likha ay taong na kay Kristo. Ang bunga ay susunod, gaya ng hangin na naririnig kahit hindi hawak.',
      refs: [
        v('Juan 3:3-8', 43, 3, 3, 8),
        v('Tito 3:5', 56, 3, 5),
        v('2 Corinto 5:17', 47, 5, 17),
        v('1 Pedro 1:23', 60, 1, 23),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: kung ang sinuman ay na kay Kristo, siya ay bagong likha.',
      refs: [v('2 Corinto 5:17', 47, 5, 17)],
    },
    q(
      'Buksan ang Juan 3:3. Ano ang kailangan upang makita ng tao ang kaharian ng Dios?',
      [v('Juan 3:3', 43, 3, 3)],
    ),
    q(
      'Buksan ang Tito 3:5. Ano ang hindi dahilan ng pagliligtas, at ano ang ginawa ng Dios sa pamamagitan ng Espiritu?',
      [v('Tito 3:5', 56, 3, 5)],
    ),
    q(
      'Buksan ang 1 Pedro 1:23. Sa pamamagitan ng ano tayo ipinanganak na muli?',
      [v('1 Pedro 1:23', 60, 1, 23)],
    ),
    q(
      'Buksan ang Juan 3:8. Ano ang itinulad ni Hesus sa Espiritu, at ano ang hindi natin hawak?',
      [v('Juan 3:8', 43, 3, 8)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang bagong bagay na nakikita mo sa buhay mo dahil kay Hesus. Kung wala ka pang nakikita, isulat ang hiling mo sa Kanya.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag itumbas ang bagong kapanganakan sa bautismo o sa listahan ng tinigilan. Hanapin ang buhay na nakakapit kay Hesus.',
    },
  ]),

  lesson('lesson-15', 'O', 'Pagsunod — sagot ng pag-ibig kay Hesus', 17, [
    {
      kind: 'heading',
      text: 'O — Pagsunod. Dahil iniibig natin Siya, hindi upang bilhin Siya.',
    },
    {
      text: 'Sinabi ni Hesus: kung iniibig ninyo ako, tutuparin ninyo ang aking mga utos. Ang pagsunod ay sagot ng anak, hindi bayad ng dayuhan. Mas mabuti ang pakikinig kaysa sa handog na walang pusong sumusunod. Ang biyaya ang nagtuturo sa atin na tumalikod sa kasalanan at mamuhay nang matino. Ang utos na walang pag-ibig ay bigat. Ang pag-ibig na walang pagsunod ay salita lamang.',
      refs: [
        v('Juan 14:15', 43, 14, 15),
        v('1 Samuel 15:22', 9, 15, 22),
        v('Tito 2:11-12', 56, 2, 11, 12),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: kung iniibig ninyo ako, tutuparin ninyo ang aking mga utos.',
      refs: [v('Juan 14:15', 43, 14, 15)],
    },
    q(
      'Buksan ang Juan 14:15. Ano ang ugnayan ng pag-ibig kay Hesus at ng Kanyang mga utos?',
      [v('Juan 14:15', 43, 14, 15)],
    ),
    q(
      'Buksan ang 1 Samuel 15:22. Ano ang mas mabuti kaysa sa handog, ayon kay Samuel?',
      [v('1 Samuel 15:22', 9, 15, 22)],
    ),
    q(
      'Buksan ang Lucas 6:46. Anong tanong ni Hesus sa tumatawag sa Kanya na Panginoon pero hindi sumusunod?',
      [v('Lucas 6:46', 42, 6, 46)],
    ),
    q(
      'Buksan ang Tito 2:11-12. Ano ang itinuturo ng biyaya ng Dios sa atin na tanggihan, at paano tayo mamuhay?',
      [v('Tito 2:11-12', 56, 2, 11, 12)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang utos ni Hesus na alam mong hindi mo pa sinusunod, at ang unang hakbang ng pagsunod ngayong linggo.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag gamitin ang pagsunod para takutin na mawawala ang kaligtasan sa bawat kamalian. Huwag din palambutin ang utos. Ang anak ay sinusuyo at itinutuwid.',
    },
  ]),

  lesson('lesson-16', 'P', 'Panalangin — kausapin ang Ama sa pangalan ni Hesus', 18, [
    {
      kind: 'heading',
      text: 'P — Panalangin. Ang Ama ang kausap. Si Hesus ang daan. Ang Espiritu ang tumutulong.',
    },
    {
      text: 'Tinuruan ni Hesus ang mga alagad na manalangin: Ama, banal ang pangalan Mo, dumating ang kaharian Mo, sundin ang kalooban Mo, bigyan kami ngayon, patawarin Mo kami, iligtas Mo kami sa tukso. Manalangin tayo sa Ama, sa pangalan ni Hesus, hindi bilang mahikang salita kundi bilang paglapit sa Kanyang kakayahan at kalooban. Tumutulong ang Espiritu kapag hindi natin alam ang sasabihin. Ang anyo ng katawan ay malaya. Ang puso ang hinahanap.',
      refs: [
        v('Mateo 6:9-13', 40, 6, 9, 13),
        v('Juan 14:13-14', 43, 14, 13, 14),
        v('Roma 8:26', 45, 8, 26),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: huwag kayong mabalisa, kundi ipaalam sa Dios ang lahat sa panalangin at pasasalamat.',
      refs: [v('Filipos 4:6-7', 50, 4, 6, 7)],
    },
    q(
      'Buksan ang Mateo 6:9. Kanino unang tinuturo ni Hesus na kausapin, at paano Siya tawagan?',
      [v('Mateo 6:9', 40, 6, 9)],
    ),
    q(
      'Buksan ang Juan 14:13-14. Sa kaninong pangalan tayo humihiling, at sino ang luluwalhatiin?',
      [v('Juan 14:13-14', 43, 14, 13, 14)],
    ),
    q(
      'Buksan ang 1 Juan 5:14. Ano ang katiyakan natin kung humihiling tayo nang ayon sa Kanyang kalooban?',
      [v('1 Juan 5:14', 62, 5, 14)],
    ),
    q(
      'Buksan ang Roma 8:26. Ano ang ginagawa ng Espiritu kapag hindi natin alam ang ipanalangin?',
      [v('Roma 8:26', 45, 8, 26)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang panalangin ngayong linggo na nagsisimula sa “Ama,” humihingi nang ayon sa kalooban Niya, at nagtatapos sa pasasalamat kay Hesus.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag ituro na may isang puwesto lang ng katawan ang tinatanggap. Huwag ituro na ang mahabang salita ang nagpaparinig. Ituro ang Ama, si Hesus, at ang Espiritu.',
    },
  ]),

  lesson('lesson-17', 'Q', 'Mga tanong na inilalapit kay Hesus', 19, [
    {
      kind: 'heading',
      text: 'Q — Mga tanong. Ang tapat na tanong ay dinadala sa Salita, hindi tinatakpan.',
    },
    {
      text: 'Ang paglago ay puno ng tanong. Ang mabuting guro ay hindi natatakot. Ang sagot ay sapat kung saan nagsalita ang Biblia, at mahinhin kung saan hindi Niya binuksan ang lahat. Si Hesus ang sentro ng sagot, hindi ang panalo sa argumento.',
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: laging handang magpaliwanag ng pag-asa, nang may kahinahunan at paggalang.',
      refs: [v('1 Pedro 3:15', 60, 3, 15)],
    },
    q(
      'Tanong: Makakasiguro ba ako? Buksan ang 1 Juan 5:13. Ano ang dahilan kung bakit isinulat ni Juan ang mga bagay na ito?',
      [v('1 Juan 5:13', 62, 5, 13)],
    ),
    q(
      'Tanong: Paano kung magkasala ako pagkatapos manampalataya? Buksan ang 1 Juan 1:9 at 2:1. Ano ang gagawin ng Dios kung ikinukumpisal natin ang kasalanan, at sino ang tagapamagitan?',
      [v('1 Juan 1:9', 62, 1, 9), v('1 Juan 2:1', 62, 2, 1)],
    ),
    q(
      'Tanong: Bakit may pagdurusa ang sumasampalataya? Buksan ang Juan 16:33. Ano ang nasa sanlibutan, at ano ang sinabi ni Hesus na gawin Niya sa sanlibutan?',
      [v('Juan 16:33', 43, 16, 33)],
    ),
    q(
      'Tanong: Maliligtas ba ang mabuting tao nang wala si Hesus? Buksan ang Juan 14:6 at Gawa 4:12. Ano ang tanging daan at tanging pangalan? Isulat nang may paggalang, hindi nang may yabang.',
      [v('Juan 14:6', 43, 14, 6), v('Gawa 4:12', 44, 4, 12)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang tanong mo na hindi pa nasasagot. Kanino mo ito dadalhin ngayong linggo: sa Salita, sa panalangin, at sa isang mature na kapatid?',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: sa taong hindi pa nakarinig ng ebanghelyo, sabihin ang alam natin — ang Dios ay matuwid at maawain, at tayo ay sinugo. Huwag gumawa ng ikalawang daan, at huwag magpanggap na alam natin ang bawat lihim ng Kanyang hatol.',
    },
  ]),

  lesson('lesson-18', 'R', 'Pagbabalik ni Hesus', 20, [
    {
      kind: 'heading',
      text: 'R — Pagbabalik. Darating Siya. Walang nagtatakda ng araw. Maghanda.',
    },
    {
      text: 'Si Hesus ay paparito nang personal, gaya ng pag-akyat Niya. Naghanda Siya ng lugar. Ang pag-asang ito ay nagtuturo sa atin na mamuhay nang matino at masigasig sa mabuting gawa. Walang nakaaalam ng araw at oras maliban sa Ama. Kaya huwag maniwala sa taong nagtatakda ng petsa. Maaaring magkaiba ang mga tapat na Kristiyano sa ilang detalye ng pagkakasunod. Huwag hatiin ang Sunday school dahil sa tsart. Ang sentro ay ito: si Hesus ay darating, at dapat Siyang salubungin nang handa.',
      refs: [
        v('Gawa 1:11', 44, 1, 11),
        v('Juan 14:1-3', 43, 14, 1, 3),
        v('Tito 2:13', 56, 2, 13),
        v('Mateo 24:36', 40, 24, 36),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: hinihintay natin ang pagpapakita ng ating dakilang Dios at Tagapagligtas na si Hesukristo.',
      refs: [v('Tito 2:13', 56, 2, 13)],
    },
    q(
      'Buksan ang Gawa 1:11. Paano darating si Hesus, ayon sa mga anghel?',
      [v('Gawa 1:11', 44, 1, 11)],
    ),
    q(
      'Buksan ang Juan 14:3. Ano ang pangako ni Hesus pagkatapos Niyang maghanda ng lugar?',
      [v('Juan 14:3', 43, 14, 3)],
    ),
    q(
      'Buksan ang Mateo 24:36. Sino ang nakaaalam ng araw at oras?',
      [v('Mateo 24:36', 40, 24, 36)],
    ),
    q(
      'Buksan ang 1 Juan 3:2-3. Ano ang mangyayari kapag Siya ay nahayag, at ano ang ginagawa ng may pag-asang ito?',
      [v('1 Juan 3:2-3', 62, 3, 2, 3)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Kung darating si Hesus bukas, anong isang bagay ang gusto mong ayusin ngayon sa harap Niya? Isulat ito.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: ituro ang pag-asa at ang kabanalan. Huwag magbenta ng takot sa petsa. Huwag maliitin ang kapatid na iba ang pagkakaunawa sa pagkakasunod ng mga huling bagay, basta iisa si Kristo.',
    },
  ]),

  lesson('lesson-19', 'S', 'Banal na paghiwalay — para kay Hesus, nasa mundo pa rin', 21, [
    {
      kind: 'heading',
      text: 'S — Nakalaan. Hiwalay para sa Dios, hindi nakatago sa tao.',
    },
    {
      text: 'Ang banal ay ang nakalaan para sa Dios. Si Hesus ay banal, at nanatili Siyang kasama ng mga makasalanan nang hindi sumasali sa kasalanan. Ang mananampalataya ay nasa mundo ngunit hindi kabilang sa kadiliman nito. Ang panganib ay ang pakikipagtali na humihila palayo kay Kristo, hindi ang simpleng pagkakaibigan sa kapitbahay. Ang kabanalan ay pagiging kamukha ni Hesus: malinis, totoo, maawain.',
      refs: [
        v('1 Pedro 1:15-16', 60, 1, 15, 16),
        v('Juan 17:15-18', 43, 17, 15, 18),
        v('Roma 12:1-2', 45, 12, 1, 2),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: huwag kayong umayon sa sanlibutang ito, kundi magbago sa pamamagitan ng pagpapanibago ng isip.',
      refs: [v('Roma 12:2', 45, 12, 2)],
    },
    q(
      'Buksan ang Juan 17:15. Ano ang hindi hiningi ni Hesus, at ano ang hiningi Niya mula sa masama?',
      [v('Juan 17:15', 43, 17, 15)],
    ),
    q(
      'Buksan ang Juan 17:18. Saan sinugo ni Hesus ang mga alagad?',
      [v('Juan 17:18', 43, 17, 18)],
    ),
    q(
      'Buksan ang 2 Corinto 6:14. Ano ang hindi dapat pagsamahin, at bakit ito tungkol sa direksyon ng puso?',
      [v('2 Corinto 6:14', 47, 6, 14)],
    ),
    q(
      'Buksan ang Mikas 6:8. Aling tatlong gawa ang banal na sagot, bukod sa listahan ng damit?',
      [v('Mikas 6:8', 33, 6, 8)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang bagay na ilalayo mo sa puso mo dahil humihila ito palayo kay Hesus, at ang isang taong lalapitan mo pa rin nang may pag-ibig.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag gawing kabanalan ang paghamak. Huwag gawing kalayaan ang pagsali sa kasalanan. Ang halimbawa ay si Hesus sa mesa ng mga makasalanan, na hindi naging makasalanan.',
    },
  ]),

  lesson('lesson-20', 'T', 'Tapat na katiwala — lahat ay kay Hesus', 22, [
    {
      kind: 'heading',
      text: 'T — Tapat. Ang pera, oras, at lakas ay paupa lang. Si Hesus ang kayamanan.',
    },
    {
      text: 'Sa Panginoon ang lupa at ang lahat ng narito. Tayo ay katiwala, hindi hari. Sa ilalim ng tipan sa Israel, ang ikapu ay bahagi ng pagsamba at pag-aaruga. Tinuruan tayo ni Hesus na ang puso ay naroroon kung nasaan ang kayamanan. Sa iglesya, ang pagbibigay ay regular, kusang-loob, masaya, ayon sa kaya at ayon sa pasya ng puso. Hindi ito buwis na bumibili ng pagpapala, at hindi sumpa na dapat katakutan ng anak. Si Kristo ang kayamanan. Ang pagiging bukas-palad ay sumusunod.',
      refs: [
        v('Awit 24:1', 19, 24, 1),
        v('Mateo 6:21', 40, 6, 21),
        v('2 Corinto 9:7', 47, 9, 7),
        v('1 Corinto 16:2', 46, 16, 2),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: ang masayang nagbibigay ay iniibig ng Dios. Bigyan ang bawat isa ayon sa pasya ng puso.',
      refs: [v('2 Corinto 9:7', 47, 9, 7)],
    },
    q(
      'Buksan ang Awit 24:1. Kanino ang lupa at ang lahat ng naninirahan dito?',
      [v('Awit 24:1', 19, 24, 1)],
    ),
    q(
      'Buksan ang Mateo 6:21. Saan naroroon ang puso, ayon kay Hesus?',
      [v('Mateo 6:21', 40, 6, 21)],
    ),
    q(
      'Buksan ang 2 Corinto 9:7. Paano dapat magbigay, at ano ang ayaw ng Dios sa pagbibigay?',
      [v('2 Corinto 9:7', 47, 9, 7)],
    ),
    q(
      'Buksan ang 1 Corinto 16:2. Kailan at paano inutusan ni Pablo ang iglesya na magtabi ng tulong?',
      [v('1 Corinto 16:2', 46, 16, 2)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang konkretong pagbibigay ngayong linggo — pera, oras, o tulong — na gagawin mo nang masaya dahil kay Hesus, hindi dahil sa takot.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag gamitin ang Malakias 3 bilang panakot sa bata o sa mahirap. Ipaliwanag ang ikapu bilang bahagi ng tipan sa Israel, at ituro ang masaganang biyaya at ang masayang pagbibigay ng Bagong Tipan. Huwag mangakong yayaman ang nagbibigay.',
    },
  ]),

  lesson('lesson-21', 'U', 'Pagkakaisa kay Kristo', 23, [
    {
      kind: 'heading',
      text: 'U — Pagkakaisa. Iisa ang Panginoon. Hindi iisa ang lahat ng opinyon.',
    },
    {
      text: 'Nanalangin si Hesus na ang mga mananampalataya ay maging isa, gaya ng Ama at ng Anak, upang maniwala ang mundo. Ang pagkakaisa ng Espiritu ay itinatag na: iisang katawan, iisang Espiritu, iisang pag-asa, iisang Panginoon, iisang pananampalataya, iisang bautismo sa Kanya, iisang Dios at Ama. Hindi ito pagkakapareho ng bawat kaugalian. Hindi rin ito pagkakaisa na tinatanggi kung sino si Hesus. Ang kayabangan ng grupo at ang pagbubura ng ebanghelyo ay parehong sira.',
      refs: [
        v('Juan 17:20-23', 43, 17, 20, 23),
        v('Efeso 4:1-6', 49, 4, 1, 6),
        v('1 Corinto 1:10-13', 46, 1, 10, 13),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: pagsikapan ninyong mapanatili ang pagkakaisa ng Espiritu sa bigkis ng kapayapaan.',
      refs: [v('Efeso 4:3', 49, 4, 3)],
    },
    q(
      'Buksan ang Juan 17:21. Ano ang hiniling ni Hesus, at ano ang dapat makita ng mundo?',
      [v('Juan 17:21', 43, 17, 21)],
    ),
    q(
      'Buksan ang Efeso 4:4-6. Ilista ang mga “isa” na binanggit ni Pablo.',
      [v('Efeso 4:4-6', 49, 4, 4, 6)],
    ),
    q(
      'Buksan ang 1 Corinto 1:12-13. Ano ang problema ng mga nagsasabing “ako ay kay Pablo” o “ako ay kay Apolos,” at kanino nahati si Kristo?',
      [v('1 Corinto 1:12-13', 46, 1, 12, 13)],
    ),
    q(
      'Buksan ang Roma 14:1 at 14:10. Paano dapat tratuhin ang mahina sa pananampalataya sa mga bagay na hindi si Kristo mismo, at sino ang humahatol?',
      [v('Roma 14:1', 45, 14, 1), v('Roma 14:10', 45, 14, 10)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang paraan ng paghingi ng tawad o pagtulong na gagawin mo upang mangalaga ng kapayapaan sa iglesya, nang hindi tinatalikuran si Hesus.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag ituro na ang pagkakaisa ay “lahat ng iglesya ay pareho na.” Huwag din ituro na ang ating pangalan lang ang pamilya ng Dios.',
    },
  ]),

  lesson('lesson-22', 'V', 'Tagumpay na galing kay Hesus', 24, [
    {
      kind: 'heading',
      text: 'V — Tagumpay. Na kay Kristo tayo higit sa nagtatagumpay.',
    },
    {
      text: 'Ang tagumpay ng Kristiyano ay hindi buhay na walang luha. Ito ay pakikibahagi sa tagumpay ni Hesus laban sa kasalanan, kamatayan, at diyablo. Ang sanlibutan ay humihikayat palayo. Ang laman ay humihila sa dati. Ang kaaway ay gumagamit ng daya. Ang sagot ay lumakad sa Espiritu, magsuot ng baluti ng Dios, at umasa sa Tagapamagitan. Kapag nadapa, hindi pa tapos ang digmaan. Si Hesus ang nagtatagumpay, at tayo ay Kanya.',
      refs: [
        v('Roma 8:37', 45, 8, 37),
        v('Juan 16:33', 43, 16, 33),
        v('Galacia 5:16', 48, 5, 16),
        v('1 Juan 2:1', 62, 2, 1),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: salamat sa Dios na nagbibigay sa atin ng tagumpay sa pamamagitan ng ating Panginoong Hesukristo.',
      refs: [v('1 Corinto 15:57', 46, 15, 57)],
    },
    q(
      'Buksan ang Juan 16:33. Ano ang sinabi ni Hesus na nasa sanlibutan, at ano ang Kanyang ginawa?',
      [v('Juan 16:33', 43, 16, 33)],
    ),
    q(
      'Buksan ang Roma 8:37. Sa pamamagitan kanino tayo higit pa sa nagtatagumpay?',
      [v('Roma 8:37', 45, 8, 37)],
    ),
    q(
      'Buksan ang Galacia 5:16. Ano ang mangyayari kung lumakad tayo sa Espiritu?',
      [v('Galacia 5:16', 48, 5, 16)],
    ),
    q(
      'Buksan ang Hebreo 2:14 at 1 Juan 2:1. Paano ginapi ni Hesus ang may kapangyarihan ng kamatayan, at ano ang ginagawa Niya kung magkasala ang anak?',
      [v('Hebreo 2:14', 58, 2, 14), v('1 Juan 2:1', 62, 2, 1)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang laban ngayong linggo at ang isang talata na hahawakan mo dahil si Hesus ang nagtatagumpay, hindi ang iyong lakas.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag ipangako na mawawala ang problema kung sapat ang pananampalataya. Ipagdiinan ang krus, ang Espiritu, at ang pagbangon pagkatapos madapa.',
    },
  ]),

  lesson('lesson-23', 'W', 'Saksi ni Hesus', 25, [
    {
      kind: 'heading',
      text: 'W — Saksi. Sabihin kung sino si Hesus at kung ano ang ginawa Niya.',
    },
    {
      text: 'Ang saksi ay nagsasabi ng totoo tungkol kay Hesus, nang may kahinahunan. Ang babae sa balon ay umuwi at sinabi sa bayan kung sino ang nakausap niya. Hindi kailangan ng perpektong talumpati. Kailangan ng malinaw na ebanghelyo: si Kristo ay namatay para sa kasalanan, nabuhay, at tinatawag ang tao sa pagsisisi at pananampalataya. Ang iyong kuwento ay tulay. Si Hesus ang daan.',
      refs: [
        v('1 Pedro 3:15', 60, 3, 15),
        v('Gawa 1:8', 44, 1, 8),
        v('1 Corinto 15:3-4', 46, 15, 3, 4),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: hindi ako nahihiya sa ebanghelyo, sapagkat ito ang kapangyarihan ng Dios sa kaligtasan.',
      refs: [v('Roma 1:16', 45, 1, 16)],
    },
    q(
      'Buksan ang Juan 4:28-29. Ano ang ginawa ng babae pagkatapos makipag-usap kay Hesus, at ano ang tanong niya sa mga tao?',
      [v('Juan 4:28-29', 43, 4, 28, 29)],
    ),
    q(
      'Buksan ang 1 Pedro 3:15. Paano dapat magpaliwanag ang mananampalataya ng kanyang pag-asa?',
      [v('1 Pedro 3:15', 60, 3, 15)],
    ),
    q(
      'Buksan ang Roma 10:9. Ano ang dapat ipahayag at ano ang dapat paniwalaan?',
      [v('Roma 10:9', 45, 10, 9)],
    ),
    q(
      'Buksan ang Colosas 4:5-6. Paano dapat lakaran ang oras sa mga tagalabas, at paano dapat timplahan ang salita?',
      [v('Colosas 4:5-6', 51, 4, 5, 6)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat sa tatlong pangungusap ang iyong saksi: sino si Hesus, ano ang ginawa Niya, at ano ang ibig sabihin nito sa iyo. Gamitin ito kung may magtanong.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag pilitin ang batang magsalita sa entablado kung hindi pa handa. Turuan siyang magsabi ng totoo nang may paggalang. Huwag itali ang saksi sa isang salin o sa isang iskrip ng grupo.',
    },
  ]),

  lesson('lesson-24', 'X', 'Mga bagay na humihila palayo kay Hesus', 26, [
    {
      kind: 'heading',
      text: 'X — Ang marka ng panganib. Hindi lahat ng puwede ay nakakatulong.',
    },
    {
      text: 'Malaya ang mananampalataya kay Kristo. Hindi lahat ng malaya ay bumubuti. May mga gawa ng laman na malinaw na laban sa kaharian: sekswal na karumihan, pagsamba sa diyus-diyosan, poot, pagkakawatak-watak, inggit, paglalasing, kalasingan sa bisyo, at mga katulad. Ang tanong ng puso ay hindi “masama ba ito sa tingin ng grupo?” kundi “ito ba ay nagpapalapit sa akin kay Hesus, at nagmamahal ba ito sa kapwa?” Sa mga bagay na hindi isinara ng Biblia, igalang ang budhi. Huwag hamakin ang mahina. Huwag husgahan ang malaya.',
      refs: [
        v('1 Corinto 6:12', 46, 6, 12),
        v('Galacia 5:19-23', 48, 5, 19, 23),
        v('Roma 14:3', 45, 14, 3),
        v('1 Corinto 10:31', 46, 10, 31),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: lahat ng bagay ay puwede, ngunit hindi lahat ay nakakatulong. Huwag pasakop sa anuman.',
      refs: [v('1 Corinto 6:12', 46, 6, 12)],
    },
    q(
      'Buksan ang 1 Corinto 6:12. Ano ang dalawang hangganan na sinabi ni Pablo sa kalayaan?',
      [v('1 Corinto 6:12', 46, 6, 12)],
    ),
    q(
      'Buksan ang Galacia 5:19-21. Pangalanan ang apat na gawa ng laman na malinaw na laban sa Espiritu.',
      [v('Galacia 5:19-21', 48, 5, 19, 21)],
    ),
    q(
      'Buksan ang Efeso 5:18. Ano ang hindi dapat pag-sobrahan, at ano ang dapat punuin sa halip?',
      [v('Efeso 5:18', 49, 5, 18)],
    ),
    q(
      'Buksan ang Roma 14:13. Ano ang dapat itigil, at ano ang dapat bantayan tungkol sa kapatid?',
      [v('Roma 14:13', 45, 14, 13)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang isang bagay na nagsisimula nang maging hari ng oras o puso mo. Anong isang hakbang ang gagawin mo upang si Hesus ang manatiling Panginoon doon?',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag maglista ng sayaw, pelikula, o baraha na parang iyon ang ebanghelyo. Ituro ang malinaw na kasalanan mula sa Kasulatan, at ang budhi sa mga bagay na pinagdedebatehan. Ang sentro ay kung sino ang pinapanginoon.',
    },
  ]),

  lesson('lesson-25', 'Y', 'Ang iglesyang pinaglilingkuran mo', 27, [
    {
      kind: 'heading',
      text: 'Y — Ang iyong tahanan ng pagsamba. Tipan ng mga tao sa ilalim ni Hesus.',
    },
    {
      text: 'Huwag nating pabayaan ang pagtitipon. Doon naririnig ang Salita, nananalangin, nagbabahagi, at nag-uudyakan sa pag-ibig. Ang mga pastol ay nag-aalaga nang hindi pinanginginoon ang kawan. Si Hesus ang punong Pastol. Kilalanin mo kung ano ang pinaniniwalaan ng iglesya mo tungkol kay Kristo, sa ebanghelyo, sa bautismo, at sa hapunan. Kung tinatanggi ng isang pulutong ang ebanghelyo, malaya kang lumipat sa iglesyang kumakapit kay Kristo. Ang tahanan mo ay hindi ang tanging iglesya sa mundo.',
      refs: [
        v('Hebreo 10:24-25', 58, 10, 24, 25),
        v('Gawa 2:42', 44, 2, 42),
        v('1 Pedro 5:2-4', 60, 5, 2, 4),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: isaalang-alang natin kung paano mag-udyakan sa pag-ibig at mabubuting gawa, at huwag pabayaan ang pagtitipon.',
      refs: [v('Hebreo 10:24-25', 58, 10, 24, 25)],
    },
    q(
      'Buksan ang Hebreo 10:24-25. Ano ang dapat isaalang-alang, at ano ang hindi dapat pabayaan?',
      [v('Hebreo 10:24-25', 58, 10, 24, 25)],
    ),
    q(
      'Buksan ang 1 Pedro 5:2-3. Paano dapat alagaan ng mga matatanda ang kawan, at ano ang bawal nilang gawin?',
      [v('1 Pedro 5:2-3', 60, 5, 2, 3)],
    ),
    q(
      'Buksan ang Colosas 1:18. Sino ang dapat mong sagutin kung tatanungin, “Sino ang ulo ng iglesyang ito?”',
      [v('Colosas 1:18', 51, 1, 18)],
    ),
    q(
      'Buksan ang Gawa 17:11. Ano ang ginawa ng mga taga-Berea sa pangaral, at bakit ito mabuting asal sa iyong iglesya?',
      [v('Gawa 17:11', 44, 17, 11)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat ang pangalan ng iglesyang pinagtitipunan mo at ang isang paraan ng pananatili mo roon ngayong linggo: dumalo, manalangin, tumulong, o magbigay.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag pagpilian ang “tanging tunay na tatak.” Ituro ang katapatan sa lokal na iglesya at ang karapatan ng budhi kung nalalayo na sa ebanghelyo.',
    },
  ]),

  lesson('lesson-26', 'Z', 'Sion — tahanan na walang hanggan kasama ni Hesus', 28, [
    {
      kind: 'heading',
      text: 'Z — Sion. Ang wakas ay si Dios na kasama ng Kanyang bayan.',
    },
    {
      text: 'Ang pag-asa ay hindi pagtakas lang sa mundong ito. Si Hesus ay naghanda ng lugar. Darating ang bagong langit at bagong lupa. Papahirin Niya ang luha. Wala nang kamatayan. Ang banal na lunsod ay tinatawag ding Sion, ang tahanan ng Dios kasama ng mga taong tinubos. Ang katawan ay bubuhayin. Ang daan papunta roon ay si Hesus, hindi ang sariling points. Ang pag-asang ito ang nagpapatuloy sa atin ngayon.',
      refs: [
        v('Juan 14:2-3', 43, 14, 2, 3),
        v('Apocalipsis 21:1-5', 66, 21, 1, 5),
        v('Hebreo 12:22', 58, 12, 22),
        v('Filipos 3:20-21', 50, 3, 20, 21),
      ],
    },
    {
      kind: 'memory',
      text: 'Kabisaduhin ang diwa: ang tahanan natin ay nasa langit, at hinihintay natin ang Tagapagligtas na babaguhin ang ating katawan.',
      refs: [v('Filipos 3:20-21', 50, 3, 20, 21)],
    },
    q(
      'Buksan ang Juan 14:2-3. Ano ang ginagawa ni Hesus, at ano ang pangako Niya pagkatapos?',
      [v('Juan 14:2-3', 43, 14, 2, 3)],
    ),
    q(
      'Buksan ang Apocalipsis 21:3-4. Ano ang sasabihin ng malakas na tinig, at ano ang papahirin at mawawala?',
      [v('Apocalipsis 21:3-4', 66, 21, 3, 4)],
    ),
    q(
      'Buksan ang Hebreo 12:22. Ano ang nilapitan ng bayan ng Dios, at kaninong lunsod ito?',
      [v('Hebreo 12:22', 58, 12, 22)],
    ),
    q(
      'Buksan ang Filipos 3:20-21. Saan ang pagkamamayan natin, at ano ang gagawin ng Tagapagligtas sa ating katawan?',
      [v('Filipos 3:20-21', 50, 3, 20, 21)],
    ),
    {
      kind: 'homework',
      answerable: true,
      text: 'Isulat kung paano babaguhin ng pag-asang kasama si Hesus ang isang desisyon mo ngayong linggo — sa trabaho, sa tahanan, o sa iglesya.',
    },
    {
      kind: 'notes',
      text: 'Para sa guro: huwag gawing tatlong palapag ng especulasyon ang langit. Ituro ang presensya ng Dios, ang pagkabuhay na mag-uli, at si Hesus bilang daan. Iyan ang Sion ng bagong likha.',
    },
  ]),
];
