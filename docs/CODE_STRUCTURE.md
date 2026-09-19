# 코드 구조

## 실행 진입점

- `src/main.jsx`: React mount만 담당.
- `src/app/App.jsx`: 문서 전환·선택·AI 적용·기능 연결과 모달 상태 조정.
- `server.mjs`: 데이터 경로·토큰·공유 큐·서비스 구성, HTTP 시작과 종료.
- `start.mjs`: 로컬 설치·빌드·실행 안내.

## 디렉토리별 책임

```text
src/
  app/                     App, DocumentSidebar, EditorToolbar, Inspector
  features/
    documents/             표시 이름과 useDocumentSession 저장 큐
    editor/                document 엔진, blocks 명령, 선택·블록 도구
    charts/                그래프 데이터 검증과 편집 폼
    diagrams/              외부 다이어그램 엔진 어댑터
    ai/                    AIChat, 피드백 프롬프트와 스타일
    companies/             회사 폴더·참고자료 UI와 스타일
  shared/                  API 클라이언트, Icon, NumberField, 색 변환
  styles/                  작업실 전체 화면 스타일
server/
  http/                    router 요청 분기, responses 입력/응답/CSP
  storage/                 documents 원문·초안, files 원자적 교체, queue
  pdf/                     exporter Chromium·출력 세션·PDF
  shared/                  오류 계약
lib/                       회사 자료 저장, 안전한 경로, 새 문서 생성
ai-service.mjs             AI 범위·승인·충돌 검사
codex-bridge.mjs           외부 CLI 프로토콜
test/                      가상 자료 단위·브라우저 테스트
templates/                 배포용 빈 HTML (사용자 자료가 아님)
```

화면 조립은 기능 모듈을 사용하며 기능은 공통 코드에 의존합니다. shared에서 app을
참조하지 않습니다. 서버 라우터는 구성 시 받은 저장소·AI·PDF 서비스를 사용하고,
저장소와 PDF 모듈은 React에 의존하지 않습니다.

## 실제 수정 경로

| 수정할 것 | 진입과 호출 흐름 | 확인할 테스트 |
| --- | --- | --- |
| 글자·블록 편집 | editor/document.js 명령 → changed → documents/useDocumentSession.js changed/flush → API save → storage/documents.mjs save | ui.mjs, blocks-ui.mjs, storage.test.mjs |
| 문서 전환 | app/App.jsx open → flush → API load → DocumentEditor 재연결 | organization-ui.mjs, ui.mjs |
| AI 제안 적용 | ai/AIChat.jsx → App applyAI → ai-service.mjs decide → 저장소 save | ai.test.mjs, ai-ui.mjs |
| PDF 내보내기 | App exportPDF → router export → pdf/exporter.mjs exportDocument → Chromium | ui.mjs, blocks-ui.mjs |
| 도구 배치 | app/EditorToolbar.jsx, styles/workspace.css | organization-ui.mjs와 화면 확인 |
| 블록 설정 | app/Inspector.jsx → selectedAction → DocumentEditor | ui.mjs |
| 회사 자료 | companies/CompanyLibrary.jsx → router → lib/company-store.mjs | companies.test.mjs, companies-ui.mjs |
| 새 템플릿 | templates/catalog.json, 빈 HTML, PUBLIC_FILES.json | ui.mjs |

## 상태를 읽는 순서

1. App의 current는 화면 문서, DocumentEditor는 실제 iframe DOM을 소유합니다.
2. useDocumentSession의 state는 서버 문서 버전, dirty는 아직 저장되지 않은 편집입니다.
3. flush는 저장을 직렬화하고 완료 시 문서 ID와 편집 변경 여부를 확인합니다.
4. UI 패널은 상태를 전달받아 보여주고 콜백을 호출합니다. 패널 안에 별도 문서 원본을 두지 않습니다.
5. 백엔드의 문서별 queue는 한 프로세스에서만 유효합니다. 파일 교체는 전체 트랜잭션을 뜻하지 않습니다.

## 작은 수정을 시작하는 방법

예를 들어 확대 도구를 수정하려면 EditorToolbar의 버튼과 workspace.css부터 읽고
연결된 setZoom 콜백을 App에서 확인합니다. 수정 후 `npm run format`, `npm run lint`,
`npm run check`를 실행하고 좁은 화면을 직접 확인합니다. 실제 문서를 테스트에 쓰지 않습니다.

App에 남아 있는 모달·기능 간 조정과 라우터의 복원·원본 반영 조정은 현재 구조의 한계입니다.
[설계 선택과 남은 경계](decisions/0002-readable-module-boundaries.md)를 함께 읽으세요.
