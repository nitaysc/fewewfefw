// node tools/preview/shoot.js <poses.json> <outdir> : renders the placeholder bike/rider to PNGs.
// Needs Playwright + Chromium and three (npm i three@0.160.0 in this folder or set THREE_PATH).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const dir = __dirname, poses = path.resolve(process.argv[2]), out = path.resolve(process.argv[3] || 'out');
const threePath = process.env.THREE_PATH || path.join(dir, 'node_modules/three/build/three.module.js');
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const f = u === '/poses.json' ? poses : u === '/three.module.js' ? threePath : path.join(dir, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/json' }); res.end(b); });
}).listen(0, async () => {
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text()); });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  const shots = JSON.parse(process.env.SHOTS || '[]');
  for (const s of shots) {
    await page.goto(`http://localhost:${port}/?pose=${s.pose}&view=${encodeURIComponent(JSON.stringify(s.view))}`);
    await page.waitForFunction(() => document.title === 'done', null, { timeout: 60000 });
    await page.locator('canvas').screenshot({ path: path.join(out, s.name + '.png') });
    console.log('shot', s.name);
  }
  await browser.close(); srv.close();
});
