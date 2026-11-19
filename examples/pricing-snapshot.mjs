import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scrape} from './lib/firecrawl.mjs';

const schema = JSON.parse(await readFile(new URL('./pricing.schema.json', import.meta.url), 'utf8'));
export function validate(value) {
  if (!value || Object.keys(value).join() !== 'plans' || !Array.isArray(value.plans) || !value.plans.length) {
    throw Error('Expected a nonempty plans array.');
  }
  for (const plan of value.plans) {
    if (!plan || Object.keys(plan).sort().join() !== 'billing,currency,name,price' ||
        !['name','price'].every(key => typeof plan[key] === 'string' && plan[key].trim()) ||
        !['currency','billing'].every(key => plan[key] === null || typeof plan[key] === 'string')) {
      throw Error('Plan does not match pricing.schema.json.');
    }
  }
  return value;
}
export function tablePlans(markdown) {
  const rows = markdown.split('\n').map(line => line.trim());
  const cells = line => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
  const plans = [];
  for (let i=0; i<rows.length-1; i++) {
    if (!rows[i].includes('|')) continue;
    const head = cells(rows[i]).map(cell => cell.toLowerCase());
    const nameIndex = head.findIndex(cell => cell === 'plan' || cell === 'name');
    const priceIndex = head.indexOf('price');
    const separators = cells(rows[i+1]);
    if (nameIndex < 0 || priceIndex < 0 || separators.length !== head.length ||
        !separators.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
    const currencyIndex = head.indexOf('currency'), billingIndex = head.indexOf('billing');
    i += 2;
    for (; i<rows.length && rows[i].includes('|'); i++) {
      const row = cells(rows[i]);
      if (row.length !== head.length || !row[nameIndex] || !row[priceIndex]) throw Error('Incomplete pricing table.');
      plans.push({name:row[nameIndex], price:row[priceIndex],
        currency: currencyIndex >= 0 ? row[currencyIndex] || null : null,
        billing: billingIndex >= 0 ? row[billingIndex] || null : null});
    }
    i--;
  }
  if (!plans.length) throw Error('No supported Plan | Price table. Use a full API with --server-json or review markdown manually.');
  return validate({plans});
}
async function main() {
  const args = process.argv.slice(2), serverJSON = args.includes('--server-json');
  const positional = args.filter(arg => arg !== '--server-json');
  if (!positional[0]) throw Error('Usage: node examples/pricing-snapshot.mjs URL [output.json] [--server-json]');
  const formats = serverJSON ? [{type:'json', schema,
    prompt:'Extract visible plan names and literal prices only. Preserve billing terms. Use null for unstated currency or billing. Do not invent prices or convert annual totals.'}] : ['markdown'];
  const data = await scrape(positional[0], formats);
  const result = serverJSON ? validate(data.json) : tablePlans(data.markdown || '');
  const output = resolve(positional[1] || 'output/pricing.json');
  const snapshot = {sourceUrl: new URL(positional[0]).href, capturedAt: new Date().toISOString(),
    extractionMode: serverJSON ? 'server-json' : 'local-table', ...result};
  await mkdir(dirname(output), {recursive:true});
  const temporary = output + `.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
  await rename(temporary, output);
  console.log(`Saved ${result.plans.length} plans to ${output}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
