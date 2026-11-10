import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const paths = [
  'src/lib/buklodBiblePrefetchTargets.ts',
  'src/lib/buklodFaithOfflineWarmup.ts',
  'src/lib/offlineCache.ts',
  'src/app/bible/index.tsx',
  'src/app/bible/read.tsx',
  'src/app/(tabs)/hub.tsx',
  'src/app/word/index.tsx',
  'src/app/devotional/[id].tsx',
  'src/app/learn/lesson.tsx',
  'src/app/learn/[id].tsx',
];

test('offline faith update has valid TS/TSX syntax in all changed modules', () => {
  for (const path of paths) {
    const result = ts.transpileModule(read(path), {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const errors = (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, path + ': ' + ts.formatDiagnostics(errors, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: x => x,
      getNewLine: () => '\n',
    }));
  }
});

function loadTargets() {
  // The target planner has no runtime imports: exercise the actual TS source.
  const compiled = ts.transpileModule(read(paths[0]), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', compiled)(mod, mod.exports);
  return mod.exports.nextBibleChapterTargets;
}

test('prefetches two next chapters and crosses book boundaries correctly', () => {
  const next = loadTargets();
  const books = [
    { book_no: 1, chapter_count: 50 },
    { book_no: 2, chapter_count: 40 },
  ];
  assert.deepEqual(next(books, 1, 2), [
    { bookNo: 1, chapterNo: 3 }, { bookNo: 1, chapterNo: 4 },
  ]);
  assert.deepEqual(next(books, 1, 50), [
    { bookNo: 2, chapterNo: 1 }, { bookNo: 2, chapterNo: 2 },
  ]);
  assert.deepEqual(next(books, 2, 40), []);
});

test('target planner rejects invalid chapters and strictly bounds downloads', () => {
  const next = loadTargets();
  const books = [{ book_no: '1', chapter_count: '3' }];
  assert.deepEqual(next(books, 1, 0), []);
  assert.deepEqual(next(books, 1, 99), []);
  assert.deepEqual(next(books, 100, 1), []);
  assert.deepEqual(next(books, 1, 1, 100).map(x => x.chapterNo), [2, 3]);
});

test('only saved reading material is served offline and no background points are created', () => {
  const warm = read('src/lib/buklodFaithOfflineWarmup.ts');
  const bibleReader = read('src/app/bible/read.tsx');
  const lesson = read('src/app/learn/lesson.tsx');
  const word = read('src/app/word/index.tsx');
  const hub = read('src/app/(tabs)/hub.tsx');
  assert.match(hub, /label: 'Daily Reading'.*path: '\/bible'/);
  assert.match(bibleReader, /router\.replace\('\/bible' as any\)/);
  assert.match(warm, /isSameSignedInAccount\(userId\)/);
  assert.match(warm, /nextBibleChapterTargets\(books, bookNo, chapterNo, 2\)/);
  assert.match(warm, /warmPublishedWordsOffline/);
  assert.doesNotMatch(warm, /start_bible_reading_session|complete_my_daily_bible_reading|award.*points/i);
  assert.match(bibleReader, /warmNextBibleChaptersOffline\(/);
  assert.match(lesson, /offlineReadOnly && lesson/);
  assert.match(lesson, /isTransientLessonReadError\(error\) && await useSavedReading\(\)/);
  assert.match(lesson, /Date\.now\(\) - saved\.storedAt > 14 \* 24/);
  assert.match(lesson, /lessonOwner !== accountId/);
  assert.match(lesson, /removeOfflineCache\('lesson-reading-v1:'/);
  assert.match(word, /warmPublishedWordsOffline\(accountId/);
});

test('cache retention and snapshot recovery preserve previous authorized downloads', () => {
  const cache = read('src/lib/offlineCache.ts');
  const track = read('src/app/learn/[id].tsx');
  assert.match(cache, /daily-bible-\|word-\|lesson-/);
  assert.match(cache, /serializeIndexMutation/);
  assert.match(track, /if \(statusError\) return/);
  assert.match(track, /if \(progressError\) return/);
  assert.match(track, /track\.id !== id/);
  assert.match(track, /accessForCache = cached\?\.data\?\.access/);
});
