import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_ANIMATIONS = [
  'Idle',
  'Walk',
  'Wave',
  'Celebrate',
  'LevelUp',
  'LookAround',
  'Pose',
];

const modelPath = path.resolve(
  process.cwd(),
  'public/characters/phan/phan.glb',
);

function fail(message) {
  console.error(`\n[Phan 3D] FAIL: ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(modelPath)) {
  fail(
    'Missing public/characters/phan/phan.glb. Add the real rigged Phan GLB before marking the 3D feature complete.',
  );
}

const buffer = fs.readFileSync(modelPath);
if (buffer.length < 20) {
  fail('GLB is too small to be a valid GLTF 2.0 binary.');
}

const magic = buffer.toString('ascii', 0, 4);
if (magic !== 'glTF') {
  fail(`Invalid GLB magic header: ${JSON.stringify(magic)}.`);
}

const version = buffer.readUInt32LE(4);
if (version !== 2) {
  fail(`Expected GLTF/GLB version 2, found version ${version}.`);
}

const declaredLength = buffer.readUInt32LE(8);
if (declaredLength !== buffer.length) {
  fail(
    `GLB length mismatch: header declares ${declaredLength} bytes, file has ${buffer.length}.`,
  );
}

const jsonChunkLength = buffer.readUInt32LE(12);
const jsonChunkType = buffer.readUInt32LE(16);
const JSON_CHUNK = 0x4e4f534a;
if (jsonChunkType !== JSON_CHUNK) {
  fail('First GLB chunk is not a JSON chunk.');
}

const jsonStart = 20;
const jsonEnd = jsonStart + jsonChunkLength;
if (jsonEnd > buffer.length) {
  fail('GLB JSON chunk extends beyond the file length.');
}

let gltf;
try {
  gltf = JSON.parse(
    buffer
      .subarray(jsonStart, jsonEnd)
      .toString('utf8')
      .replace(/\u0000+$/g, '')
      .trim(),
  );
} catch (error) {
  fail(`Unable to parse GLB JSON chunk: ${error instanceof Error ? error.message : error}`);
}

const animations = Array.isArray(gltf.animations)
  ? gltf.animations.map((item) => String(item?.name ?? '').trim()).filter(Boolean)
  : [];

const missingAnimations = REQUIRED_ANIMATIONS.filter(
  (name) => !animations.includes(name),
);

if (missingAnimations.length > 0) {
  fail(
    `Missing required animation clip(s): ${missingAnimations.join(', ')}. Found: ${animations.join(', ') || '(none)'}.`,
  );
}

const skins = Array.isArray(gltf.skins) ? gltf.skins : [];
if (skins.length < 1) {
  fail('No skin/skeleton found. Phan must be rigged for reusable animation.');
}

const meshes = Array.isArray(gltf.meshes) ? gltf.meshes : [];
if (meshes.length < 1) {
  fail('No mesh found in the GLB.');
}

console.log('[Phan 3D] PASS');
console.log(`Model: ${path.relative(process.cwd(), modelPath)}`);
console.log(`Bytes: ${buffer.length}`);
console.log(`Meshes: ${meshes.length}`);
console.log(`Skins: ${skins.length}`);
console.log(`Animations: ${animations.join(', ')}`);
console.log('Required animation contract satisfied.');
