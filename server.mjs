import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { createTwoFilesPatch, applyPatch } from 'diff';
import { chromium } from 'playwright';
import { AIService } from './ai-service.mjs';
import { defaultDataDirectory, containedFile } from './lib/paths.mjs';
import { CompanyStore } from './lib/company-store.mjs';
import { newDocumentHtml } from './lib/new-document.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = here;
const data = defaultDataDirectory();
const outputs = path.join(data, 'exports');
const templates = path.join(root, 'templates');
const port = Number(process.env.PORT || 4318);
const token = randomBytes(24).toString('hex');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const queues = new Map();
const renders = new Map();
const companies = new CompanyStore({ data, locked, atomic });
const ai = new AIService({ data, getDoc, load, save, locked, atomic, materials: companies });
let browser;
await fs.mkdir(data, { recursive: true, mode: 0o700 });
await fs.mkdir(outputs, { recursive: true, mode: 0o700 });

async function atomic(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + '.' + randomUUID() + '.tmp';
  await fs.writeFile(tmp, text, { mode: 0o600 });
  await fs.rename(tmp, file);
}
async function jsonFile(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}
function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
function locked(id, action) {
  const promise = (queues.get(id) || Promise.resolve()).catch(() => {}).then(action);
  queues.set(id, promise);
  return promise;
}
async function catalog() {
  const docs = await jsonFile(path.join(templates, 'catalog.json'));
  return [...docs, ...(await jsonFile(path.join(data, 'custom.json'), []))];
}
async function getDoc(id) {
  const doc = (await catalog()).find((d) => d.id === id);
  if (!doc) fail('문서를 찾을 수 없습니다.', 404);
  return doc;
}
function sourcePath(doc) {
  return path.join(data, 'originals', doc.id + '.html');
}
async function ensureOriginal(doc) {
  if (doc.custom) return;
  const file = sourcePath(doc);
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    await fs.writeFile(file, await fs.readFile(await containedFile(templates, doc.template)), {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}
function draftPath(id) {
  return path.join(data, 'drafts', id + '.json');
}
async function load(doc) {
  await ensureOriginal(doc);
  const original = await fs.readFile(sourcePath(doc), 'utf8');
  const draft = await jsonFile(draftPath(doc.id), null);
  return {
    doc,
    html: draft?.html ?? original,
    revision: draft?.revision || 0,
    updatedAt: draft?.updatedAt || null,
    sourceHash: hash(original),
    base: '/',
    history: draft?.history?.map(({ at, revision, reason }) => ({ at, revision, reason })) || [],
  };
}
function checkHtml(html) {
  if (typeof html !== 'string' || !/<body[\s>]/i.test(html) || Buffer.byteLength(html) > 12_000_000)
    fail('올바른 HTML 문서가 아닙니다 (최대 12MB).');
  return html;
}
async function save(doc, payload) {
  await ensureOriginal(doc);
  const old = await jsonFile(draftPath(doc.id), null);
  const revision = old?.revision || 0;
  if (payload.revision !== revision)
    fail('다른 창에서 문서가 변경됐습니다. 현재 내용을 복사한 뒤 문서를 다시 열어 주세요.', 409);
  const html = checkHtml(payload.html);
  const original = await fs.readFile(sourcePath(doc), 'utf8');
  if (html === old?.html) return load(doc);
  const prior = old?.html ?? original;
  const next = {
    html,
    base: old?.base ?? original,
    revision: revision + 1,
    updatedAt: new Date().toISOString(),
    history: [
      ...(old?.history || []),
      {
        revision: revision + 1,
        at: new Date().toISOString(),
        reason: String(payload.reason || '편집 저장').slice(0, 120),
        patch: createTwoFilesPatch('before.html', 'after.html', prior, html, '', '', {
          context: 3,
        }),
      },
    ],
  };
  await atomic(draftPath(doc.id), JSON.stringify(next));
  return load(doc);
}
function printHtml(html, base) {
  // Iframe and print renderer both enforce CSP: authored content cannot execute scripts.
  html = html.replace(/<base\b[^>]*>/gi, '');
  return html
    .replace(/<head[^>]*>/i, `$&<base href="${base}">`)
    .replace(
      /<\/head>/i,
      `<style data-studio-print>[data-excluded="true"]{display:none!important} [data-studio-selected]{outline:none!important} .page:last-of-type{break-after:auto;page-break-after:auto} @media print{html,body{background:white!important}.page{box-shadow:none!important;margin:0 auto!important}}</style></head>`,
    );
}
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 14_000_000) fail('요청이 너무 큽니다.', 413);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail('JSON 형식을 확인해 주세요.');
  }
}
function reply(res, status, value, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(value));
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
};
const frameCSP =
  "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'";
async function sendFile(res, file, headers = {}) {
  const buffer = await fs.readFile(file);
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
    ...headers,
  });
  res.end(buffer);
}
const server = http.createServer(async (req, res) => {
  try {
    if (!new RegExp(`^127\\.0\\.0\\.1:${port}$`).test(req.headers.host || ''))
      return reply(res, 403, { error: '127.0.0.1 주소로 접속해 주세요.' });
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (
      req.method !== 'GET' &&
      (req.headers['x-studio-token'] !== token ||
        (req.headers.origin && req.headers.origin !== url.origin))
    )
      fail('이 작업실에서 보낸 요청만 허용됩니다.', 403);
    if (url.pathname === '/api/config')
      return reply(res, 200, { token, app: 'career-studio-public' });
    if (url.pathname === '/api/companies' || url.pathname.startsWith('/api/companies/')) {
      if (req.headers['x-studio-token'] !== token)
        fail('이 작업실에서 보낸 요청만 허용됩니다.', 403);
      if (url.pathname === '/api/companies') {
        if (req.method === 'GET') return reply(res, 200, await companies.list());
        if (req.method === 'POST') return reply(res, 201, await companies.create(await body(req)));
      }
      const match = url.pathname.match(
        /^\/api\/companies\/([^/]+)(?:\/(materials|snapshot)(?:\/([^/]+))?)?$/,
      );
      if (!match) fail('지원하지 않는 자료 요청입니다.', 404);
      const [, companyId, action, materialId] = match;
      if (req.method === 'GET' && !action) return reply(res, 200, await companies.read(companyId));
      if (req.method === 'GET' && action === 'materials' && materialId) {
        const { material, text } = await companies.material(companyId, materialId);
        return reply(res, 200, { material, text });
      }
      if (req.method === 'POST' && action === 'materials' && !materialId)
        return reply(res, 201, await companies.add(companyId, await body(req)));
      if (req.method === 'POST' && action === 'snapshot' && !materialId) {
        const input = await body(req),
          state = await load(await getDoc(input.docId));
        if (state.revision !== input.revision)
          fail('문서가 변경됐습니다. 저장한 뒤 다시 보관해 주세요.', 409);
        return reply(
          res,
          201,
          await companies.add(companyId, {
            // eslint-disable-next-line no-control-regex -- Strip control characters from filenames.
            name: state.doc.name.replace(/[/\\\x00-\x1f]/g, '_').slice(0, 150) + '.html',
            category: input.category,
            base64: Buffer.from(state.html).toString('base64'),
          }),
        );
      }
      fail('허용하지 않는 자료 요청입니다.', 405);
    }
    if (url.pathname.startsWith('/api/ai/')) {
      if (req.headers['x-studio-token'] !== token)
        fail('이 작업실에서 보낸 요청만 허용됩니다.', 403);
      if (req.method === 'POST') {
        const input = await body(req);
        if (url.pathname === '/api/ai/connect') return reply(res, 200, await ai.connect());
        if (url.pathname === '/api/ai/request')
          return reply(
            res,
            202,
            await locked('ai-request-' + input.docId, () => ai.request(input)),
          );
        if (url.pathname === '/api/ai/cancel') return reply(res, 200, ai.cancel(input.id));
        if (url.pathname === '/api/ai/decide') return reply(res, 200, await ai.decide(input));
      }
      if (req.method === 'GET' && url.pathname === '/api/ai/history')
        return reply(res, 200, await ai.history(url.searchParams.get('docId')));
      if (req.method === 'GET' && url.pathname === '/api/ai/job')
        return reply(res, 200, ai.job(url.searchParams.get('id')));
      fail('지원하지 않는 AI 요청입니다.', 404);
    }
    if (url.pathname === '/api/documents' && req.method === 'GET')
      return reply(res, 200, await catalog());
    if (url.pathname === '/api/documents' && req.method === 'POST') {
      const input = await body(req);
      const result = await locked('catalog', async () => {
        const id = 'custom--' + randomUUID();
        const doc = {
          id,
          name: String(input.name || '새 문서').slice(0, 80),
          kind: 'custom',
          format: 'custom',
          custom: true,
          documentFormat: input.copyId ? 'copy' : input.documentFormat || 'blank',
        };
        if (input.companyId) {
          await companies.read(input.companyId);
          doc.companyId = input.companyId;
        }
        let html;
        if (input.copyId) html = (await load(await getDoc(input.copyId))).html;
        else html = newDocumentHtml(input.documentFormat || 'blank');
        if (input.copyId) {
          const base = (await load(await getDoc(input.copyId))).base;
          html = html.replace(/(?:href|src)="(?![a-z]+:|\/|#|data:)([^"]+)"/gi, (m, rel) =>
            m.replace(rel, new URL(rel, `http://127.0.0.1:${port}${base}`).pathname),
          );
        }
        await atomic(sourcePath(doc), html);
        const custom = await jsonFile(path.join(data, 'custom.json'), []);
        await atomic(path.join(data, 'custom.json'), JSON.stringify([...custom, doc]));
        return doc;
      });
      return reply(res, 201, result);
    }
    const match = url.pathname.match(
      /^\/api\/documents\/([^/]+)(?:\/(save|export|apply|restore|company))?$/,
    );
    if (match) {
      const doc = await getDoc(decodeURIComponent(match[1]));
      if (!match[2] && req.method === 'GET') return reply(res, 200, await load(doc));
      if (req.method !== 'POST') fail('허용하지 않는 요청입니다.', 405);
      const input = await body(req);
      if (match[2] === 'company')
        return reply(
          res,
          200,
          await locked('catalog', async () => {
            const custom = await jsonFile(path.join(data, 'custom.json'), []),
              entry = custom.find((d) => d.id === doc.id);
            if (!entry) fail('기본 양식은 사본을 만들어 회사 폴더에 넣어 주세요.');
            if (input.expectedCompanyId !== (entry.companyId || null))
              fail('다른 창에서 문서의 회사가 바뀌었습니다. 문서를 다시 열어 주세요.', 409);
            if (input.companyId !== null && typeof input.companyId !== 'string')
              fail('회사 폴더를 선택해 주세요.');
            if (input.companyId) await companies.read(input.companyId);
            if (input.companyId) entry.companyId = input.companyId;
            else delete entry.companyId;
            await atomic(path.join(data, 'custom.json'), JSON.stringify(custom));
            return entry;
          }),
        );
      if (match[2] === 'save') return reply(res, 200, await locked(doc.id, () => save(doc, input)));
      if (match[2] === 'restore')
        return reply(
          res,
          200,
          await locked(doc.id, async () => {
            const draft = await jsonFile(draftPath(doc.id), null);
            if (
              !draft ||
              !Number.isInteger(input.target) ||
              input.target < 0 ||
              input.target > draft.revision
            )
              fail('복원할 기록이 없습니다.');
            let html = draft.base;
            for (const change of draft.history.filter((h) => h.revision <= input.target)) {
              html = applyPatch(html, change.patch);
              if (html === false) fail('변경 기록을 복원하지 못했습니다.', 500);
            }
            return save(doc, {
              html,
              revision: input.revision,
              reason: `저장 #${input.target} 복원`,
            });
          }),
        );
      if (match[2] === 'apply')
        return reply(
          res,
          200,
          await locked(doc.id, async () => {
            const draft = await jsonFile(draftPath(doc.id), null);
            if (!draft || draft.revision !== input.revision)
              fail('먼저 최신 내용을 저장해 주세요.', 409);
            const prior = await fs.readFile(sourcePath(doc), 'utf8');
            if (hash(prior) !== input.sourceHash)
              fail(
                '원본이 외부에서 수정됐습니다. 덮어쓰지 않았습니다. 문서를 다시 열어 확인해 주세요.',
                409,
              );
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const record = `# ${doc.name} 원본 반영\n\n- 날짜: ${stamp}\n- 원본: ${doc.source || doc.id}\n- 이전 SHA256: ${hash(prior)}\n- 이후 SHA256: ${hash(draft.html)}\n- 복구: 아래 diff를 역방향 적용하면 이전 원본을 복구할 수 있습니다.\n\n\`\`\`diff\n${createTwoFilesPatch('before.html', 'after.html', prior, draft.html)}\n\`\`\`\n`;
            await atomic(path.join(data, 'history', `${stamp}-${doc.id}.md`), record);
            await atomic(sourcePath(doc), draft.html);
            return { sourceHash: hash(draft.html) };
          }),
        );
      if (match[2] === 'export') {
        const state = await load(doc);
        if (input.revision !== state.revision) fail('먼저 최신 내용을 저장해 주세요.', 409);
        const renderId = randomUUID();
        renders.set(renderId, printHtml(state.html, state.base));
        browser ||= await chromium.launch();
        const context = await browser.newContext();
        try {
          await context.route('**/*', (route) => {
            const u = route.request().url();
            return u.startsWith(`http://127.0.0.1:${port}/`) || u.startsWith('data:')
              ? route.continue()
              : route.abort();
          });
          const page = await context.newPage();
          await page.goto(`http://127.0.0.1:${port}/render/${renderId}`, {
            waitUntil: 'networkidle',
          });
          await page
            .locator('[data-excluded="true"]')
            .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
          await page.locator('.page').evaluateAll((nodes) => {
            const last = nodes.at(-1);
            if (last) {
              last.style.breakAfter = 'auto';
              last.style.pageBreakAfter = 'auto';
            }
          });
          // eslint-disable-next-line no-undef -- Runs in Chromium, not in Node.
          await page.evaluate(() => document.fonts.ready);
          const broken = await page
            .locator('img')
            .evaluateAll((imgs) =>
              imgs
                .filter(
                  (i) => !i.closest('[data-excluded="true"]') && (!i.complete || !i.naturalWidth),
                )
                .map((i) => i.getAttribute('src')),
            );
          if (broken.length) fail('이미지 경로를 찾을 수 없습니다: ' + broken.join(', '));
          const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          });
          await atomic(path.join(outputs, doc.id + '.pdf'), pdf);
          return reply(res, 200, {
            url: '/exports/' + doc.id + '.pdf',
            path: 'exports/' + doc.id + '.pdf',
          });
        } finally {
          await context.close();
          renders.delete(renderId);
        }
      }
    }
    if (url.pathname.startsWith('/render/')) {
      const html = renders.get(url.pathname.split('/').pop());
      if (!html) fail('출력 세션이 만료되었습니다.', 404);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': frameCSP,
      });
      return res.end(html);
    }
    if (url.pathname.startsWith('/exports/')) {
      const id = path.basename(url.pathname, '.pdf');
      await getDoc(id);
      return await sendFile(res, path.join(outputs, id + '.pdf'), {
        'Content-Disposition': `attachment; filename="${id}.pdf"`,
      });
    }
    if (url.pathname.startsWith('/source/')) fail('외부 문서 폴더를 제공하지 않습니다.', 403);
    if (url.pathname.startsWith('/excalidraw-assets/')) {
      const rel = decodeURIComponent(url.pathname.slice('/excalidraw-assets/'.length));
      const assets = path.join(here, 'node_modules/@excalidraw/excalidraw/dist/prod');
      if (!['.woff2', '.woff', '.ttf'].includes(path.extname(rel)))
        fail('글꼴 리소스만 제공할 수 있습니다.', 403);
      const file = await containedFile(assets, rel);
      return await sendFile(res, file);
    }
    const dist = path.join(here, 'dist');
    const file = await containedFile(
      dist,
      '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
    );
    return await sendFile(res, file, {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'",
    });
  } catch (e) {
    reply(res, e.status || (e.code === 'ENOENT' ? 404 : 500), {
      error: e.status
        ? e.message
        : e.code === 'ENOENT'
          ? '파일을 찾을 수 없습니다. npm run build를 실행했는지 확인해 주세요.'
          : '로컬 작업을 완료하지 못했습니다. 저장 공간과 실행 환경을 확인해 주세요.',
    });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`문서 작업실 http://127.0.0.1:${port}`));
async function close() {
  ai.close();
  await browser?.close();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
