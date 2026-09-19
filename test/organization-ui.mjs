import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  data = await fs.mkdtemp(path.join(os.tmpdir(), 'career-organization-')),
  url = 'http://127.0.0.1:4325';
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, STUDIO_DATA: data, PORT: '4325' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
server.stderr.on('data', (b) => (stderr += b));
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('exit', () => reject(Error(stderr)));
});
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1512, height: 1000 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.setDefaultTimeout(10000);
await fs.mkdir(path.join(root, '.test-data'), { recursive: true });
try {
  await page.goto(url);
  const frame = page.frameLocator('iframe');
  await frame.locator('h1').first().waitFor();
  const config = await (await page.request.get(url + '/api/config')).json(),
    headers = { 'X-Studio-Token': config.token };
  const get = async (p) => (await page.request.get(url + p, { headers })).json();
  const post = async (p, data, status = 200) => {
    const r = await page.request.post(url + p, { headers, data });
    assert.equal(r.status(), status, await r.text());
    return r.json();
  };
  const catalog = await get('/api/documents');
  assert.equal(catalog.length, 11);
  const before = await get('/api/documents/resume--document');
  await page.getByRole('button', { name: '＋ 회사 추가', exact: true }).click();
  await page.getByLabel('회사 이름', { exact: true }).fill('Synthetic Company');
  await page.getByLabel('지원 직무', { exact: true }).fill('Test role');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await page.getByRole('button', { name: '＋ 이 회사 문서 만들기', exact: true }).click();
  await page.getByLabel('문서 이름').fill('Synthetic application');
  await page.getByLabel('시작할 문서').selectOption('resume--document');
  await page.getByRole('button', { name: '만들기', exact: true }).click();
  await page.getByRole('heading', { name: 'Synthetic application', exact: true }).waitFor();
  const doc = (await get('/api/documents')).find((d) => d.name === 'Synthetic application'),
    company = (await get('/api/companies'))[0];
  assert.equal(doc.companyId, company.id);
  assert.equal((await get('/api/companies/' + company.id)).role, 'Test role');
  await frame.locator('article h3').click();
  await page.getByRole('button', { name: '박스 선택', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: '박스 선택', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await frame.locator('article h3').click();
  assert.equal(await frame.locator('[data-studio-selected]').evaluate((n) => n.tagName), 'ARTICLE');
  const inner = page.getByLabel('박스 안 텍스트 선택');
  const heading = await frame.locator('article h3').getAttribute('data-studio-id');
  await inner.selectOption(heading);
  assert.equal(await frame.locator('[data-studio-selected]').evaluate((n) => n.tagName), 'H3');
  await page.getByRole('button', { name: '선택한 블록 삭제', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택한 블록을 삭제할까요?' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  assert.equal(await frame.locator('article h3').count(), 1);
  await page.getByRole('button', { name: '선택한 블록 삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  assert.equal(await frame.locator('article h3').count(), 0);
  assert.equal(await frame.locator('article').count(), 1);
  await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  assert.equal(await frame.locator('article h3').count(), 1);
  await frame.locator('article h3').fill('');
  await page.getByRole('button', { name: '박스 선택', exact: true }).click();
  await frame.locator('article').click({ position: { x: 8, y: 8 } });
  assert.match(await page.getByLabel('박스 안 텍스트 선택').innerText(), /빈 텍스트 블록/);
  await page.getByRole('button', { name: '선택한 블록 삭제', exact: true }).click();
  await dialog.press('Escape');
  assert.equal(await dialog.count(), 0);
  await page.getByRole('button', { name: '선택한 블록 삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  assert.equal(await frame.locator('article').count(), 0);
  await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  await frame.locator('.page').click({ position: { x: 5, y: 5 } });
  await page.getByRole('button', { name: '선택한 블록 삭제', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '마지막 페이지' }).waitFor();
  await page.getByRole('alert').getByRole('button', { name: '닫기' }).click();
  await page.getByRole('button', { name: '글자 편집', exact: true }).click();
  await frame.locator('article p').first().click();
  await page.setViewportSize({ width: 820, height: 900 });
  await page.getByRole('button', { name: '선택 항목 설정', exact: true }).click();
  assert.ok((await page.locator('.inspector').boundingBox()).height > 800);
  await page.screenshot({ path: path.join(root, '.test-data/organization-compact.png') });
  await page.getByRole('button', { name: '설정창 닫기' }).click();
  await page.setViewportSize({ width: 1512, height: 1000 });
  const saved = page.waitForResponse((r) => r.url().endsWith('/save'));
  await frame.locator('h1').press('Meta+s');
  await saved;
  const prior = await get('/api/documents/' + doc.id);
  await page.getByLabel('회사 폴더', { exact: true }).selectOption('');
  await page.locator('.doc-group').getByRole('button', { name: doc.name, exact: true }).waitFor();
  const moved = await get('/api/documents/' + doc.id);
  assert.equal(moved.html, prior.html);
  assert.deepEqual(moved.history, prior.history);
  assert.equal(moved.doc.companyId, undefined);
  await post(
    '/api/documents/' + doc.id + '/company',
    { companyId: company.id, expectedCompanyId: company.id },
    409,
  );
  await post(
    '/api/documents/' + doc.id + '/company',
    { companyId: '../outside', expectedCompanyId: null },
    400,
  );
  await post(
    '/api/documents/resume--document/company',
    { companyId: company.id, expectedCompanyId: null },
    400,
  );
  assert.equal((await get('/api/documents/resume--document')).html, before.html);
  await page.getByLabel('회사 폴더', { exact: true }).selectOption(company.id);
  await page
    .locator('.company-documents')
    .getByRole('button', { name: doc.name, exact: true })
    .waitFor();
  await page.reload();
  await frame.locator('h1').first().waitFor();
  assert.equal(await page.getByLabel('회사 폴더', { exact: true }).inputValue(), company.id);
  await page.getByRole('button', { name: '블록 모드', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '박스 선택', exact: true }).count(), 0);
  await frame.locator('h1').fill('Synthetic edited title');
  await page.getByRole('button', { name: '레이아웃 모드', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: '글자 편집', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  // A tagged section must not hide untagged siblings; nested rows have distinct toggles.
  await page.getByRole('button', { name: 'PR 중심형', exact: true }).click();
  await frame.locator('[data-section="주요 변경"]').waitFor();
  await page.getByRole('button', { name: '구성 · 포함', exact: true }).click();
  const checks = page.locator('.outline-item input');
  assert.ok((await checks.count()) >= 8);
  await page.getByLabel('프로젝트 맥락 포함', { exact: true }).uncheck();
  assert.equal(
    await frame.locator('[data-section="프로젝트 맥락"]').getAttribute('data-excluded'),
    'true',
  );
  assert.equal(
    await frame.locator('[data-section="주요 변경"]').getAttribute('data-excluded'),
    null,
  );
  await page.screenshot({ path: path.join(root, '.test-data/organization-desktop.png') });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: 11 neutral templates, shared company folders, copy isolation, metadata-only moves/conflicts, inner/empty text and box delete/undo, last page guard, compact settings, nested inclusion, mode compatibility',
  );
} catch (e) {
  await page.screenshot({ path: path.join(root, '.test-data/organization-failure.png') });
  console.error(errors, stderr);
  throw e;
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
