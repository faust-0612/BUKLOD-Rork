import { chromium } from '@playwright/test';

const url = 'https://buklod-quickcheck-web.vercel.app/?production-smoke=' + Date.now();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  if (!response || !response.ok()) throw new Error('Production page HTTP failed: ' + (response?.status() ?? 'no response'));

  const bodyText = (await page.locator('body').innerText()).trim();
  if (bodyText.length < 200) throw new Error('Production page appears blank or incomplete.');

  const required = [
    'QuickCheck',
    'Batch Records / History',
    'SELECT FILES',
    'SELECT FOLDER',
    'START CONTINUOUS SCAN',
    'Teacher Rubric',
  ];
  for (const token of required) {
    if (!bodyText.includes(token)) throw new Error('Production UI missing: ' + token);
  }

  if (pageErrors.length) throw new Error('Production page error: ' + pageErrors.join(' | '));
  console.log('QUICKCHECK_PRODUCTION_UI_PASS');
} finally {
  await browser.close();
}
