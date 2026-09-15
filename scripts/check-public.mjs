import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowed = new Set(
  JSON.parse(await fs.readFile(path.join(root, 'PUBLIC_FILES.json'), 'utf8')),
);
const skipped = new Set(['.git', 'node_modules', 'dist', '.test-data', 'coverage', '.local']);
const errors = [],
  files = [];
async function walk(dir, relative = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (skipped.has(entry.name) && !relative) continue;
    const name = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isSymbolicLink()) {
      errors.push(name + ': symlink not allowed');
      continue;
    }
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), name);
    else files.push(name);
  }
}
await walk(root);
for (const name of files) if (!allowed.has(name)) errors.push(name + ': not in public allowlist');
for (const name of allowed) if (!files.includes(name)) errors.push(name + ': missing public file');
const denyTerms = (process.env.PUBLIC_DENY_TERMS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const user = os.userInfo().username;
if (user.length >= 5 && !['runner', 'codespace', 'root', 'user'].includes(user))
  denyTerms.push(user);
for (const name of files.filter((f) => allowed.has(f))) {
  const bytes = await fs.readFile(path.join(root, name));
  if (bytes.includes(0)) {
    errors.push(name + ': binary content not allowed');
    continue;
  }
  const text = bytes.toString('utf8');
  if (/(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[a-zA-Z0-9_.-]+/.test(text))
    errors.push(name + ': machine-specific home path');
  if (
    /\bsk-[A-Za-z0-9_-]{24,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{25,}/.test(
      text,
    )
  )
    errors.push(name + ': possible credential');
  for (const email of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
    if (!/@(?:example\.(?:com|org|net)|localhost\.test)$/i.test(email))
      errors.push(name + ': non-example email');
  if (denyTerms.some((term) => text.toLowerCase().includes(term.toLowerCase())))
    errors.push(name + ': private identity term');
}
// Even ignored files are unsafe if they have been force-added to the Git index.
try {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\0')
    .filter(Boolean);
  for (const name of tracked)
    if (!allowed.has(name)) errors.push(name + ': tracked outside public allowlist');
} catch {
  /* A Git repository is optional until the owner chooses to initialize it. */
}
if (errors.length) {
  console.error(
    'Public review FAILED. File/reason only; matching secrets are not printed.\n' +
      [...new Set(errors)].join('\n'),
  );
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${files.length} allowlisted text files; no configured identity, credential or private path matches. Manual content/history review is still required.`,
  );
