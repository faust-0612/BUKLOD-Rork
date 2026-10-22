/**
 * BUKLOD_BOOT_READY_WATCHDOG_R1
 *
 * Guard: index Public-scope boot must not trap bootReady=false forever.
 * This is a source-contract test (no RN render) so CI stays fast.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('BUKLOD bootReady Public reset (endless loading fix)', () => {
  it('native index optimistically releases bootReady after kicking Public selectScope', () => {
    const src = readSrc('src/app/index.tsx');

    expect(src).toContain('PERF_STARTUP_R1');
    expect(src).toContain('setBootReady(true)');
    expect(src).toContain('BUKLOD_BOOT_READY_WATCHDOG_R1');
    expect(src).toMatch(/setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*setBootReady\(true\)[\s\S]*\},\s*4000\)/);

    /*
     * Regression: do not re-introduce setBootReady(false) immediately
     * before/around the Public selectScope kickoff without an optimistic true.
     */
    const publicBlock = src.slice(
      src.indexOf('if (publicScope)'),
      src.indexOf('if (!scopeLoading)')
    );
    expect(publicBlock).toContain('setBootReady(true)');
    expect(publicBlock).not.toMatch(/setBootReady\(\s*false\s*\)/);
  });

  it('web City index mirrors optimistic Public boot + watchdog', () => {
    const src = readSrc('src/app/index.web.tsx');

    expect(src).toContain('PERF_STARTUP_R1');
    expect(src).toContain('BUKLOD_BOOT_READY_WATCHDOG_R1');
    expect(src).toContain('setBootReady(true)');

    const publicBlock = src.slice(
      src.indexOf('if (publicScope)'),
      src.indexOf('if (!scopeLoading)')
    );
    expect(publicBlock).toContain('setBootReady(true)');
    expect(publicBlock).not.toMatch(/setBootReady\(\s*false\s*\)/);
  });

  it('AuthProvider releases loading after session before awaiting profile network', () => {
    const src = readSrc('src/providers/AuthProvider.tsx');

    expect(src).toContain('PERF_STARTUP_R1');
    expect(src).toMatch(
      /finishBootstrap\(\);\s*await loadProfile\(\s*userId/
    );
    expect(src).toMatch(
      /finishBootstrap\(\);\s*await loadProfile\(\s*persisted\.user\.id/
    );
  });
});
