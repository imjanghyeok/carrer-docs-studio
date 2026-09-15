import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defaultDataDirectory, containedFile } from '../lib/paths.mjs';

test('platform data defaults are separate from the checkout', () => {
  const home = path.join(os.tmpdir(), 'synthetic-home');
  assert.equal(
    defaultDataDirectory({}, 'darwin', home),
    path.join(home, 'Library', 'Application Support', 'Career Studio'),
  );
  assert.equal(
    defaultDataDirectory({}, 'linux', home),
    path.join(home, '.local', 'share', 'career-studio'),
  );
  assert.equal(
    defaultDataDirectory({}, 'win32', home),
    path.join(home, 'AppData', 'Local', 'Career Studio'),
  );
  assert.equal(defaultDataDirectory({ STUDIO_DATA: home }, 'linux', home), home);
});
test('asset resolution rejects traversal and symlink escapes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'career-path-test-'));
  const inside = path.join(dir, 'assets');
  await fs.mkdir(inside);
  await fs.writeFile(path.join(inside, 'ok.css'), 'body{}');
  await fs.writeFile(path.join(dir, 'private.txt'), 'synthetic-secret');
  assert.match(await containedFile(inside, 'ok.css'), /ok\.css$/);
  await assert.rejects(containedFile(inside, '../private.txt'), { status: 403 });
  await fs.symlink(path.join(dir, 'private.txt'), path.join(inside, 'escape.css'));
  await assert.rejects(containedFile(inside, 'escape.css'), { status: 403 });
});
