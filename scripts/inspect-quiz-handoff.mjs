// Read-only capability inspection; never consume a token or create an exam attempt.
const origin = 'https://buklod-quiz.expo.app';
const response = await fetch(origin, { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error('Quiz HTML HTTP ' + response.status);
const html = await response.text();
const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(match => new URL(match[1], origin));
let handler = false;
for (const url of scripts) {
  if (url.origin !== origin) continue;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('Quiz bundle HTTP ' + res.status);
  const js = await res.text();
  if (js.includes('buklod_quiz_token_hash') && js.includes('verifyOtp')) handler = true;
}
console.log(JSON.stringify({
  htmlStatus: response.status,
  tokenHashHandlerInLiveBundle: handler,
  authenticatedHandoff: 'NOT_VERIFIED',
  sessionLaunchReadyMayBeEnabled: false,
}));
