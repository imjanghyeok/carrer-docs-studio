# 검증 방법과 범위

## 2026-09-15 로컬 실행 기록

- 대상: 기준 커밋 `95052e159f113182af978d43b7d3483725626902` 위의 미커밋 작업 트리. 운영 템플릿·문서·CI 설정과 기존 README·외부 고지·다이어그램 표시 수정 포함.
- 환경: macOS 15.7.7, Node.js 22.14.0, Playwright 1.60.0, Chromium 148.0.7778.96.
- 실행: 코딩 에이전트가 `npm run check` 실행, 종료 코드 0.
- 결과: 단위 테스트 7개와 브라우저 스위트 5개 통과. AI 제안 승인·충돌 보호, 자료 격리, 편집·복원·PDF, 블록 모드, 회사 폴더·선택 기능 확인.
- 추가 검사: YAML 문법과 로컬 Markdown 파일 링크 대상 확인.
- 한계: GitHub Actions 및 Ubuntu에서 실행한 결과가 아닙니다. 실제 AI 계정·응답 품질·사용 시간 절감은 검사하지 않았습니다. 빌드에는 외부 패키지의 use client 지시문 무시 경고가 있었으며 빌드는 성공했습니다.

이 기록은 위 날짜의 작업 트리 검사입니다. 이후 변경까지 검증된 것으로 해석하지 마세요.

## 재현

Node.js 22 이상, Chromium, Poppler, 한국어 글꼴이 필요합니다. 설치는 [README](../README.md#개발-및-테스트)를 따릅니다.

```sh
npm ci
npx playwright install chromium
npm run check
```

테스트는 가상 입력과 새 임시 데이터 폴더를 사용합니다. 실제 문서나 AI 계정을 사용하지 않습니다. 4321~4325 포트를 비워 두고 실행합니다.

| 검사 | 근거 | 확인 범위 |
| --- | --- | --- |
| AI 단위 검사 | [ai.test.mjs](../test/ai.test.mjs) | 선택 범위, 위험한 수정안, 동의, 승인, 충돌, 취소 |
| 경로·공개 검사 | [paths](../test/paths.test.mjs), [public](../test/public.test.mjs) | 데이터 경계, 강제 추가한 비공개 파일 차단 |
| 자료 검사 | [companies](../test/companies.test.mjs), [UI](../test/companies-ui.mjs) | 회사 간 분리, 선택 자료, 추출·전송 경계 |
| 편집·PDF | [ui.mjs](../test/ui.mjs) | 빈 양식 출력, 편집·재접속, 그래프·다이어그램, 복원 |
| AI UI | [ai-ui.mjs](../test/ai-ui.mjs) | 승인 전 불변, 승인·undo, 오래된 제안 차단 |
| 블록 모드 | [blocks-ui.mjs](../test/blocks-ui.mjs) | 블록 조작과 모드별 출력 비교 |
| 회사 폴더·선택 | [organization-ui.mjs](../test/organization-ui.mjs) | 문서 분류·사본·삭제·선택 보호 |

## 결과를 남길 때

대상 커밋과 미커밋 변경 유무, 날짜, OS·Node·브라우저 버전, 명령, 결과, 미확인 범위를 기록합니다. CI 실행 링크만 남기지 말고 관련 테스트 코드도 연결합니다.

.test-data의 화면·PDF는 재현 과정에서 생성되는 로컬 산출물이며 Git에서 제외합니다.
자동 검사는 시각적 완성도, 모든 운영체제 호환성, 실서비스 모델 품질, 모든 HTML 보안을 보장하지 않습니다.
mock 테스트는 앱의 연결·검토·적용 절차를 확인하며 실제 AI 응답 품질을 측정하지 않습니다.
