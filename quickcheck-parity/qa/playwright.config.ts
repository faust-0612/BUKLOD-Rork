import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

function resolveE2ePort() {
  const configured = Number(process.env.QC_E2E_PORT || 0);
  if (Number.isInteger(configured) && configured > 0 && configured < 65536) return configured;

  const script = [
    "const net=require('net');",
    "const s=net.createServer();",
    "s.listen(0,'127.0.0.1',()=>{",
    "  const a=s.address();",
    "  console.log(typeof a==='object'&&a?a.port:'');",
    "  s.close();",
    "});",
  ].join('');

  const raw = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim();
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    throw new Error('Could not allocate a free local E2E port.');
  }
  return port;
}

const port = resolveE2ePort();
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
      },
    },
  }],
});
