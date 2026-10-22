/**
 * Spoken form for TTS only. All-caps "BUKLOD" is spelled letter-by-letter
 * by many Android/iOS voices; title case is read as one word.
 */
export const BUKLOD_SPOKEN = 'Buklod';

const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿÑñ';

const FILIPINO_APOSTROPHE_HINT =
  /(?:n['']yo|['']yong|['']yon|['']yun|['']yan|['']di|['']wag|['']pag|ba['']t|sa['']yo|sa['']kin|pa['']no|ga['']no)/i;

type NormalizeOptions = {
  /** Expand Filipino contractions (n'yong, ako'y, …). */
  filipino?: boolean;
};

function unifyApostrophes(input: string) {
  return input.replace(/[’‘ʻʼ´]/g, "'");
}

/**
 * Known Tagalog/Filipino apostrophe forms. Longest matches first so
 * n'yong is not read letter-by-letter or split as "n yong".
 */
function expandFilipinoApostrophes(input: string) {
  const letterClass = `[${LETTER}]`;
  const notLetter = `[^${LETTER}]`;

  return input
    .replace(/\bn'yong\b/gi, 'ninyong')
    .replace(/\bn'yo\b/gi, 'ninyo')
    .replace(/\bsa'yo\b/gi, 'sa iyo')
    .replace(/\bsa'kin\b/gi, 'sa akin')
    .replace(/\bba't\b/gi, 'bakit')
    .replace(/\bpa'no\b/gi, 'paano')
    .replace(/\bga'no\b/gi, 'gaano')
    .replace(/\bngayo'y\b/gi, 'ngayon ay')
    .replace(new RegExp(`(^|${notLetter})'yong\\b`, 'gi'), '$1iyong')
    .replace(new RegExp(`(^|${notLetter})'yon\\b`, 'gi'), '$1iyon')
    .replace(new RegExp(`(^|${notLetter})'yun\\b`, 'gi'), '$1iyon')
    .replace(new RegExp(`(^|${notLetter})'yan\\b`, 'gi'), '$1iyan')
    .replace(new RegExp(`(^|${notLetter})'to\\b`, 'gi'), '$1ito')
    .replace(new RegExp(`(^|${notLetter})'di\\b`, 'gi'), '$1hindi')
    .replace(new RegExp(`(^|${notLetter})'wag\\b`, 'gi'), '$1huwag')
    .replace(new RegExp(`(^|${notLetter})'pag\\b`, 'gi'), '$1kapag')
    .replace(new RegExp(`(${letterClass}+)'ng\\b`, 'gi'), '$1ng')
    .replace(new RegExp(`(${letterClass}+)'y\\b`, 'gi'), '$1 ay')
    .replace(new RegExp(`(${letterClass}+)'t\\b`, 'gi'), '$1 at')
    .replace(new RegExp(`(${letterClass})'(${letterClass})`, 'g'), '$1$2');
}

/**
 * Prepare text for expo-speech. Displayed copy stays unchanged.
 * - BUKLOD is spoken as a word, never spelled
 * - Filipino apostrophe words are expanded into speakable forms
 */
export function normalizeBuklodSpeechText(
  input: string,
  options: NormalizeOptions = {},
) {
  let text = unifyApostrophes(String(input ?? ''));

  text = text.replace(/\bBUKLOD\b/gi, BUKLOD_SPOKEN);

  const filipino =
    options.filipino === true ||
    FILIPINO_APOSTROPHE_HINT.test(text);

  if (filipino) {
    text = expandFilipinoApostrophes(text);
  }

  return text.replace(/\s+/g, ' ').trim();
}
