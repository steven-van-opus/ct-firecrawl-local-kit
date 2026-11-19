import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, writeFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec = promisify(execFile);
const kit = fileURLToPath(new URL('../', import.meta.url));

test('changelog snapshots advance only after successful scrapes', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'ct-changelogs-'));
  let markdown = '# FrameKit\n- SRT export\n', status = 200, blocked = false;
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    assert.equal(request.url, '/v2/scrape');
    assert.deepEqual(JSON.parse(raw).formats, ['markdown']);
    response.writeHead(status, {'Content-Type':'application/json'});
    response.end(JSON.stringify({success: true, data:{markdown, blocked}}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const list = join(folder, 'urls.json'), state = join(folder, 'state');
    await writeFile(list, JSON.stringify(['https://products.test/changelog']));
    const run = () => exec(process.execPath, ['examples/changelog-watch.mjs',list,state], {
      cwd:kit, env:{...process.env,FIRECRAWL_API_URL:`http://127.0.0.1:${server.address().port}`,FIRECRAWL_API_KEY:''}
    });
    assert.match((await run()).stdout, /BASELINE/);
    const name = (await readdir(state)).find(name => name.endsWith('.md'));
    assert.equal(await readFile(join(state,name),'utf8'), markdown);
    markdown += '- Speaker search\n';
    assert.match((await run()).stdout, /CHANGED/);
    const diff = await readFile(join(state,name+'.diff'),'utf8');
    assert.match(diff, /@@ -2,0 \+3,1 @@\n\+- Speaker search\n/);
    // An external patch utility must accept the emitted unified diff.
    const old = join(folder, 'old.md');
    await writeFile(old, '# FrameKit\n- SRT export\n');
    await exec('patch', ['--batch',old,join(state,name+'.diff')]);
    assert.equal(await readFile(old,'utf8'), markdown);
    assert.match((await run()).stdout, /UNCHANGED/);
    assert.equal(await readFile(join(state,name+'.diff'),'utf8'),'');
    for (const failure of ['http','empty','blocked']) {
      status = failure === 'http' ? 503 : 200;
      blocked = failure === 'blocked';
      if (failure === 'empty') markdown = '';
      await assert.rejects(run(), error => error.code === 1);
      assert.match(await readFile(join(state,name),'utf8'), /Speaker search/);
    }
  } finally { await new Promise(resolve => server.close(resolve)); await rm(folder,{recursive:true,force:true}); }
});

test('pricing uses local tables or explicit server schema and preserves output on failure', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'ct-pricing-'));
  let data = {markdown:'| Plan | Price | Currency | Billing |\n| --- | --- | --- | --- |\n| Starter | $0 | USD | monthly |\n| Team | Contact sales | | |\n'};
  let requestBody;
  const server = createServer(async (request,response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    requestBody = JSON.parse(raw);
    response.setHeader('Content-Type','application/json');
    response.end(JSON.stringify({success:true,data}));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const output = join(folder,'pricing.json');
    const run = (...flags) => exec(process.execPath,['examples/pricing-snapshot.mjs','https://products.test/pricing',output,...flags],{
      cwd:kit,env:{...process.env,FIRECRAWL_API_URL:`http://127.0.0.1:${server.address().port}`,FIRECRAWL_API_KEY:''}
    });
    await run();
    let snapshot = JSON.parse(await readFile(output,'utf8'));
    assert.deepEqual(snapshot.plans,[{name:'Starter',price:'$0',currency:'USD',billing:'monthly'},
      {name:'Team',price:'Contact sales',currency:null,billing:null}]);
    assert.equal(snapshot.extractionMode,'local-table');
    const previous = await readFile(output,'utf8');
    data = {markdown:'# Pricing\nContact us for plans.'};
    await assert.rejects(run(), error => /No supported/.test(error.stderr));
    assert.equal(await readFile(output,'utf8'), previous);
    data = {json:{plans:[{name:'Studio',price:'18',currency:'USD',billing:'monthly'}]}};
    await run('--server-json');
    assert.equal(requestBody.formats[0].type,'json');
    assert.deepEqual(requestBody.formats[0].schema.required,['plans']);
    snapshot = JSON.parse(await readFile(output,'utf8'));
    assert.equal(snapshot.plans[0].name,'Studio');
    const serverSnapshot = await readFile(output,'utf8');
    // Local ignores JSON; malformed or missing JSON must not replace a valid file.
    for (const bad of [{markdown:'JSON unavailable'}, {json:{plans:[{name:'Fake',price:18}]}}]) {
      data = bad; await assert.rejects(run());
      assert.equal(await readFile(output,'utf8'),serverSnapshot);
    }
  } finally { await new Promise(resolve => server.close(resolve)); await rm(folder,{recursive:true,force:true}); }
});
