# 무료 도구 기반 검증과 리뷰

개인 구독·유료 API·유료 PR 봇을 전제로 하지 않습니다. 필수 검증은 코드 규칙과 테스트이며,
로컬 LLM 리뷰는 선택적인 참고 의견입니다. 모델의 지적 없음은 안전성 증명이 아닙니다.

## 비용 없이 실행하는 필수 검사

`npm run check`는 공개 파일 검사, Prettier, ESLint, SonarJS 일부 규칙, 빌드와 가상 자료
테스트를 실행합니다. 설치 후 이 검사들은 AI 계정 없이 실행됩니다.

SonarJS는 SonarSource의 JavaScript/TypeScript 정적 분석 규칙입니다. 중복 조건·동일 표현식·
컬렉션 크기 비교·빈 반환값 오용은 오류, 인지 복잡도 20 초과는 검토용 경고로 분리합니다.
모든 SonarQube 기능이나 보안 취약점 탐지가 제공되는 것은 아닙니다.
현재 복잡도 경고를 숨기거나 전부 해결됐다고 주장하지 않습니다.

## PR과 커밋 규칙

- 이슈와 PR 제목: `[도메인] 변경 요약`. 예: `[편집기] 자동 저장 책임 분리`.
- PR 본문에는 같은 저장소의 열린 이슈를 `Closes #번호` 한 줄로 정확히 하나 연결합니다.
- 커밋 제목: `type(scope): 요약`. 예: `refactor(editor): 자동 저장 책임 분리`.
- type: feat, fix, refactor, style, test, docs, chore, build, ci, perf, revert.
- scope는 소문자 영문·숫자·하이픈입니다. editor/편집기, templates/템플릿, ai/AI,
  storage/저장·복구, tooling/개발 운영처럼 대응합니다. 새로운 영역도 추가 가능합니다.
- 커밋 본문에서는 `Refs #번호`를 사용합니다. style은 소스 포맷 변경이며 UI 버그 수정과 다릅니다.
- 한 이슈당 열린 구현 PR 하나가 원칙입니다. 폐기 PR은 닫고 교체 이유를 남깁니다.
- 기존 main 커밋 기록은 재작성하지 않습니다.

PR policy 워크플로는 제목·종료 링크·기본 브랜치·이슈 상태·중복 열린 PR·커밋 제목을
검사합니다. 입력은 셸에 삽입하지 않으며 GitHub 읽기 권한만 사용합니다. PR 변경 시
최신 이벤트인지 확인하고 실패하면 다시 실행해야 합니다.

선행 PR 위에 쌓인 draft는 검토용이며, 병합 전에 기본 브랜치로 변경하고 검사를 통과해야
합니다. 이슈는 기본 브랜치 병합 시 종료됩니다. PR 생성/폐기만으로 완료하지 않습니다.

### 저장소 설정과 한계

워크플로 파일만으로 main이 보호되지는 않습니다. 저장소 소유자가 ruleset에서 PR 경유,
`Check / check`, `PR policy / policy` 필수 상태와 최신 브랜치 기준을 설정해야 합니다.
개인 프로젝트이므로 타인의 승인 수를 필수로 두지 않습니다. bypass 권한은 최소화하고
사용했다면 이유와 후속 검증을 남깁니다. 현재 활성화 여부는 PR의 실제 확인 결과를 따릅니다.

다른 PR·이슈 상태만 바뀌면 기존 성공 상태가 자동으로 무효화되지는 않습니다. 병합 직전
정책을 재실행해야 합니다. 동시 병합 경쟁까지 완전히 차단하는 시스템은 아닙니다.
워크플로를 수정할 수 있는 작성자의 우회도 CI 자체만으로 막을 수 없으므로 설정 변경은
diff를 직접 검토합니다. squash 시 최종 커밋 제목은 PR 제목이 아닌 `type(scope): 요약`으로
확인합니다. 다른 병합 전략의 자동 생성 메시지는 이 규칙의 예외를 검토 후 기록합니다.

## 선택: 로컬 LLM 리뷰

Ollama는 별도 설치하고 라이선스와 기기 자원을 확인한 로컬 GGUF 모델을 준비합니다.
서버는 `OLLAMA_NO_CLOUD=1`로 실행하고 루프백 주소에만 바인딩하세요. 네트워크를 차단한
환경에서 실행하면 원격 추론을 막는 추가 경계가 됩니다. 이 저장소는 모델을 다운로드하거나
Ollama 설정을 변경하지 않습니다. 장비·전력·저장 공간 비용은 별개입니다.

```sh
npm run review:local -- origin/main HEAD
npm run review:local -- origin/main HEAD LOCAL_MODEL_NAME --send
```

첫 명령은 전송하지 않고 커밋 SHA와 포함/제외 파일을 보여줍니다. diff를 검토한 뒤 실제
설치한 모델 이름과 `--send`를 명시합니다. 기본 주소는 `127.0.0.1:11434`로 고정하며
인증값·클라우드 모델·원격 모델 메타데이터·리다이렉트를 허용하지 않습니다.

기준 커밋의 PUBLIC_FILES에 등록된 기존 텍스트 코드 변경만 최대 20KB 읽습니다. 신규 파일,
테스트, 템플릿과 비코드 파일은 제외 목록에 표시하므로 별도로 검토해야 합니다.
작업 디렉토리나 개인 문서는 읽지 않습니다. 비교할 커밋은 미리 검토한 공개 커밋만 선택합니다.
코드 안에 민감한 문자열이 실수로 커밋됐다면 공개 목록만으로 이를 탐지하지 못합니다.

모델은 diff를 데이터로 받고 셸·도구 호출·파일 수정 권한이 없습니다. 결과는 `.local/reviews`
아래 JSON으로 저장하며 SHA·입력 해시·모델·프롬프트 버전·실행 시간·포함/제외 범위와
성공/실패를 기록합니다. 새 커밋에는 다시 실행합니다. 실패를 지적 없음으로 바꾸지 않습니다.
출력은 비신뢰 텍스트이므로 제안의 파일/줄·발생 조건·근거를 직접 확인합니다. 파일명과
응답 형식을 검사해도 모델의 줄 번호나 주장이 실제로 맞다는 보장은 없습니다.

PR에는 관련 SHA, 지적 요약, 반영 여부와 이유, 후속 테스트만 검토 후 게시합니다.
자동 댓글·승인·수정·병합은 하지 않습니다. 개인 PC를 공개 PR self-hosted runner로 등록하지
않습니다. 테스트는 mock으로 프로토콜과 실패 처리를 검증하며 실제 모델 품질을 증명하지 않습니다.

## 선택: SonarQube Cloud OSS

`.github/workflows/sonar.yml`과 `sonar-project.properties`는 SonarQube Cloud 연결용입니다.
로컬 SonarJS 검사와 달리 별도 프로젝트 등록·권한 승인이 필요합니다. 활성화 전에는 job이
skipped이며 분석 통과를 의미하지 않습니다.

소유자가 공개 프로젝트에 무료 OSS 플랜 적용 여부를 확인한 뒤:

1. EU SonarQube Cloud에 공개 프로젝트를 등록하고 CI 기반 분석을 선택합니다. 자동 분석과 중복 실행하지 않습니다.
2. 저장소 변수 SONAR_PROJECT_KEY, SONAR_ORGANIZATION, SONAR_OSS_CONFIRMED=true를 설정합니다.
3. 필요한 권한만 가진 SONAR_TOKEN을 GitHub secret에 보관합니다. 채팅·코드에 붙이지 않습니다.
4. SONAR_ENABLED=true를 설정하고 main push 또는 main의 수동 워크플로로 최초 분석을 확인합니다.

토큰은 main 분석에만 사용하며 비신뢰 PR 코드에 제공하지 않습니다. 최초 스캔 후 실제
Quality Gate 상태를 확인합니다. 현재 구성은 PR별 분석/장식이 아니라 main 분석입니다.
외부 서비스 가입·권한 부여·과금 플랜 선택은 자동으로 수행하지 않습니다.
로컬 Community Build는 자체 서버 운영이 필요하고 PR 분석 지원 범위가 다르므로 혼동하지 않습니다.

## 공식 참고

- [SonarJS](https://github.com/SonarSource/SonarJS)
- [SonarQube Cloud 플랜](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans)
- [SonarQube GitHub Actions](https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/ci-based-analysis/github-actions-for-sonarcloud)
- [Ollama 로컬/클라우드 설정](https://docs.ollama.com/faq)
- [Ollama Chat API](https://docs.ollama.com/api/chat)
