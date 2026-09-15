export const titlePattern = /^\[[^[\]\r\n]{1,24}\] \S[^\r\n]*$/u;
export const commitPattern =
  /^(feat|fix|refactor|style|test|docs|chore|build|ci|perf|revert)\([a-z][a-z0-9-]*\): \S[^\r\n]*$/u;

/** Closing references are intentionally a single standalone line, not inferred from prose. */
export function closingIssue(body = '') {
  const commands =
    body.match(
      /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:#[0-9]+|[\w.-]+\/[\w.-]+#[0-9]+|https:\/\/github\.com\/\S+)/gi,
    ) || [];
  const lines = [...body.matchAll(/^Closes #([1-9][0-9]*)\s*$/gm)];
  if (commands.length !== 1 || lines.length !== 1)
    throw Error('PR 본문에 Closes #번호 한 줄을 정확히 하나 작성하세요.');
  return Number(lines[0][1]);
}

export function validatePolicy({
  title,
  body,
  base,
  defaultBranch,
  issue,
  commits = [],
  otherPulls = [],
}) {
  const errors = [];
  if (!titlePattern.test(title || '')) errors.push('제목은 [도메인] 변경 요약 형식입니다.');
  if (base !== defaultBranch)
    errors.push('선행 PR 병합 후 대상 브랜치를 기본 브랜치로 변경하세요.');
  let number;
  try {
    number = closingIssue(body);
  } catch (error) {
    errors.push(error.message);
  }
  if (number && (!issue || issue.number !== number || issue.pull_request || issue.state !== 'open'))
    errors.push('같은 저장소의 열린 이슈 하나를 연결하세요.');
  for (const message of commits) {
    if (!commitPattern.test(message.split('\n')[0]))
      errors.push('커밋 제목은 type(scope): 요약 형식입니다.');
    if (/\b(?:closes|fixes|resolves)\s+#\d+/i.test(message))
      errors.push('커밋에서는 Refs #번호를 사용하고 종료 키워드는 PR 본문에만 작성하세요.');
  }
  if (!commits.length) errors.push('검사할 커밋이 없습니다.');
  for (const pull of otherPulls) {
    const refs = [
      ...(pull.body || '').matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#([0-9]+)/gi),
    ];
    if (number && refs.some((match) => Number(match[1]) === number))
      errors.push(`같은 이슈를 종료하는 열린 PR #${pull.number}가 있습니다.`);
  }
  return [...new Set(errors)];
}
