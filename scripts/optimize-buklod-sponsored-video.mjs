#!/usr/bin/env node
/**
 * Offline, no-paid-API sponsored video encoder. Original remains untouched.
 * Usage: node scripts/optimize-buklod-sponsored-video.mjs --input SOURCE.mp4 --out-dir OUTPUT
 * This script does not upload files, alter a campaign, or use any cloud credentials.
 * Approved operators upload the generated files to paid-ad-media and record their
 * verified public URLs in video_url_mobile (720p) and video_url_low (480p).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const LIMIT_SECONDS = 30.05;
const PROFILES = Object.freeze([
  { name: 'mobile', width: 1280, height: 720, maxRate: '1600k', bufSize: '3200k', crf: '27' },
  { name: 'low', width: 854, height: 480, maxRate: '700k', bufSize: '1400k', crf: '29' },
]);

function execJson(command, args) {
  return JSON.parse(execFileSync(command, args, {
    encoding: 'utf8', timeout: 15_000, maxBuffer: 2_000_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
}

function probe(path) {
  const data = execJson('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,width,height',
    '-of', 'json', path,
  ]);
  const video = (data.streams || []).find(stream => stream.codec_type === 'video');
  return {
    duration: Number(data.format?.duration ?? 0),
    size: Number(data.format?.size ?? 0),
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
  };
}

function validate(info) {
  if (!(info.duration > 0 && info.duration <= LIMIT_SECONDS)) {
    throw new Error('Sponsored source must be a video of 30 seconds or less.');
  }
  if (!(info.width > 0 && info.height > 0 && info.size > 0)) {
    throw new Error('Cannot verify video dimensions and size.');
  }
}

export function optimizeSponsoredVideo(input, outputDir, name = 'sponsored') {
  if (!existsSync(input)) throw new Error('Input file does not exist.');
  if (!/^[a-z0-9_-]{1,60}$/i.test(name)) throw new Error('Invalid output name.');
  const source = probe(input);
  validate(source);
  mkdirSync(outputDir, { recursive: true });
  const results = {};

  for (const profile of PROFILES) {
    const dest = join(outputDir, `${name}.${profile.name}.mp4`);
    const scale = `scale=w='min(${profile.width},iw)':h='min(${profile.height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;
    try {
      execFileSync('ffmpeg', [
        '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
        '-i', input, '-map', '0:v:0', '-map', '0:a:0?',
        '-vf', scale, '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', profile.crf, '-maxrate', profile.maxRate,
        '-bufsize', profile.bufSize, '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '64k', '-ac', '2',
        '-movflags', '+faststart', '-threads', '2', dest,
      ], { timeout: 240_000, stdio: ['ignore','ignore','pipe'] });
      const result = probe(dest);
      validate(result);
      // Keep the source if a variant would cost equal/more bytes.
      if (result.size >= source.size) {
        unlinkSync(dest);
        results[profile.name] = { usable: false, reason: 'NOT_SMALLER_THAN_ORIGINAL' };
      } else {
        const file = readFileSync(dest);
        const header = file.subarray(0,Math.min(file.length,1024*1024)).toString('latin1');
        if (header.indexOf('moov') === -1 || header.indexOf('mdat') < header.indexOf('moov')) {
          throw new Error('Fast-start MP4 header verification failed.');
        }
        results[profile.name] = {
          usable: true,
          outputFile: dest,
          width: result.width,
          height: result.height,
          bytes: statSync(dest).size,
          sha256: createHash('sha256').update(file).digest('hex'),
          savingsPercent: Number(((1 - result.size / source.size) * 100).toFixed(1)),
        };
      }
    } catch (error) {
      if (existsSync(dest)) unlinkSync(dest);
      throw new Error(`Encoding or validation failed for ${profile.name}: ${String(error?.message ?? error).slice(0,240)}`);
    }
  }
  const manifest = {
    originalBytes: source.size,
    originalDurationSeconds: source.duration,
    originalWidth: source.width,
    originalHeight: source.height,
    variants: results,
    note: 'Local-only verified encodes. Do not promote URLs until separately uploaded and HTTP-validated.',
  };
  writeFileSync(join(outputDir, `${name}.manifest.json`), JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

if (process.argv[1] && basename(process.argv[1]) === basename(new URL(import.meta.url).pathname)) {
  const flags = process.argv.slice(2);
  const arg = key => { const i = flags.indexOf(key); return i < 0 ? '' : flags[i+1] || ''; };
  const input = arg('--input'), outDir = arg('--out-dir'), name = arg('--name') || 'sponsored';
  if (!input || !outDir) {
    process.stderr.write('Usage: --input local.mp4 --out-dir local-folder [--name safe_slug]\n');
    process.exitCode = 2;
  } else {
    try {
      const report = optimizeSponsoredVideo(resolve(input),resolve(outDir),name);
      process.stdout.write(JSON.stringify(report,null,2)+'\n');
    } catch (error) {
      process.stderr.write(`${String(error?.message ?? error).slice(0,300)}\n`);
      process.exitCode = 1;
    }
  }
}
