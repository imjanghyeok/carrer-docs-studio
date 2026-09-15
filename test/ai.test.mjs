import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeOf, replaceSafely, AIService } from '../ai-service.mjs';
import { CodexBridge } from '../codex-bridge.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const html =
  '<!doctype html><html><head><style>p { color: red; }</style></head><body><section class="page" data-studio-id="p"><h1 data-studio-id="h">테스트 전</h1><p data-studio-id="b">별도 내용</p></section></body></html>';
test('exact source scope, unchanged surrounding HTML and unsafe proposals', () => {
  const block = scopeOf(html, 'block', 'h');
  assert.equal(block.html, '<h1 data-studio-id="h">테스트 전</h1>');
  assert.match(scopeOf(html, 'page', 'h').html, /^<section/);
  assert.equal(
    replaceSafely(html, block, [{ before: '테스트 전', after: '테스트 후' }]),
    html.replace('테스트 전', '테스트 후'),
  );
  assert.throws(() => replaceSafely(html, block, [{ before: '별도 내용', after: '침범' }]), /위치/);
  for (const after of [
    '<script>alert(1)</script>',
    '<img src="https://example.com/x">',
    '<span onclick="alert(1)">x</span>',
    '<style>@import "https://example.com";</style>',
    '<svg><a href="javascript:alert(1)">x</a></svg>',
  ])
    assert.throws(() => replaceSafely(html, block, [{ before: '테스트 전', after }]), /차단/);
  assert.throws(
    () =>
      replaceSafely(html, block, [
        { before: '테스트 전', after: 'x' },
        { before: '테스트', after: 'y' },
      ]),
    /겹치/,
  );
  assert.throws(
    () => replaceSafely(html, scopeOf(html, 'document'), [{ before: '<', after: 'x' }]),
    /중복/,
  );
  assert.throws(() => scopeOf(html, 'page', 'missing'), /찾을 수/);
});
test('App Server model lookup, scoped request, explicit apply, conflict, history, cancellation', async () => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'career-ai-test-'));
  const bridge = new CodexBridge({
    command: process.execPath,
    args: [fileURLToPath(new URL('./mock-codex.mjs', import.meta.url))],
  });
  let state = { html, revision: 0 };
  const service = new AIService({
    data,
    bridge,
    getDoc: async (id) => {
      assert.equal(id, 'sample');
      return { id };
    },
    load: async () => ({ ...state }),
    save: async (d, next) => (state = { html: next.html, revision: state.revision + 1 }),
    locked: async (k, fn) => fn(),
    atomic: async (file, value) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, value);
    },
  });
  const wait = async (id) => {
    for (let i = 0; i < 100; i++) {
      const job = service.job(id);
      if (job.status !== 'running') return job;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error('timeout');
  };
  try {
    assert.equal((await service.connect()).models[0].id, 'test-model');
    const input = {
      docId: 'sample',
      consent: true,
      prompt: '샘플 수정',
      model: 'test-model',
      effort: 'medium',
      scope: 'block',
      selectedId: 'h',
      revision: 0,
    };
    await assert.rejects(service.request({ ...input, consent: false }), /전송/);
    const first = await service.request(input);
    assert.equal((await wait(first.id)).status, 'completed');
    assert.equal(state.html, html);
    let records = (await service.history('sample')).items;
    const proposal = records.find((r) => r.role === 'assistant');
    await service.decide({ docId: 'sample', messageId: proposal.id, revision: 0, action: 'apply' });
    assert.equal(state.html, html.replace('테스트 전', '테스트 후'));
    const second = await service.request({ ...input, revision: 1 });
    await wait(second.id);
    records = (await service.history('sample')).items;
    state = { html: state.html.replace('별도 내용', '직접 수정'), revision: 2 };
    await assert.rejects(
      service.decide({
        docId: 'sample',
        messageId: records.at(-1).id,
        revision: 2,
        action: 'apply',
      }),
      /변경됐습니다/,
    );
    assert.match(state.html, /직접 수정/);
    const slow = await service.request({ ...input, revision: 2, prompt: 'slow' });
    await new Promise((r) => setTimeout(r, 50));
    service.cancel(slow.id);
    assert.equal((await wait(slow.id)).status, 'cancelled');
    assert.ok((await fs.readFile(service.file('sample'), 'utf8')).includes('샘플 수정'));
  } finally {
    service.close();
  }
});
