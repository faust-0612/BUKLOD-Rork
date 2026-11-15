const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('src/lib/buklodHenryTranslation.ts', 'utf8');
const block = source.match(/export function polishHenryFilipinoTranslation[\s\S]*?const output = rules.reduce/);
assert.ok(block, 'Polishing rules must exist');
const rules = [...block[0].matchAll(/\[\/(.*?)\/gi, '([^']*)'\]/g)].map(([, pattern, replacement]) => [new RegExp(pattern, 'gi'), replacement]);
function polish(text) { return rules.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text); }
const cases = [
 ['mabait na pagdalaw na binayaran ng Diyos kay Solomon', 'mapagpalang pagdalaw ng Diyos kay Solomon'],
 ['pakikipag-isa na kasama niya sa Diyos dito', 'pakikipag-ugnayan niya sa Diyos sa pagkakataong iyon'],
 ['dapat lamang ang isa', 'dapat sana ay iyon lamang ang lugar'],
 ['inalok ni Solomon ang kanyang mga dakilang sakripisyo', 'naghandog si Solomon ng maraming hain'],
];
for (const [input, expected] of cases) assert.equal(polish(input), expected);
assert.equal(polish('Hindi naghandog si Solomon.'), 'Hindi naghandog si Solomon.');
assert.match(source, /henry-translation-v4:/);
console.log('Henry Filipino regression cases passed');
