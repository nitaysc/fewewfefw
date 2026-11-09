// Builds a self-contained web version (one bundled script + assets) in dist-web/, laid out
// for publishing as a claude.ai artifact or any static host: `npm run web`.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const www = root + 'www/', out = root + 'dist-web/';
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
  entryPoints: [www + 'js/main.js'], bundle: true, format: 'esm', minify: true, target: 'es2020',
  outfile: out + 'game.js', legalComments: 'none', logLevel: 'warning',
});
await cp(www + 'assets', out + 'assets', { recursive: true });
const html = await readFile(www + 'index.html', 'utf8');
const css = (await readFile(www + 'fonts.css', 'utf8')) + '\n' + (await readFile(www + 'style.css', 'utf8'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script type="module" src="js\/main.js"><\/script>/, '<script type="module" src="game.js"></script>');
const page = `<meta charset="utf-8">\n<title>The Great Lawn</title>\n<style>\n${css}\n</style>\n${body.trim()}\n`;
await writeFile(out + 'index.html', page);
console.log('dist-web ready:', out);
