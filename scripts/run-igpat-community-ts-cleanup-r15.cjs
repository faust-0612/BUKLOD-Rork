const fs = require('node:fs');
const path = require('node:path');

const targetSuffixes = [
  path.normalize('src/app/(tabs)/buklod.tsx'),
  path.normalize('src/components/BuklodExclusiveScopeCommunity.tsx'),
];

const originalReadFileSync = fs.readFileSync.bind(fs);

fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
  const result = originalReadFileSync(filePath, ...args);
  const normalizedPath = path.normalize(String(filePath));

  if (
    typeof result === 'string' &&
    targetSuffixes.some((suffix) => normalizedPath.endsWith(suffix))
  ) {
    return result.replace(/\r\n/g, '\n');
  }

  return result;
};

require('./fix-igpat-community-ts-r15.cjs');
