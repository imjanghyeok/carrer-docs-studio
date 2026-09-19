import { execFileSync } from 'node:child_process';
import { commitPattern } from './policy/rules.mjs';

const [baseRef, headRef = 'HEAD'] = process.argv.slice(2);
if (!baseRef) throw Error('사용법: npm run check:commits -- BASE [HEAD]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1000000 });
const resolve = (ref) => git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').trim();
const messages = git('log', '--format=%s', `${resolve(baseRef)}..${resolve(headRef)}`)
  .trim()
  .split('\n')
  .filter(Boolean);
if (!messages.length || messages.some((message) => !commitPattern.test(message)))
  throw Error('커밋 제목을 type(scope): 요약 형식으로 작성하세요.');
console.log(`PASS: ${messages.length} commit titles`);
