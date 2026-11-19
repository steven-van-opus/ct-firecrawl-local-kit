import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {scrape} from './lib/firecrawl.mjs';

// One valid unified hunk: preserve common ends and show all changed middle lines.
export function diffLines(before, after, name) {
  if (before === after) return '';
  const a = before.trimEnd().split('\n'), b = after.trimEnd().split('\n');
  let start = 0, end = 0;
  while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++;
  while (end < Math.min(a.length, b.length) - start && a[a.length-1-end] === b[b.length-1-end]) end++;
  const left = a.slice(start, a.length-end), right = b.slice(start, b.length-end);
  const leftStart = left.length ? start+1 : start;
  const rightStart = right.length ? start+1 : start;
  return [`--- a/${name}`, `+++ b/${name}`, `@@ -${leftStart},${left.length} +${rightStart},${right.length} @@`,
    ...left.map(line => '-' + line), ...right.map(line => '+' + line), ''].join('\n');
}
async function atomic(path, content) {
  const temporary = path + `.${process.pid}.tmp`;
  await writeFile(temporary, content); await rename(temporary, path);
}
async function main() {
  const list = JSON.parse(await readFile(resolve(process.argv[2] || 'config/changelogs.json'), 'utf8'));
  if (!Array.isArray(list) || !list.length || list.some(url => typeof url !== 'string')) {
    throw Error('Changelog input must be a nonempty JSON array of URLs.');
  }
  const directory = resolve(process.argv[3] || 'state/changelogs');
  await mkdir(directory, {recursive: true});
  let failed = false;
  for (const url of [...new Set(list)]) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.endsWith('.example')) throw Error('Replace the fictional .example URL with a product changelog.');
      const name = parsed.hostname.replace(/[^a-z0-9.-]/gi, '_') + '-' + createHash('sha256').update(url).digest('hex').slice(0,12) + '.md';
      const data = await scrape(url, ['markdown']);
      if (typeof data.markdown !== 'string' || !data.markdown.trim()) throw Error('Empty markdown; baseline preserved.');
      const next = data.markdown.replace(/\r\n/g, '\n').trimEnd() + '\n';
      const lastPath = join(directory, name);
      let previous;
      try { previous = await readFile(lastPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const diff = previous === undefined ? '' : diffLines(previous, next, name);
      await atomic(join(directory, name + '.diff'), diff);
      if (previous !== next) await atomic(lastPath, next);
      await atomic(join(directory, name + '.json'), JSON.stringify({url, capturedAt: new Date().toISOString(), changed: Boolean(diff), baseline: previous === undefined}, null, 2) + '\n');
      console.log(`${previous === undefined ? 'BASELINE' : diff ? 'CHANGED' : 'UNCHANGED'} ${url}`);
    } catch (error) { failed = true; console.error(`${url}: ${error.message}`); }
  }
  if (failed) process.exitCode = 1;
}
// Allows importing diffLines in tests without starting a run.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
