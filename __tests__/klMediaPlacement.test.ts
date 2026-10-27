import { illustrationsAtParagraph } from '../src/lib/kabihasnang-ligaw/mediaPlacement';

const prose = [
  'The wind carried the first warning beyond the gate.',
  'No one spoke as the distant lights began to fade.',
  'At sunrise the traveler finally crossed the bridge.',
];

describe('KL manuscript illustration placement', () => {
  const media = [
    { kind: 'illustration', placement: 1, anchor: prose[0], side: 'before' },
    { kind: 'illustration', placement: 2, anchor: prose[1], side: 'after' },
    { kind: 'illustration', placement: 3, anchor: prose[2], side: 'after' },
    { kind: 'music', placement: 0, anchor: prose[1], side: 'after' },
  ];

  it('uses exact anchors and saved before/after order', () => {
    expect(illustrationsAtParagraph(media, prose[0], 'before').map((item) => item.placement)).toEqual([1]);
    expect(illustrationsAtParagraph(media, prose[0], 'after')).toEqual([]);
    expect(illustrationsAtParagraph(media, prose[1], 'after').map((item) => item.placement)).toEqual([2]);
    expect(illustrationsAtParagraph(media, prose[2], 'after').map((item) => item.placement)).toEqual([3]);
  });

  it('does not show media at guessed fractions or with missing anchors', () => {
    const invalid = [...media, { kind: 'illustration', placement: 4, anchor: null, side: 'after' }];
    expect(illustrationsAtParagraph(invalid, 'Completely unrelated text', 'after')).toEqual([]);
    expect(illustrationsAtParagraph(invalid, prose[1], 'before')).toEqual([]);
  });
});
