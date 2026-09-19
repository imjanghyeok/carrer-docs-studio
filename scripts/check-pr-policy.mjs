import fs from 'node:fs/promises';
import { closingIssue, validatePolicy } from './policy/rules.mjs';

const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
const pull = event.pull_request;
if (!pull) throw Error('pull_request 이벤트가 필요합니다.');
const repository = process.env.GITHUB_REPOSITORY;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw Error('저장소 식별자가 올바르지 않습니다.');
async function api(route) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${route}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`GitHub API 검사 실패 (${response.status})`);
  return response.json();
}
async function pages(route) {
  const result = [];
  for (let page = 1; page <= 10; page++) {
    const rows = await api(`${route}${route.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    result.push(...rows);
    if (rows.length < 100) return result;
  }
  throw Error('검사 범위가 너무 큽니다. 작업을 나누세요.');
}
let number;
try {
  number = closingIssue(pull.body);
} catch {
  /* Detailed validation below. */
}
const [current, commits, otherPulls, issue] = await Promise.all([
  api(`pulls/${pull.number}`),
  pages(`pulls/${pull.number}/commits`),
  pages('pulls?state=open'),
  number ? api(`issues/${number}`) : undefined,
]);
if (
  current.head.sha !== pull.head.sha ||
  current.body !== pull.body ||
  current.title !== pull.title ||
  current.base.ref !== pull.base.ref
)
  throw Error('PR이 변경됐습니다. 최신 이벤트의 검사를 확인하세요.');
const errors = validatePolicy({
  title: current.title,
  body: current.body,
  base: current.base.ref,
  defaultBranch: event.repository.default_branch,
  issue,
  commits: commits.map((commit) => commit.commit.message),
  otherPulls: otherPulls.filter((other) => other.number !== pull.number),
});
if (errors.length) throw Error(errors.join('\n'));
console.log(`PASS: PR #${pull.number} → issue #${number}; ${commits.length} commits`);
