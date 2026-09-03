const fs = require('node:fs');

const file = 'src/components/BuklodExclusiveScopeCommunity.tsx';
let source = fs.readFileSync(file, 'utf8');

function fail(message) {
  throw new Error(`[BUKLOD WEB COMMUNITY POST] ${message}`);
}

const publishStart = source.indexOf('  const publish =');
const publishEnd = source.indexOf('\n  const react =', publishStart);

if (publishStart < 0 || publishEnd < 0) {
  fail('Could not locate the scoped Community publish function.');
}

let publishChunk = source.slice(publishStart, publishEnd);
const busyOld = "      setBody('');\n      clearMedia();\n      setBusy(false);\n      setPublishNotice(";
const busyNew = "      setBody('');\n      clearMedia();\n      setBusy(true);\n      setPublishNotice(";

if (publishChunk.includes(busyOld)) {
  publishChunk = publishChunk.replace(busyOld, busyNew);
  source = source.slice(0, publishStart) + publishChunk + source.slice(publishEnd);
} else if (!publishChunk.includes(busyNew)) {
  fail('Publish busy-state anchor changed; refusing an unsafe web export.');
}

const publishPressMarker = "onPress={() =>\n              void publish()\n            }";
const markerIndex = source.indexOf(publishPressMarker);

if (markerIndex < 0) {
  fail('Could not locate the scoped Community Post button.');
}

const openStart = source.lastIndexOf('<Pressable', markerIndex);
const openEndMarker = '\n          >';
const openEndStart = source.indexOf(openEndMarker, markerIndex);

if (openStart < 0 || openEndStart < 0) {
  fail('Could not isolate the scoped Community Post button opening tag.');
}

const fixedOpening = `<Pressable
            disabled={busy}
            onPress={() =>
              void publish()
            }
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'reels'
                ? 'Publish Reel'
                : 'Post to this community'
            }
            style={[
              styles.publish,
              busy &&
                styles.publishDisabled,
            ]}
          >`;

source =
  source.slice(0, openStart) +
  fixedOpening +
  source.slice(openEndStart + openEndMarker.length);

if (!source.includes("clearMedia();\n      setBusy(true);\n      setPublishNotice(")) {
  fail('Busy-state fix verification failed.');
}
if (!source.includes('disabled={busy}')) {
  fail('Post-button enabled-state fix verification failed.');
}
if (!source.includes(': \'Post to this community\'')) {
  fail('Post-button accessibility verification failed.');
}

fs.writeFileSync(file, source, 'utf8');
console.log('BUKLOD web scoped Community Post hotfix applied and verified.');
