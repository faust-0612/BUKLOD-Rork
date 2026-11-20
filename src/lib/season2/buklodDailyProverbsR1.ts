import { PROVERBS_KJV_BY_CHAPTER } from './buklodProverbsKjvFullR1';

/** Season2 Show Faith: KJV public-domain fallback; 31 curated reflections retained; full 915-verse book rotates without repeats.
 * No points, awards, feed ordering or AdMob side effects. */
export type DailyProverb = Readonly<{chapter:number;verse:number;kjv:string;lessonEn:string;lessonFil:string}>;
export const DAILY_PROVERBS: readonly DailyProverb[] = Object.freeze([
  {chapter:1,verse:7,kjv:"The fear of the LORD is the beginning of knowledge: but fools despise wisdom and instruction.",lessonEn:"Wisdom starts with reverence and willingness to learn.",lessonFil:"Nagsisimula ang karunungan sa paggalang sa Diyos at pagiging handang matuto."},
  {chapter:2,verse:6,kjv:"For the LORD giveth wisdom: out of his mouth cometh knowledge and understanding.",lessonEn:"Seek understanding, not merely information.",lessonFil:"Hanapin ang pang-unawa, hindi lang impormasyon."},
  {chapter:3,verse:5,kjv:"Trust in the LORD with all thine heart; and lean not unto thine own understanding.",lessonEn:"Trust God even when your view is incomplete.",lessonFil:"Magtiwala sa Diyos kahit hindi mo pa nauunawaan ang lahat."},
  {chapter:3,verse:6,kjv:"In all thy ways acknowledge him, and he shall direct thy paths.",lessonEn:"Remember God in everyday decisions.",lessonFil:"Isama ang Diyos sa mga pagpapasya araw-araw."},
  {chapter:4,verse:23,kjv:"Keep thy heart with all diligence; for out of it are the issues of life.",lessonEn:"Protect the values that guide your actions.",lessonFil:"Ingatan ang mga pagpapahalagang gumagabay sa kilos."},
  {chapter:5,verse:21,kjv:"For the ways of man are before the eyes of the LORD, and he pondereth all his goings.",lessonEn:"Live with integrity, even in private.",lessonFil:"Maging matapat kahit walang ibang nakakakita."},
  {chapter:6,verse:6,kjv:"Go to the ant, thou sluggard; consider her ways, and be wise:",lessonEn:"Small, consistent efforts build good habits.",lessonFil:"Ang maliliit ngunit tuloy-tuloy na pagsisikap ay mahalaga."},
  {chapter:7,verse:2,kjv:"Keep my commandments, and live; and my law as the apple of thine eye.",lessonEn:"Treat sound guidance as precious.",lessonFil:"Pahalagahan at pangalagaan ang mabuting aral."},
  {chapter:8,verse:11,kjv:"For wisdom is better than rubies; and all the things that may be desired are not to be compared to it.",lessonEn:"Good judgment is worth more than possessions.",lessonFil:"Mas mahalaga ang wastong paghatol kaysa sa ari-arian."},
  {chapter:9,verse:10,kjv:"The fear of the LORD is the beginning of wisdom: and the knowledge of the holy is understanding.",lessonEn:"Humility and reverence help wisdom grow.",lessonFil:"Lumalim ang karunungan sa kababaang-loob at paggalang sa Diyos."},
  {chapter:10,verse:12,kjv:"Hatred stirreth up strifes: but love covereth all sins.",lessonEn:"Choose actions that heal rather than inflame conflict.",lessonFil:"Piliin ang pag-ibig na naghihilom sa halip na galit na nagpapalala ng alitan."},
  {chapter:11,verse:25,kjv:"The liberal soul shall be made fat: and he that watereth shall be watered also himself.",lessonEn:"Generosity blesses others and changes us too.",lessonFil:"Ang pagiging bukas-palad ay nakakabuti sa kapwa at sa sarili."},
  {chapter:12,verse:18,kjv:"There is that speaketh like the piercings of a sword: but the tongue of the wise is health.",lessonEn:"Use words that bring healing, not harm.",lessonFil:"Gumamit ng mga salitang nagpapagaling, hindi nananakit."},
  {chapter:13,verse:20,kjv:"He that walketh with wise men shall be wise: but a companion of fools shall be destroyed.",lessonEn:"Choose companions who help you grow.",lessonFil:"Pumili ng mga kasamang humihikayat sa mabuting paglago."},
  {chapter:14,verse:29,kjv:"He that is slow to wrath is of great understanding: but he that is hasty of spirit exalteth folly.",lessonEn:"Patience is strength when emotions rise.",lessonFil:"Ang pagtitimpi ay tanda ng pag-unawa at lakas."},
  {chapter:15,verse:1,kjv:"A soft answer turneth away wrath: but grievous words stir up anger.",lessonEn:"A gentle reply can calm a tense conversation.",lessonFil:"Kayang pahupain ng mahinahong sagot ang tensiyon."},
  {chapter:16,verse:3,kjv:"Commit thy works unto the LORD, and thy thoughts shall be established.",lessonEn:"Offer your plans to God and work with purpose.",lessonFil:"Ipagkatiwala ang iyong mga gawain sa Diyos at kumilos nang may layunin."},
  {chapter:16,verse:9,kjv:"A man's heart deviseth his way: but the LORD directeth his steps.",lessonEn:"Plan responsibly while remaining open to guidance.",lessonFil:"Magplano nang maayos ngunit manatiling bukas sa paggabay."},
  {chapter:16,verse:18,kjv:"Pride goeth before destruction, and an haughty spirit before a fall.",lessonEn:"Humility protects us from avoidable mistakes.",lessonFil:"Ang kababaang-loob ay tumutulong umiwas sa pagkakamali."},
  {chapter:17,verse:17,kjv:"A friend loveth at all times, and a brother is born for adversity.",lessonEn:"Real friendship stays present through difficulty.",lessonFil:"Ang tunay na pagkakaibigan ay nananatili kahit sa pagsubok."},
  {chapter:18,verse:10,kjv:"The name of the LORD is a strong tower: the righteous runneth into it, and is safe.",lessonEn:"Turn to God when you need courage and refuge.",lessonFil:"Lumapit sa Diyos para sa lakas at kanlungan."},
  {chapter:18,verse:21,kjv:"Death and life are in the power of the tongue: and they that love it shall eat the fruit thereof.",lessonEn:"Our words have real consequences.",lessonFil:"May tunay na bunga ang mga salitang binibigkas natin."},
  {chapter:19,verse:21,kjv:"There are many devices in a man's heart; nevertheless the counsel of the LORD, that shall stand.",lessonEn:"Hold your plans with humility.",lessonFil:"Huwag gawing higit sa lahat ang sariling mga plano."},
  {chapter:20,verse:22,kjv:"Say not thou, I will recompense evil; but wait on the LORD, and he shall save thee.",lessonEn:"Do not let revenge guide your choices.",lessonFil:"Huwag hayaang paghihiganti ang magdikta ng pagpapasya."},
  {chapter:21,verse:3,kjv:"To do justice and judgment is more acceptable to the LORD than sacrifice.",lessonEn:"What is right matters more than appearances.",lessonFil:"Mas mahalaga ang paggawa ng tama kaysa sa panlabas na anyo."},
  {chapter:22,verse:6,kjv:"Train up a child in the way he should go: and when he is old, he will not depart from it.",lessonEn:"Teach and model good values consistently.",lessonFil:"Ituro at isabuhay nang tuloy-tuloy ang mabubuting pagpapahalaga."},
  {chapter:23,verse:12,kjv:"Apply thine heart unto instruction, and thine ears to the words of knowledge.",lessonEn:"Be willing to listen and be corrected.",lessonFil:"Maging handang makinig, matuto, at tumanggap ng pagtutuwid."},
  {chapter:24,verse:16,kjv:"For a just man falleth seven times, and riseth up again: but the wicked shall fall into mischief.",lessonEn:"Do not give up after a setback.",lessonFil:"Bumangon at magpatuloy sa kabila ng pagkadapa."},
  {chapter:25,verse:11,kjv:"A word fitly spoken is like apples of gold in pictures of silver.",lessonEn:"Thoughtful words spoken at the right time matter.",lessonFil:"Mahalaga ang mga salitang may pag-iingat at tamang panahon."},
  {chapter:27,verse:17,kjv:"Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.",lessonEn:"Good companions help each other become better.",lessonFil:"Ang mabubuting kasama ay nagtutulungan upang umunlad."},
  {chapter:28,verse:13,kjv:"He that covereth his sins shall not prosper: but whoso confesseth and forsaketh them shall have mercy.",lessonEn:"Honesty and change open a path to restoration.",lessonFil:"Mahalaga ang pag-amin, pagsisisi, at pagbabago."},
]);
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** An immutable season-2 anchor makes all devices agree without local storage or a server write. */
export const PROVERBS_CYCLE_ANCHOR_MANILA = '2026-12-06';
export const TOTAL_PROVERBS_VERSES = PROVERBS_KJV_BY_CHAPTER.reduce((sum, chapter) => sum + chapter.length, 0);
/** 433 is coprime to 915, so each of the 915 verse slots appears exactly once per cycle. */
const PROVERBS_CYCLE_STRIDE = 433;
const PROVERBS_CYCLE_START_INDEX = 6; // Proverbs 1:7 on Season 2 opening day.
const reflectionByReference = new Map(DAILY_PROVERBS.map(v => [v.chapter + ':' + v.verse, v]));

export function manilaProverbsDate(now: Date = new Date()): string {
  return new Date(now.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

function dayIndexSinceAnchor(dateKey: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Invalid Manila date key');
  const utcMidnight = new Date(dateKey + 'T00:00:00.000Z');
  if (!Number.isFinite(utcMidnight.getTime()) || utcMidnight.toISOString().slice(0, 10) !== dateKey) {
    throw new Error('Invalid Manila calendar date');
  }
  return Math.round((utcMidnight.getTime() - Date.parse(PROVERBS_CYCLE_ANCHOR_MANILA + 'T00:00:00.000Z')) / DAY_MS);
}

export function dailyProverbForDate(dateKey: string): DailyProverb {
  const days = dayIndexSinceAnchor(dateKey);
  // Deliberately use calendar-day arithmetic, NOT day-of-month or a device-stored counter.
  // A repeat is permitted only on day 916, after every distinct Proverbs verse is shown.
  const unwrapped = PROVERBS_CYCLE_START_INDEX + days * PROVERBS_CYCLE_STRIDE;
  let verseIndex = ((unwrapped % TOTAL_PROVERBS_VERSES) + TOTAL_PROVERBS_VERSES) % TOTAL_PROVERBS_VERSES;
  for (let chapterIndex = 0; chapterIndex < PROVERBS_KJV_BY_CHAPTER.length; chapterIndex++) {
    const chapter = PROVERBS_KJV_BY_CHAPTER[chapterIndex];
    if (verseIndex < chapter.length) {
      const verseNo = verseIndex + 1;
      const chapterNo = chapterIndex + 1;
      const reflection = reflectionByReference.get(chapterNo + ':' + verseNo);
      return {
        chapter: chapterNo,
        verse: verseNo,
        kjv: chapter[verseIndex],
        lessonEn: reflection?.lessonEn ?? 'Reflect on this verse and how to practice its wisdom today.',
        lessonFil: reflection?.lessonFil ?? 'Pagbulayan ang talatang ito at kung paano maisasabuhay ang karunungan nito.',
      };
    }
    verseIndex -= chapter.length;
  }
  // The static corpus and day-index permutation are validated in source-only CI.
  throw new Error('Proverbs verse collection is incomplete');
}

export function millisecondsUntilNextManilaDate(now: Date = new Date()): number {
  const remainder = ((now.getTime() + MANILA_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS;
  return DAY_MS - remainder + 25;
}
