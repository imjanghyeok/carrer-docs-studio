# Career Studio

**로컬에서 작성하고, AI와 다듬고, PDF로 완성하는 이력서·포트폴리오 편집기.**

Career Studio는 HTML을 원문으로 사용하는 문서 작업실입니다. 문장 하나부터 박스 배치, 그래프, 다이어그램까지 화면에서 직접 고칠 수 있습니다. AI의 도움이 필요할 때는 범위를 선택해 수정안을 요청하고, 변경 내용을 확인한 뒤 반영합니다.

[시작하기](#시작하기) · [사용 가이드](docs/USAGE.md) · [아키텍처](docs/ARCHITECTURE.md) · [코드 구조](docs/CODE_STRUCTURE.md) · [보안](SECURITY.md)

## 주요 기능

- **직접 편집** — 텍스트·줄바꿈·부분 서식, 블록 크기·정렬·색·여백·열 구성
- **두 가지 편집 모드** — 글과 순서를 다루는 블록 모드, A4 지면을 조절하는 레이아웃 모드
- **새 문서 형식** — 빈 A4, 소개·프로젝트·활동 블록형, 소개와 프로젝트를 나눈 2열 문서
- **세밀한 선택과 삭제** — 박스/글자 선택 전환, 내부 텍스트 목록, 삭제 확인과 실행 취소
- **회사별 편집 문서** — 양식·기존 문서를 회사 폴더에 복사, 이력을 유지한 폴더 변경
- **출력 구성** — 체크박스로 문단·박스·페이지를 포함하거나 제외
- **그래프와 다이어그램** — 수치 그래프를 만들고, 도형·화살표·텍스트를 배치해 다이어그램 편집
- **검토하는 AI 편집** — Codex 모델·추론 강도·요청 범위 선택, 수정 전후 비교 및 승인
- **회사별 지원 자료** — 공고·이력서·포트폴리오 파일/폴더 가져오기, 공고 붙여넣기, 현재 문서 사본 보관
- **냉정한 피드백** — 선택한 자료와 채용 요건을 대조하는 검토 프롬프트, 전송 전 확인
- **복구 가능한 저장** — 자동 저장, 실행 취소·다시 실행, HTML 변경 패치와 버전 복원
- **PDF 내보내기** — 로컬 Chromium으로 출력하고 문서별 최신 PDF 유지

빈 HTML 양식 11종(이력서 4·포트폴리오 3·자기소개서 3·통합 소개서 1)이 함께 제공됩니다. 실제 개인정보나 예시 실적은 포함하지 않습니다. 새 문서를 만들거나 사본을 만들어 용도별로 편집할 수도 있습니다.

## 시작하기

Node.js **22.13 이상**이 필요합니다. 프로젝트를 내려받은 뒤 해당 폴더에서 실행하세요.

```sh
npm ci
npx playwright install chromium
npm run build
npm start
```

브라우저에서 [127.0.0.1:4318](http://127.0.0.1:4318)을 엽니다. 종료하려면 서버를 실행한 터미널에서 Control + C를 누릅니다.

macOS에서는 `Start.command`를 더블클릭하거나 `node start.mjs`로 설치·빌드·브라우저 열기를 진행할 수 있습니다. 의존성이 변경된 버전으로 업데이트한 뒤에는 `npm ci`를 다시 실행하세요.

> 최초 설치에는 인터넷이 필요합니다. 이후 직접 편집과 PDF 출력은 오프라인으로 동작합니다. AI 요청은 선택한 내용을 외부 AI 제공자에 전송하므로 네트워크와 본인의 Codex 인증이 필요합니다.

## 문서 만들기

1. 템플릿을 선택하거나 **새 문서**를 만듭니다.
2. 글자를 클릭해 수정하고, 오른쪽 **블록 설정**에서 서식과 레이아웃을 조정합니다.
3. 필요한 그래프·다이어그램을 넣고, 체크박스로 출력할 내용을 고릅니다.
4. **PDF 내보내기**로 문서를 완성합니다.

수정 내용은 자동 저장됩니다. `⌘S`로 즉시 저장하고, `⌘Z` / `⌘⇧Z`로 실행 취소·다시 실행합니다. Windows/Linux에서는 Ctrl을 사용합니다. 세부 조작과 백업 방법은 [사용 가이드](docs/USAGE.md)를 참고하세요.

**블록 모드**에서는 본문·제목·목록·인용문·구분선을 추가하고, 텍스트 블록의 형식·순서를 바꿀 수 있습니다. 빈 블록에서 `/`를 입력하면 형식 메뉴가 열립니다. **레이아웃 모드**에서는 기존처럼 크기·여백·색·그래프·다이어그램을 조절합니다. 두 모드는 같은 HTML을 편집하며, 블록 화면의 간소화된 배치는 저장하거나 PDF로 출력하지 않습니다. PDF는 원래 A4 지면을 사용합니다.

## Codex와 함께 편집하기

자신의 컴퓨터에 설치된 Codex CLI에서 `codex login`을 완료한 뒤, 오른쪽 **Codex 채팅 → Codex 연결**을 누릅니다.

모델과 추론 강도를 고르고 **선택 블록 / 선택 페이지 / 문서 전체** 중 요청 범위를 지정하세요. 문서에 대한 질문만 하거나 수정안을 받을 수 있습니다.

AI 수정은 **검토 후 적용**을 눌러야 반영됩니다. 요청 이후 직접 고친 내용이 있으면 이전 수정안의 적용을 막아 덮어쓰기를 방지합니다. 연결할 때는 문서 본문을 보내지 않으며, 전송 동의 후 요청할 때 선택한 내용과 요청문을 보냅니다. 최근 대화 옵션을 켜면 해당 문서의 최근 메시지도 포함됩니다.

AI 사용에는 각자의 CLI 인증 방식에 따른 사용 한도 또는 요금이 적용됩니다. 인증값은 채팅에 입력하지 마세요. [데이터 처리와 보안 경계](SECURITY.md)를 확인할 수 있습니다.

## 회사별 자료로 피드백 받기

1. 왼쪽 **회사별 자료**에서 회사와 지원 직무를 추가합니다.
2. 회사 하나의 폴더 또는 파일을 선택하고, 공고·이력서·포트폴리오 등 종류를 확인한 뒤 보관합니다. 공고는 붙여넣기도 가능합니다.
3. 사용할 자료만 체크하고 **냉정한 피드백**을 누릅니다.
4. 채팅에서 준비된 프롬프트와 자료 목록을 확인하고, 모델 선택·전송 동의 후 **보내기**를 누릅니다.

TXT·Markdown·HTML·텍스트 PDF를 지원합니다. PDF 텍스트 추출에는 Poppler의 `pdftotext`가 필요합니다. 원래 파일은 그대로 두고 개인 데이터 폴더에 복사합니다. 피드백에는 선택한 자료의 텍스트만 사용하며, 현재 편집 문서는 별도로 보관·선택하지 않으면 포함하지 않습니다. 가져오기는 참고자료 보관 기능으로, PDF 지면을 편집 가능한 문서로 변환하지 않습니다. 자세한 제한과 폴더 구조는 [사용 가이드](docs/USAGE.md#회사별-자료와-피드백)를 참고하세요.

## Local-first

문서·변경 이력·대화·PDF는 기본적으로 **소스 저장소 밖의 개인 데이터 폴더**에 저장됩니다. 배포 템플릿은 개인 기준본으로 복사되므로 문서를 편집해도 저장소의 템플릿은 바뀌지 않습니다.

| 설정 | 기본값 |
| --- | --- |
| 서버 주소 | `127.0.0.1:4318` |
| 포트 변경 | `PORT` 환경 변수 |
| 저장 위치 변경 | `STUDIO_DATA` 환경 변수 |
| 별도 CLI 실행 파일 | `STUDIO_CODEX_BIN` 환경 변수 |

운영체제별 저장 위치와 폴더 구성은 [사용 가이드](docs/USAGE.md#저장소와-내-자료는-분리됩니다)에 정리되어 있습니다. 개인 컴퓨터의 단일 사용자 환경을 기준으로 실행하고, 외부에 서버를 노출하지 마세요.

## 기술 스택

| 영역 | 구성 |
| --- | --- |
| UI | React · JavaScript/JSX · CSS |
| 문서 편집 | HTML/CSS · DOM · sandbox iframe |
| 로컬 서버 | Node.js · HTTP · 파일 시스템 |
| 그래프·다이어그램 | HTML 표와 CSS · Excalidraw |
| 변경 이력·범위 분석 | diff · parse5 |
| AI 연결 | Codex CLI App Server · JSONL |
| PDF·브라우저 테스트 | Playwright · Chromium |
| 빌드 | Vite |

의존성 버전은 [package.json](package.json)과 lockfile에 고정합니다. 설계의 중심은 HTML 원문 유지, 로컬 데이터 분리, 검토 가능한 AI 수정, 변경 이력 복원입니다. 자세한 흐름은 [아키텍처](docs/ARCHITECTURE.md)와 [코드 구조](docs/CODE_STRUCTURE.md)를 참고하세요.

## 개발 및 테스트

수정 전에 [코드 작성 기준](docs/CODING_CONVENTIONS.md)을 확인하세요.

PR·커밋 규칙, 무료 SonarJS 검사와 선택적 로컬 모델 리뷰는
[품질 검사와 리뷰](docs/QUALITY_AND_REVIEW.md)에 정리했습니다. SonarQube Cloud는
소유자의 무료 OSS 프로젝트 연결 후 활성화됩니다.

```sh
npm run build         # 프런트엔드 빌드
npm test              # 단위 테스트 + 편집기·AI 브라우저 테스트
npm run check:public  # 공개 대상 파일 및 민감 패턴 검사
npm run check         # 검사·빌드·테스트 전체 실행
```

테스트에는 Chromium과 Poppler의 `pdfinfo`, `pdftotext`, `pdftoppm`가 필요합니다. macOS는 `brew install poppler`, Ubuntu는 `sudo apt-get install poppler-utils`로 설치할 수 있습니다. 한국어 PDF에는 시스템 한국어 글꼴이 필요합니다.

테스트는 가상 문서·임시 저장 폴더·가짜 Codex 서버를 사용합니다. 실제 문서나 AI 계정을 사용하지 않습니다. 브라우저 테스트 포트는 4321·4322·4323·4324·4325이며, 결과 파일은 Git에서 제외된 `.test-data/`에 생성됩니다.

검증 환경은 macOS, Node.js 22, Chromium입니다. Codex 어댑터는 CLI 0.154.0 기준으로 작성되었습니다.

## 프로젝트 운영

구현을 살펴보려면 [AI 수정안 충돌 방지 사례](docs/cases/ai-proposal-conflicts.md), [설계 결정](docs/decisions/0001-ai-proposal-conflicts.md), [검증 방법](docs/VALIDATION.md)을 참고하세요. 이슈·PR 작성과 라벨 기준은 [개발 기록 안내](docs/DEVELOPMENT.md)에 정리했습니다.

개인적으로 사용하는 이력서·포트폴리오 편집 도구로, 필요한 기능을 중심으로 개선하고 소스를 공개합니다. 외부 기여자를 적극적으로 모집하지 않으며, 기능 요청이나 PR의 검토·응답을 보장하지 않습니다.

이슈는 발견한 버그와 개선할 작업을 기록하는 용도로 사용합니다.

버그를 제보할 때는 실행 환경, 재현 단계, 기대한 동작을 함께 남겨 주세요. 재현 문서는 가상 자료를 사용하고 실제 이력서·대화·인증값은 첨부하지 마세요.

코드를 변경할 때는 관련 테스트를 추가하고 `npm run check`로 확인합니다. 개인정보·보안 문제의 제보는 [SECURITY.md](SECURITY.md)를 먼저 확인하세요.

## Credits

Career Studio는 아래 오픈소스 프로젝트를 사용합니다. 다이어그램 편집은 Excalidraw 라이브러리를 통합한 기능이며, 해당 편집 엔진을 자체 개발한 것으로 표현하지 않습니다. 각 프로젝트의 저작권과 라이선스는 원 저작권자에게 있습니다.

### 직접 사용하는 라이브러리

버전은 현재 package.json과 lockfile 기준입니다. 라이선스 링크에서 원 저작권 표시와 허가 조건 전문을 확인할 수 있습니다.

| 구성요소 · 버전 | 사용처 | 라이선스 · 원본 고지 |
| --- | --- | --- |
| Excalidraw 0.18.1 | 도형·화살표·텍스트 편집, SVG 출력과 재편집 데이터 | [MIT · Excalidraw](https://github.com/excalidraw/excalidraw/blob/v0.18.1/LICENSE) |
| React / React DOM 18.3.1 | 화면 구성과 렌더링 | [MIT · Facebook, Inc. and its affiliates](https://github.com/facebook/react/blob/v18.3.1/LICENSE) |
| diff 8.0.3 | HTML 변경 패치와 복원 | [BSD-3-Clause · Kevin Decker](https://github.com/kpdecker/jsdiff/blob/v8.0.3/LICENSE) |
| parse5 7.3.0 | HTML 파싱과 수정 범위 분석 | [MIT · Ivan Nikulin](https://github.com/inikulin/parse5/blob/v7.3.0/LICENSE) |
| Playwright 1.60.0 | PDF 출력과 브라우저 테스트 | [Apache-2.0](https://github.com/microsoft/playwright/blob/v1.60.0/LICENSE) · [Microsoft Corporation 및 파생 코드 고지](https://github.com/microsoft/playwright/blob/v1.60.0/NOTICE) |
| Vite 6.4.3 | 프런트엔드 빌드 | [MIT 및 포함 구성요소 고지](https://github.com/vitejs/vite/blob/v6.4.3/packages/vite/LICENSE.md) |

### 별도로 설치하는 실행 도구

개발 검사에는 ESLint·@eslint/js·Prettier·globals(MIT)와
[eslint-plugin-sonarjs](https://github.com/SonarSource/SonarJS)(LGPL-3.0-only)를 사용합니다.
이들은 개발 의존성이며 브라우저 앱에 번들링하지 않습니다. 개발 도구를 재배포할 때는
각 패키지의 LICENSE와 해당 조건을 유지해야 합니다. SonarQube Cloud 서비스 이용 조건은
패키지 라이선스와 별개입니다.

아래 도구의 실행 파일은 이 저장소에 포함하지 않습니다. 설치된 버전과 배포물의 라이선스·고지를 따릅니다.

| 구성요소 | 사용처 | 라이선스 · 원본 안내 |
| --- | --- | --- |
| Node.js | 로컬 서버 실행 | [MIT 및 포함 구성요소별 고지](https://github.com/nodejs/node/blob/main/LICENSE) |
| Chromium | HTML을 PDF로 출력 | [BSD 계열 라이선스](https://github.com/chromium/chromium/blob/main/LICENSE) 및 브라우저에 포함된 개별 구성요소 고지 |
| Codex CLI | 사용자 계정으로 AI 요청 | [Apache-2.0](https://github.com/openai/codex/blob/main/LICENSE). CLI 코드의 라이선스와 AI 서비스의 이용 조건·요금은 별개입니다. |
| Poppler 도구 | PDF 텍스트 추출 및 출력 테스트 | [GPL v2 고지](https://gitlab.freedesktop.org/poppler/poppler/-/blob/master/COPYING)와 설치 배포물의 개별 파일 조건. 이 앱에서는 별도 프로세스로 실행합니다. |

### 다이어그램 글꼴

Excalidraw 0.18.1 패키지의 글꼴 디렉터리를 기준으로 정리했습니다. 글꼴은 Excalidraw 코드의 MIT와 별도로 아래 라이선스를 사용합니다. 표시·선택된 글꼴에 따라 실제로 로드되는 파일은 달라집니다.

| 글꼴 | 라이선스 · 원본 고지 |
| --- | --- |
| Assistant | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/assistant/OFL.txt) |
| Cascadia Code | [SIL OFL 1.1](https://github.com/microsoft/cascadia-code/blob/main/LICENSE) |
| Comic Shanns | [MIT · 패키지에 포함된 서브셋의 저작권·라이선스](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/fonts/ComicShanns/index.ts) |
| Excalifont | [SIL OFL 1.1 · 패키지 내 고지](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/fonts/Excalifont/index.ts) |
| Liberation Sans | [SIL OFL 1.1](https://github.com/liberationfonts/liberation-fonts/blob/main/LICENSE) |
| Lilita One | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/lilitaone/OFL.txt) |
| Nunito | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/nunito/OFL.txt) |
| Virgil | [SIL OFL 1.1](https://github.com/excalidraw/virgil/blob/main/LICENSE.md) |
| Xiaolai | [SIL OFL 1.1 · 패키지 내 고지](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/fonts/Xiaolai/index.ts) |

문서 CSS가 참조하는 시스템 글꼴은 사용자 기기의 글꼴이며 저장소에 포함하지 않습니다. 글꼴 파일을 별도 제공하거나 PDF·SVG에 포함해 배포할 때는 해당 글꼴의 임베딩·재배포 조건도 확인하세요.

### 사용과 재배포 시 확인할 사항

- 오픈소스라고 조건 없이 사용할 수 있는 것은 아닙니다. MIT·BSD·Apache·OFL 등 각 라이선스의 저작권 표시, 허가문, 면책문과 해당하는 NOTICE·변경 고지를 유지해야 합니다.
- 이 README의 표와 링크는 출처 안내입니다. 코드·번들·실행 파일·글꼴을 재배포할 때 필요한 라이선스 전문과 고지를 대신하지 않습니다.
- 현재 저장소는 소스와 의존성 목록을 제공하며 node_modules, 빌드 결과물, 브라우저 바이너리, 글꼴 파일은 커밋하지 않습니다. 완성된 번들이나 설치 파일을 배포할 때는 실제 포함된 구성요소의 고지를 함께 제공해야 합니다.
- 위 표는 직접 의존성과 별도 도구·다이어그램 글꼴 목록입니다. 전이 의존성 전체를 나열한 표는 아닙니다. 정확한 패키지 목록은 [package-lock.json](package-lock.json), 조건 전문은 각 패키지의 LICENSE·NOTICE·ThirdPartyNotices를 확인하세요. lockfile의 라이선스 메타데이터만으로 전체 준수 여부를 판단하지 않습니다.
- 프로젝트 MIT는 외부 구성요소의 라이선스를 대체하지 않습니다. 이 프로젝트가 사용하는 이름은 출처 식별을 위한 것이며 원 프로젝트의 공식 제품이나 보증을 의미하지 않습니다.

빌드 시 변경 사항과 고지 확인 위치는 [외부 구성요소 안내](docs/THIRD_PARTY.md)에 정리되어 있습니다.

## License

[MIT License](LICENSE). 외부 구성요소의 라이선스는 각각의 배포 고지를 따릅니다.
