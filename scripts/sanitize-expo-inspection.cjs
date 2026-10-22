const fs = require('node:fs');
const path = require('node:path');
function sanitize(value) {
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? '[URL omitted]' : value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/url|email|token|secret|password|headers|owner|account|environment|credentials/i.test(key))
    .map(([key, child]) => [key, sanitize(child)]));
  return value;
}
if (require.main === module) {
  fs.mkdirSync('expo-inspection', {recursive:true});
  for (const name of ['channel.json', 'updates.json', 'builds.json']) {
    const data = JSON.parse(fs.readFileSync(path.join(process.argv[2], name), 'utf8'));
    fs.writeFileSync(path.join('expo-inspection', name), JSON.stringify(sanitize(data), null, 2));
  }
  console.log('Read-only Expo metadata saved; credentials and artifact URLs omitted.');
}
module.exports = { sanitize };
