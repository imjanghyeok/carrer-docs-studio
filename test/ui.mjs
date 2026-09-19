import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = await fs.mkdtemp(path.join(os.tmpdir(), 'career-public-ui-'));
const port = 4321,
  url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), STUDIO_DATA: data },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
server.stderr.on('data', (s) => (stderr += s));
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('exit', () => reject(Error(stderr)));
});
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1512, height: 1050 } });
const errors = [],
  external = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('request', (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith(url + '/')) external.push(r.url());
});
await fs.mkdir(path.join(root, '.test-data'), { recursive: true });
try {
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'templates/catalog.json'), 'utf8'));
  const originals = new Map(
    await Promise.all(
      catalog.map(async (d) => [
        d.template,
        await fs.readFile(path.join(root, 'templates', d.template), 'utf8'),
      ]),
    ),
  );
  await page.goto(url);
  const frame = page.frameLocator('iframe');
  await frame.locator('h1').first().waitFor();
  const config = await (await page.request.get(url + '/api/config')).json();
  assert.equal(config.app, 'career-studio-public');
  const post = (route, payload) =>
    page.request.post(url + route, { data: payload, headers: { 'X-Studio-Token': config.token } });
  assert.equal(
    (await (await page.request.get(url + '/api/documents')).json()).length,
    catalog.length,
  );
  for (const d of catalog) {
    const state = await (await page.request.get(url + '/api/documents/' + d.id)).json();
    assert.equal(state.html, originals.get(d.template));
    const saved = await (
      await post('/api/documents/' + d.id + '/save', { revision: state.revision, html: state.html })
    ).json();
    const exported = await post('/api/documents/' + d.id + '/export', { revision: saved.revision });
    assert.equal(exported.status(), 200);
    assert.match(
      execFileSync('pdfinfo', [path.join(data, 'exports', d.id + '.pdf')], { encoding: 'utf8' }),
      /Pages:\s+1\b/,
    );
    execFileSync('pdftoppm', [
      '-scale-to',
      '900',
      '-singlefile',
      '-png',
      path.join(data, 'exports', d.id + '.pdf'),
      path.join(root, '.test-data/template-' + d.id),
    ]);
  }
  await page.screenshot({ path: path.join(root, '.test-data/public-studio.png') });
  console.log(
    'PASS: standalone catalog and blank templates export without personal workspace dependencies',
  );
  await page.getByRole('button', { name: '새 문서', exact: true }).click();
  await page.getByLabel('문서 이름').fill('가상 편집 예제');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await frame.locator('h1').filter({ hasText: '새로운 이야기' }).waitFor();
  await frame.locator('h1').fill('샘플 문서 편집');
  await frame.locator('p').fill('첫째 줄');
  await frame.locator('p').press('End');
  await frame.locator('p').press('Shift+Enter');
  await frame.locator('p').pressSequentially('Second line');
  await page.locator('.save-status').filter({ hasText: '자동 저장됨' }).waitFor();
  await page.reload();
  await frame.locator('h1').filter({ hasText: '샘플 문서 편집' }).waitFor();
  assert.match(await frame.locator('p').innerText(), /첫째 줄\nSecond line/);
  await frame.locator('h1').click();
  await page.getByRole('button', { name: '가운데', exact: true }).click();
  assert.equal(await frame.locator('h1').evaluate((n) => n.style.textAlign), 'center');
  await page.getByRole('button', { name: '박스', exact: true }).click();
  await frame.locator('div h3').fill('출력 제외 샘플');
  await frame.locator('div h3').click();
  await page.getByRole('button', { name: '바깥 박스 선택', exact: false }).click();
  await page.getByLabel('PDF에 포함', { exact: false }).uncheck();
  await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  assert.equal(await frame.locator('[data-excluded=true]').count(), 0);
  await page.getByRole('button', { name: '다시 실행', exact: true }).click();
  assert.equal(await frame.locator('[data-excluded=true]').count(), 1);
  await frame.locator('h1').click();
  await page.getByRole('button', { name: '그래프 추가', exact: false }).click();
  const graph = page.getByRole('dialog', { name: '그래프 편집' });
  await graph.getByLabel('그래프 제목').fill('가상 수치');
  await graph.getByLabel('행 1 이름').fill('샘플 A');
  await graph.getByLabel('행 1 값').fill('10');
  await graph.getByRole('button', { name: '그래프 적용' }).click();
  await frame.locator('.studio-value-chart').click();
  await page.getByRole('button', { name: '그래프 데이터 편집', exact: false }).click();
  assert.equal(await graph.getByLabel('행 1 값').inputValue(), '10');
  await graph.getByRole('button', { name: '취소', exact: true }).click();
  await frame.locator('h1').click();
  await page.getByRole('button', { name: '다이어그램', exact: true }).click();
  await page.locator('.excalidraw canvas').first().waitFor({ timeout: 20000 });
  await page
    .locator('label')
    .filter({ has: page.getByTestId('toolbar-rectangle') })
    .click();
  const box = await page.locator('.excalidraw canvas').last().boundingBox();
  await page.mouse.move(box.x + 400, box.y + 230);
  await page.mouse.down();
  await page.mouse.move(box.x + 590, box.y + 310, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: '문서에 넣기', exact: true }).click();
  await frame.locator('.studio-diagram svg').waitFor();
  await page.getByRole('button', { name: '다이어그램 다시 편집' }).click();
  await page.locator('.excalidraw canvas').first().waitFor();
  await page.getByRole('button', { name: '문서에 넣기', exact: true }).click();
  await page.getByRole('button', { name: 'PDF 내보내기', exact: true }).click();
  await page.getByRole('link', { name: '다운로드 ↗' }).waitFor({ timeout: 30000 });
  const list = await (await page.request.get(url + '/api/documents')).json(),
    doc = list.find((d) => d.name === '가상 편집 예제');
  const pdf = path.join(data, 'exports', doc.id + '.pdf');
  const text = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
  assert.match(text, /샘플 문서 편집/);
  assert.doesNotMatch(text, /출력 제외 샘플/);
  assert.match(text, /샘플 A/);
  await fs.copyFile(pdf, path.join(root, '.test-data/sample-export.pdf'));
  console.log(
    'PASS: text/newline, reload, boxes, exclusion, undo/redo, chart, Excalidraw round trip and PDF',
  );
  const template = catalog[0],
    state = await (await page.request.get(url + '/api/documents/' + template.id)).json();
  const changed = await (
    await post('/api/documents/' + template.id + '/save', {
      revision: state.revision,
      html: state.html.replace('이름을 입력하세요', '가상 이름'),
    })
  ).json();
  assert.equal(
    (
      await post('/api/documents/' + template.id + '/apply', {
        revision: changed.revision,
        sourceHash: changed.sourceHash,
      })
    ).status(),
    200,
  );
  assert.match(
    await fs.readFile(path.join(data, 'originals', template.id + '.html'), 'utf8'),
    /가상 이름/,
  );
  for (const [file, original] of originals)
    assert.equal(await fs.readFile(path.join(root, 'templates', file), 'utf8'), original);
  assert.equal(
    (await post('/api/documents/' + doc.id + '/save', { revision: -1, html: state.html })).status(),
    409,
  );
  assert.equal(
    (await page.request.post(url + '/api/documents', { data: { name: 'denied' } })).status(),
    403,
  );
  assert.equal((await page.request.get(url + '/source/private/file.pdf')).status(), 403);
  assert.equal((await page.request.get(url + '/data/ai/chats/anything.json')).status(), 404);
  assert.equal((await page.request.get(url + '/excalidraw-assets/package.json')).status(), 403);
  const exportedState = await (await page.request.get(url + '/api/documents/' + doc.id)).json();
  assert.equal(
    (
      await post('/api/documents/' + doc.id + '/restore', {
        revision: exportedState.revision,
        target: 0,
      })
    ).status(),
    200,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    'PASS: immutable tracked templates, external data, conflict/history, CSRF and resource isolation; no external browser requests',
  );
} catch (e) {
  await page.screenshot({ path: path.join(root, '.test-data/failure.png') });
  console.error(errors, stderr);
  throw e;
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
