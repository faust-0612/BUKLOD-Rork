import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

function sha256(relativePath: string) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
}

describe('BUKLOD web brand icon', () => {
  it('uses the canonical mark for the browser icon and leaves the native icon', () => {
    const config = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');
    expect(config).toContain(
      "icon: isClassroom ? './assets/classroom/app-icon.png' : './assets/release/app-icon.png'",
    );
    expect(config).toContain("'./assets/release/buklod-main-canonical.png'");
    expect(config).not.toContain(
      ": './assets/release/app-icon.png',\n    },",
    );

    expect(sha256('assets/release/app-icon.png')).toBe(
      'd66d9fe5de00e485493431bdcb5c058832845cd26056f5429823ade757da2a1d',
    );
    expect(sha256('public/buklod-192.png')).toBe(
      '2753747fc26e1bb17cab48efc75d0c17607361fb53ca1375cf28fc5f8ae909df',
    );
    expect(sha256('public/buklod-512.png')).toBe(
      '153eb175f85b2a0389f66887a9f894df91a856f6882277669a75b08138a74da3',
    );
    expect(sha256('public/buklod-192.png')).not.toBe(
      '96eb445f0326acc2c81a12dfc4b2057c6a3c814f45bc428251e1251d453a2c48',
    );

    const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
    expect(html).toContain('/buklod-192.png?v=2753747fc26e');
    expect(html.includes('href="/favicon.ico"')).toBe(false);
  });
});
