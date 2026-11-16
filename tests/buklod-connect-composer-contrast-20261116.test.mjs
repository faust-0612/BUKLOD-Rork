import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const composer = read('src/components/connect/ConnectComposer.tsx');
const hibla = read('src/lib/connectHibla.ts');

function styleBlock(name) {
  const match = composer.match(new RegExp(`    ${name}: \\{([\\s\\S]*?)\\n    \\},`));
  assert.ok(match, `ConnectComposer style ${name} must exist`);
  return match[1];
}
function palette(name) {
  const match = hibla.match(new RegExp(`\\b${name}: '(#[a-fA-F0-9]{6})'`));
  assert.ok(match, `Missing fixed HIBLA color: ${name}`);
  return match[1];
}
function luminance(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const [low, high] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (high + 0.05) / (low + 0.05);
}

test('scope/direct message text never inherits light-on-dark colors inside fixed white pill', () => {
  assert.match(styleBlock('inputWrap'), /backgroundColor: '#FFFFFF'/);
  assert.match(styleBlock('input'), /color: HIBLA\\.ink/);
  assert.doesNotMatch(styleBlock('input'), /color: theme\\.textPrimary/);
  assert.match(composer, /placeholderTextColor=\\{HIBLA\\.muted\\}/);
  assert.match(composer, /selectionColor=\\{HIBLA\\.jade\\}/);
  assert.match(composer, /mode === 'direct' \\? 'Mag-type ng mensahe/);
  assert.match(composer, /: 'Mensahe sa grupo/);
  assert.ok(contrast(palette('ink'), '#FFFFFF') >= 7, 'typed text must pass AAA');
  assert.ok(contrast(palette('muted'), '#FFFFFF') >= 4.5, 'placeholder must pass AA');
});

test('light HIBLA reply and attachment surfaces remain readable under night themes', () => {
  assert.match(styleBlock('replyBanner'), /backgroundColor: HIBLA\\.mint/);
  assert.match(styleBlock('replyLabel'), /color: HIBLA\\.pine/);
  assert.match(styleBlock('replyName'), /color: HIBLA\\.ink/);
  assert.match(styleBlock('replyPreview'), /color: HIBLA\\.muted/);
  assert.match(styleBlock('iconCircle'), /backgroundColor: '#E6F3E9'/);
  assert.match(composer, /name="paperclip"[\\s\\S]*?color=\\{HIBLA\\.pine\\}/);
  assert.match(composer, /name="image-outline"[\\s\\S]*?color=\\{HIBLA\\.pine\\}/);
  for (const [fg, bg] of [
    ['ink', 'mint'],
    ['pine', 'mint'],
    ['muted', 'mint'],
  ]) {
    assert.ok(contrast(palette(fg), palette(bg)) >= 4.5,
      `${fg} on mint must pass AA`);
  }
  assert.ok(contrast(palette('pine'), '#E6F3E9') >= 4.5,
    'attachment icons must be readable on pale green');
});

test('contrast-only repair preserves send, native keyboard, media and user draft plumbing', () => {
  assert.match(composer, /value=\\{draft\\}/);
  assert.match(composer, /onChangeText=\\{onChangeDraft\\}/);
  assert.match(composer, /onPress=\\{hasMessagePayload \\? onSend/);
  assert.match(composer, /onAttachPress/);
  assert.match(composer, /onChoosePhoto/);
  assert.match(composer, /multiline/);
  assert.match(composer, /blurOnSubmit=\\{false\\}/);
  assert.match(composer, /Platform.OS !== 'web' \\|\\| !hasMessagePayload/);
});
