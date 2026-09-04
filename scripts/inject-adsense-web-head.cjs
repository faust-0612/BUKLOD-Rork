const fs = require('fs');
const path = require('path');

const target = path.resolve(process.cwd(), 'dist', 'index.html');
const client = 'ca-pub-6260135521836249';
const marker = 'BUKLOD_ADSENSE_EXPORT_INJECTION_R2';
const scriptSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;

if (!fs.existsSync(target)) {
  throw new Error(`Missing exported web HTML: ${target}`);
}

let html = fs.readFileSync(target, 'utf8');

const block = [
  `<!-- ${marker} -->`,
  `<meta name="google-adsense-account" content="${client}">`,
  `<script async src="${scriptSrc}" crossorigin="anonymous"></script>`,
].join('');

if (!html.includes(client)) {
  if (!html.includes('</head>')) {
    throw new Error('Could not locate </head> in exported web HTML.');
  }
  html = html.replace('</head>', `${block}</head>`);
  fs.writeFileSync(target, html, 'utf8');
}

const verified = fs.readFileSync(target, 'utf8');
if (!verified.includes(client)) {
  throw new Error('AdSense publisher id was not injected into dist/index.html.');
}
if (!verified.includes('google-adsense-account')) {
  throw new Error('AdSense account meta tag is missing from dist/index.html.');
}
if (!verified.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')) {
  throw new Error('AdSense loader script is missing from dist/index.html.');
}

console.log(`AdSense web-head verification READY for ${client}.`);
