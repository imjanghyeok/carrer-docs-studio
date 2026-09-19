import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newDocumentHtml } from '../lib/new-document.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  data = await fs.mkdtemp(path.join(os.tmpdir(), 'career-blocks-')),
  url = 'http://127.0.0.1:4324';
assert.throws(() => newDocumentHtml('unknown'));
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, STUDIO_DATA: data, PORT: '4324' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
server.stderr.on('data', (b) => (stderr += b));
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('exit', () => reject(Error(stderr)));
});
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1512, height: 1050 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.setDefaultTimeout(10000);
await fs.mkdir(path.join(root, '.test-data'), { recursive: true });
try {
  await page.goto(url);
  const frame = page.frameLocator('iframe');
  await frame.locator('h1').first().waitFor();
  await page.getByRole('button', { name: '새 문서', exact: true }).click();
  await page.getByLabel('문서 이름').fill('Synthetic block editing');
  await page.getByLabel('새 문서 형식').selectOption('two-column');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await frame.locator('.document-columns').waitFor();
  const config = await (await page.request.get(url + '/api/config')).json(),
    headers = { 'X-Studio-Token': config.token };
  const get = async (endpoint) => (await page.request.get(url + endpoint, { headers })).json();
  const post = async (endpoint, data) => {
    const res = await page.request.post(url + endpoint, { headers, data });
    assert.ok(res.ok(), await res.text());
    return res.json();
  };
  const doc = (await get('/api/documents')).find((d) => d.name === 'Synthetic block editing');
  const save = async () => {
    const wait = page.waitForResponse(
      (r) => r.url().endsWith('/save') && r.request().method() === 'POST',
    );
    await frame.locator('h1').first().press('Meta+s');
    await wait;
  };
  await save();
  const initial = await get('/api/documents/' + doc.id);
  async function pdf(name) {
    const done = page.waitForResponse(
      (r) => r.url().endsWith('/export') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'PDF 내보내기', exact: true }).click();
    assert.ok((await done).ok());
    await page.getByRole('button', { name: 'PDF 내보내기', exact: true }).waitFor();
    const res = await page.request.get(url + '/exports/' + doc.id + '.pdf');
    const file = path.join(root, '.test-data/' + name + '.pdf');
    await fs.writeFile(file, await res.body());
    execFileSync('pdftoppm', ['-scale-to', '1000', '-singlefile', '-png', file, file.slice(0, -4)]);
    return fs.readFile(file.slice(0, -4) + '.png');
  }
  const layoutPdf = await pdf('blocks-layout');
  await page.getByRole('button', { name: '블록 모드', exact: true }).click();
  await frame.locator('html[data-studio-mode="blocks"]').waitFor();
  assert.equal(
    await frame.locator('.document-columns').evaluate((n) => getComputedStyle(n).display),
    'block',
  );
  assert.equal(await page.getByLabel('너비', { exact: true }).count(), 0);
  await page.screenshot({ path: path.join(root, '.test-data/blocks-mode.png') });
  const blockPdf = await pdf('blocks-output');
  assert.deepEqual(blockPdf, layoutPdf, 'Switching modes must not change PDF layout');
  // Playwright's caret-hiding screenshot helper can leave empty style attributes.
  await save();
  const unchanged = await get('/api/documents/' + doc.id);
  assert.equal(
    unchanged.html.replaceAll(' style=""', ''),
    initial.html.replaceAll(' style=""', ''),
  );
  assert.doesNotMatch(unchanged.html, /data-studio-mode|내용을 입력하거나 \/ 로/);
  await post('/api/documents/' + doc.id + '/save', {
    revision: unchanged.revision,
    html: unchanged.html.replace(
      '나를 소개하는 내용을 작성하세요.',
      '<strong>나를 소개하는 내용을 작성하세요.</strong> <a href="https://example.com/evidence">근거</a>',
    ),
  });
  await page.reload();
  await frame.locator('html[data-studio-mode="blocks"]').waitFor();
  const intro = frame.locator('p').filter({ hasText: '나를 소개하는 내용을 작성하세요.' });
  await intro.click();
  await page.getByLabel('선택 블록 형식').selectOption('h3');
  await frame.locator('h3').filter({ hasText: '나를 소개하는' }).waitFor();
  await page.getByLabel('선택 블록 형식').selectOption('bullet');
  await frame.locator('li').filter({ hasText: '나를 소개하는' }).waitFor();
  assert.equal(await frame.locator('li strong').count(), 1);
  assert.equal(await frame.locator('li a').getAttribute('href'), 'https://example.com/evidence');
  assert.equal(
    await frame
      .locator('[data-studio-id]')
      .evaluateAll((nodes) => new Set(nodes.map((n) => n.dataset.studioId)).size === nodes.length),
    true,
  );
  const item = frame.locator('li').first();
  await item.fill('First item');
  await item.press('End');
  await item.press('Enter');
  const empty = frame.locator('li').nth(1);
  await empty.fill('Second item');
  await empty.press('End');
  await empty.press('Enter');
  const blank = frame.locator('li').nth(2);
  await blank.press('Enter');
  const paragraph = frame.locator('p:focus');
  await paragraph.press('/');
  await page.getByRole('dialog', { name: '블록 형식 선택' }).waitFor();
  await page
    .getByRole('dialog', { name: '블록 형식 선택' })
    .getByRole('button', { name: '인용문', exact: true })
    .click();
  const quote = frame.locator('blockquote');
  await quote.fill('Quote text');
  await quote.press('End');
  await quote.press('Shift+Enter');
  await quote.pressSequentially('Second line');
  assert.match(await quote.innerText(), /Quote text\nSecond line/);
  const count = await frame.locator('blockquote,p').count();
  await quote.dispatchEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    isComposing: true,
    bubbles: true,
  });
  assert.equal(await frame.locator('blockquote,p').count(), count);
  await quote.click();
  await page.getByRole('button', { name: '블록 복제', exact: true }).click();
  assert.equal(await frame.locator('blockquote').count(), 2);
  await page.getByRole('button', { name: '블록 삭제', exact: true }).click();
  assert.equal(await frame.locator('blockquote').count(), 1);
  await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  assert.equal(await frame.locator('blockquote').count(), 2);
  await page.getByRole('button', { name: '다시 실행', exact: true }).click();
  assert.equal(await frame.locator('blockquote').count(), 1);
  await page.getByRole('button', { name: '＋ 블록 추가', exact: true }).click();
  await page
    .getByRole('dialog', { name: '블록 형식 선택' })
    .getByRole('button', { name: '구분선', exact: true })
    .click();
  assert.equal(await frame.locator('hr').count(), 1);
  await page.getByRole('button', { name: '레이아웃 모드', exact: true }).click();
  assert.equal(
    await frame.locator('.document-columns').evaluate((n) => getComputedStyle(n).display),
    'grid',
  );
  assert.equal(await frame.locator('li').count(), 2);
  await save();
  await page.reload();
  await frame.locator('blockquote').waitFor();
  assert.equal(
    await frame.locator('.document-columns').evaluate((n) => getComputedStyle(n).display),
    'grid',
  );
  await page.getByRole('button', { name: '블록 모드', exact: true }).click();
  await save();
  await page.reload();
  await frame.locator('html[data-studio-mode="blocks"]').waitFor();
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.screenshot({ path: path.join(root, '.test-data/blocks-compact.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: '새 문서', exact: true }).click();
  await page.getByLabel('문서 이름').fill('Synthetic block format');
  await page.getByLabel('새 문서 형식').selectOption('blocks');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await frame.locator('h2').filter({ hasText: '활동' }).waitFor();
  assert.equal(await frame.locator('html').getAttribute('data-studio-mode'), 'blocks');
  assert.deepEqual(errors, []);
  console.log(
    'PASS: two modes preserve HTML/PDF, block types, list Enter/exit, slash menu, soft newline, IME guard, duplicate/delete/undo/redo, reload and new formats',
  );
} catch (e) {
  await page.screenshot({ path: path.join(root, '.test-data/blocks-failure.png') });
  console.error(errors, stderr);
  throw e;
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
