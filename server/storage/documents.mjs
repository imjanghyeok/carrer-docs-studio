import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createTwoFilesPatch } from 'diff';
import { containedFile } from '../../lib/paths.mjs';
import { atomic, jsonFile } from './files.mjs';
import { fail } from '../shared/errors.mjs';

export const hash = (value) => createHash('sha256').update(value).digest('hex');

/** File-backed documents. Mutations must run inside the shared document queue. */
export function createDocumentStore({ data, templates }) {
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
    if (
      typeof html !== 'string' ||
      !/<body[\s>]/i.test(html) ||
      Buffer.byteLength(html) > 12_000_000
    )
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

  return { catalog, getDoc, sourcePath, draftPath, load, save };
}
