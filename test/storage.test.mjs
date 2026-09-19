import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createQueue } from '../server/storage/queue.mjs';
import { createDocumentStore } from '../server/storage/documents.mjs';

test('document queue preserves ordering and recovers after a rejected operation', async () => {
  const locked = createQueue();
  const events = [];
  const first = locked('document', async () => {
    events.push('first');
    throw Error('synthetic');
  });
  const second = locked('document', async () => events.push('second'));
  await assert.rejects(first, /synthetic/);
  await second;
  assert.deepEqual(events, ['first', 'second']);
});

test('file store preserves original HTML, revisions and conflict detection', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-store-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const data = path.join(root, 'data');
  const templates = path.join(root, 'templates');
  await fs.mkdir(templates);
  const html = '<html><body><p>Synthetic original</p></body></html>';
  const doc = { id: 'sample', name: 'Synthetic', template: 'sample.html' };
  await fs.writeFile(path.join(templates, 'sample.html'), html);
  await fs.writeFile(path.join(templates, 'catalog.json'), JSON.stringify([doc]));
  const store = createDocumentStore({ data, templates });
  assert.equal((await store.load(doc)).html, html);
  const edited = html.replace('original', 'edited');
  const saved = await store.save(doc, { html: edited, revision: 0 });
  assert.equal(saved.revision, 1);
  assert.equal(saved.html, edited);
  assert.equal(await fs.readFile(store.sourcePath(doc), 'utf8'), html);
  await assert.rejects(store.save(doc, { html, revision: 0 }), { status: 409 });
  assert.equal((await store.save(doc, { html: edited, revision: 1 })).revision, 1);
});
