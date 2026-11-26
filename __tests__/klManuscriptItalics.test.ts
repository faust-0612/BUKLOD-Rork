import { splitKlItalics, importKlClipboard, toggleKlItalic } from '@/lib/kabihasnang-ligaw/italicFormatting';
import { KL_RELEASED_ITALIC_RULES } from '@/lib/kabihasnang-ligaw/releasedItalicRules';

const visible = (text: string, season?:number, chapter?:number) =>
  splitKlItalics(text, season, chapter).map(run => run.text).join('');

describe('KL manuscript italic formatting', () => {
  it('preserves ordinary text and only removes supported emphasis markers', () => {
    expect(visible('Si *Elyam* at _Tali_.')).toBe('Si Elyam at Tali.');
    expect(splitKlItalics('Si *Elyam* at _Tali_.').filter(run => run.italic).map(run => run.text))
      .toEqual(['Elyam','Tali']);
    expect(visible('**bold** *** ***literal*** *unfinished')).toBe('**bold** *** ***literal*** *unfinished');
    expect(visible('normal_text')).toBe('normal_text');
    expect(visible('> *Mensahe* — tala')).toBe('Mensahe — tala');
  });
  it('toggles a selected word without changing the prose', () => {
    expect(toggleKlItalic('Si Phan',3,7)).toBe('Si *Phan*');
    expect(toggleKlItalic('Si *Phan*',4,8)).toBe('Si Phan');
  });
  it.each([
    ['Si Elyam at Tali.','<p>Si <em>Elyam</em> at <i>Tali</i>.</p>','Si *Elyam* at *Tali*.'],
    ['Una\n\nIkalawa','<p><i>Una</i></p><p>Ikalawa</p>','*Una*\n\nIkalawa'],
    ['Ang & Yam','<span style="font-style: italic">Ang &amp; Yam</span>','*Ang & Yam*'],
    ['Hindi mababago','<p><i>Ibang teksto</i></p>','Hindi mababago'],
    ['Totoo','<p><i>Totoo</i></p><script>alert(1)</script>','*Totoo*'],
    ['Plain','Plain','Plain'],
    ['A B','<i>A <span style="font-style:normal">B</span></i>','*A* B'],
  ])('pastes text without losing visible content: %s', (plain,html,expected) => {
    expect(importKlClipboard(plain,html).text).toBe(expected);
  });
  for (const [chapter, rows] of Object.entries(KL_RELEASED_ITALIC_RULES)) {
    it('retains every reviewed paragraph in chapter '+chapter, () => {
      for(const row of rows) {
        const runs = splitKlItalics(row.paragraph,1,Number(chapter));
        expect(runs.some(run => run.italic)).toBe(true);
        expect(runs.map(run => run.text).join('')).toBe(row.paragraph.replace(/^>\s+/,''));
      }
    });
  }
  it('does not infer legacy styles for an unrelated season or changed paragraph', () => {
    const row = KL_RELEASED_ITALIC_RULES[9].find(r => !r.paragraph.startsWith('>'))!;
    expect(splitKlItalics(row.paragraph,2,9).some(run => run.italic)).toBe(false);
    expect(splitKlItalics(row.paragraph+' dagdag',1,9).some(run => run.italic)).toBe(false);
  });
});
