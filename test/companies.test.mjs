import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CompanyStore } from '../lib/company-store.mjs';
import { AIService } from '../ai-service.mjs';

async function setup() {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'career-materials-'));
  const queues = new Map();
  const locked = (key, fn) => {
    const p = (queues.get(key) || Promise.resolve()).catch(() => {}).then(fn);
    queues.set(key, p);
    return p;
  };
  const atomic = async (file, content) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };
  return { data, atomic, locked, store: new CompanyStore({ data, atomic, locked }) };
}
const file = (name, text, category = 'resume') => ({
  name,
  base64: Buffer.from(text).toString('base64'),
  category,
});

test('company originals, text extraction, duplicate handling, validation and reload', async () => {
  const { data, store, atomic, locked } = await setup();
  const company = await store.create({ name: '샘플 회사 A', role: '백엔드 개발' });
  const original =
    '<html><head><title>private title</title><script>hidden command</script></head><body><h1>Sample resume</h1><p>Team of four</p><a href="https://example.com/pull/1">PR evidence</a><p data-excluded="true">excluded</p><script>hidden script</script><style>hidden css</style></body></html>';
  const { material } = await store.add(company.id, file('resume.html', original));
  const stored = await store.material(company.id, material.id);
  assert.match(stored.text, /Sample resume/);
  assert.doesNotMatch(stored.text, /private|hidden|excluded/);
  assert.match(stored.text, /https:\/\/example.com\/pull\/1/);
  assert.equal(
    await fs.readFile(path.join(data, 'applications', company.id, material.file), 'utf8'),
    original,
  );
  assert.equal((await store.add(company.id, file('resume.html', original))).duplicate, true);
  const second = new CompanyStore({ data, atomic, locked });
  assert.equal((await second.list())[0].count, 1);
  assert.equal((await second.read(company.id)).role, '백엔드 개발');
  for (const input of [
    file('../escape.md', 'bad'),
    file('payload.svg', 'bad'),
    file('bad.pdf', 'not PDF'),
    { ...file('bad.txt', 'bad'), base64: '**' },
    file('name.md', 'bad', '../../'),
    file('null.txt', '\0binary'),
    { ...file('link.md', 'body'), sourceUrl: 'javascript:alert(1)' },
    { ...file('big.md', 'body'), base64: 'A'.repeat(11_000_001) },
  ])
    await assert.rejects(store.add(company.id, input));
  await assert.rejects(store.read('../escape'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'career-outside-'));
  await fs.symlink(outside, path.join(data, 'applications', company.id, 'other'));
  await assert.rejects(
    store.add(company.id, file('escape.md', 'bad', 'other')),
    (e) => e.status === 403,
  );
});

test('AI sends exactly checked company materials, no editor HTML or other-context history; ask only', async () => {
  const { data, store, atomic, locked } = await setup();
  const a = await store.create({ name: '샘플 회사 A' }),
    b = await store.create({ name: '샘플 회사 B' });
  const one = (await store.add(a.id, file('posting.md', 'Backend job requirements', 'posting')))
    .material;
  const two = (await store.add(a.id, file('resume.md', 'Experience A'))).material;
  const hidden = (await store.add(a.id, file('unchecked.md', 'UNCHECKED SECRET'))).material;
  const foreign = (await store.add(b.id, file('other-company.md', 'OTHER COMPANY SECRET')))
    .material;
  const prompts = [];
  const bridge = {
    status: async () => ({ loggedIn: true, models: [{ id: 'mock', efforts: ['low'] }] }),
    run: async ({ prompt }) => {
      prompts.push(JSON.parse(prompt));
      return {
        message: 'Checked references only',
        edits: [{ before: 'visible', after: 'changed', reason: 'should be discarded' }],
      };
    },
    close() {},
  };
  const service = new AIService({
    data,
    atomic,
    locked,
    bridge,
    materials: store,
    getDoc: async () => ({ id: 'sample' }),
    load: async () => ({ html: '<html><body>EDITOR SECRET</body></html>', revision: 0 }),
    save: async () => {
      throw Error('must not save');
    },
  });
  const input = {
    docId: 'sample',
    revision: 0,
    prompt: 'Critical review',
    scope: 'materials',
    mode: 'ask',
    model: 'mock',
    effort: 'low',
    consent: true,
    includeHistory: true,
    references: { companyId: a.id, materialIds: [one.id, two.id] },
  };
  async function run(next = input) {
    const { id } = await service.request(next);
    for (let n = 0; n < 100; n++) {
      if (service.job(id).status !== 'running') break;
      await new Promise((r) => setTimeout(r, 5));
    }
    assert.equal(service.job(id).status, 'completed');
    await new Promise((r) => setTimeout(r, 0));
  }
  try {
    await service.connect();
    await service.append('sample', { role: 'user', text: 'OLD DOCUMENT SECRET' });
    await assert.rejects(service.request({ ...input, consent: false }), /전송/);
    await assert.rejects(service.request({ ...input, mode: 'edit' }), /질문만/);
    await assert.rejects(
      service.request({ ...input, references: { companyId: a.id, materialIds: [foreign.id] } }),
      /찾을 수/,
    );
    await assert.rejects(
      service.request({ ...input, references: { companyId: a.id, materialIds: [one.id, one.id] } }),
      /서로 다른/,
    );
    await run();
    const p = prompts.at(-1);
    assert.equal(p.editableHtml, '');
    assert.deepEqual(
      p.references.materials.map((m) => m.id),
      [one.id, two.id],
    );
    assert.deepEqual(p.previousConversation, []);
    assert.doesNotMatch(JSON.stringify(p), /SECRET/);
    let last = (await service.history('sample')).items.at(-1);
    assert.deepEqual(last.edits, []);
    assert.equal(last.references.companyName, a.name);
    await run();
    assert.equal(prompts.at(-1).previousConversation.length, 2);
    await run({ ...input, references: { companyId: a.id, materialIds: [one.id] } });
    assert.deepEqual(prompts.at(-1).previousConversation, []);
    assert.ok(hidden.id);
    await assert.rejects(
      service.decide({ docId: 'sample', messageId: last.id, action: 'apply', revision: 0 }),
      /수정안이 없습니다/,
    );
  } finally {
    service.close();
  }
});
