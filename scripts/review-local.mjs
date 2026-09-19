import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { reviewDiff, maxDiffBytes, promptVersion } from './review/local-model.mjs';

const args = process.argv.slice(2);
if (args.length < 2 || args.some((arg) => arg.startsWith('--') && arg !== '--send')) {
  console.error('사용법: npm run review:local -- BASE HEAD [LOCAL_MODEL] [--send]');
  process.exit(2);
}
const git = (...arguments_) =>
  execFileSync('git', arguments_, { encoding: 'utf8', maxBuffer: 1000000 });
const resolve = (ref) => git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').trim();
const base = resolve(args[0]);
const head = resolve(args[1]);
const allowed = new Set(JSON.parse(git('show', `${base}:PUBLIC_FILES.json`)));
const paths = git('diff', '--name-only', '-z', base, head, '--').split('\0').filter(Boolean);
const files = paths.filter(
  (file) =>
    allowed.has(file) &&
    /\.(?:js|jsx|mjs|css)$/.test(file) &&
    !file.startsWith('test/') &&
    !file.startsWith('templates/') &&
    git('ls-tree', head, '--', file).startsWith('100644 blob '),
);
const excluded = paths.filter((file) => !files.includes(file));
if (!files.length)
  throw Error('검토할 기존 공개 소스 변경이 없습니다. 신규 파일은 별도 수동 검토하세요.');
const diff = git(
  'diff',
  '--no-ext-diff',
  '--no-textconv',
  '--unified=3',
  base,
  head,
  '--',
  ...files,
);
if (Buffer.byteLength(diff) > maxDiffBytes)
  throw Error('변경이 20KB를 초과합니다. 검토 단위를 나누세요.');
const inputHash = createHash('sha256').update(diff).digest('hex');
const report = {
  base,
  head,
  inputHash,
  promptVersion,
  files,
  excluded,
  createdAt: new Date().toISOString(),
  status: 'prepared',
};
console.log(JSON.stringify(report, null, 2));
if (args.includes('--send')) {
  const started = Date.now();
  try {
    Object.assign(report, await reviewDiff({ model: args[2], diff, files }), {
      status: 'completed',
    });
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    process.exitCode = 1;
  }
  report.durationMs = Date.now() - started;
  const directory = path.resolve('.local/reviews');
  await fs.mkdir(directory, { recursive: true });
  const output = path.join(directory, `${head}-${inputHash.slice(0, 12)}-${Date.now()}.json`);
  await fs.writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`리뷰 ${report.status}: ${path.relative(process.cwd(), output)}`);
} else {
  console.log('미전송: 공개 diff를 확인한 뒤 로컬 모델 이름과 --send를 명시하세요.');
}
