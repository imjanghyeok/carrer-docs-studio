# 코드 구조

개발 운영 파일은 `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/check.yml`에 있습니다. [개발 기록](DEVELOPMENT.md), [검증 안내](VALIDATION.md), `docs/decisions/`, `docs/cases/`에서 구현과 검증 근거를 연결합니다.

```text
career-studio/
├── src/
│   ├── main.jsx             # 문서 목록, 저장, 선택 상태, 기능 연결
│   ├── document.js          # iframe DOM 편집·직렬화·undo/redo
│   ├── blocks.js            # 블록 유형·목록·Enter 분할과 임시 보기 CSS
│   ├── BlockTools.jsx       # 블록 추가·변환·순서·삭제 메뉴
│   ├── blocks.css           # 모드 전환과 블록 도구 UI
│   ├── charts.js            # HTML 그래프 데이터 읽기·검증·반영
│   ├── ChartEditor.jsx      # 수치/활동 기간 그래프 편집 폼
│   ├── Diagram.jsx          # Excalidraw와 SVG/scene 연결
│   ├── AIChat.jsx           # 채팅·모델 선택·수정 전후 검토
│   ├── CompanyFolders.jsx   # 회사별 편집 문서 분류·사본 진입
│   ├── SelectionTools.jsx   # 박스/텍스트 선택·삭제 확인창
│   ├── organization.css     # 회사 폴더·선택 도구·좁은 화면 설정
│   ├── CompanyLibrary.jsx   # 회사별 자료 선택·가져오기·추출 결과 확인
│   ├── review-prompt.js     # 사실과 근거에 기반한 채용 검토 프롬프트
│   ├── companies.css        # 회사 자료 창·전송 자료 목록
│   ├── style.css            # 기본 화면·편집 패널
│   └── ai.css               # 채팅·수정안 검토 창
├── server.mjs               # HTTP 라우트·문서 저장·패치·PDF
├── ai-service.mjs           # AI 요청·범위·검증·승인·기록
├── codex-bridge.mjs         # Codex App Server JSONL 어댑터
├── lib/paths.mjs            # 외부 데이터 경로·리소스 경로 격리
├── lib/company-store.mjs    # 회사 자료 보관·검증·텍스트 추출·AI 참조
├── lib/new-document.mjs     # 빈 A4·블록형·2열 새 문서 생성
├── templates/               # 배포 가능한 빈 HTML 11종과 목록
├── public/config.js         # Excalidraw 로컬 글꼴 경로
├── start.mjs                # 의존성·빌드·서버·브라우저 실행
├── Start.command            # macOS 실행 진입점
├── vite.config.js           # 빌드와 Excalidraw CDN fallback 제거
├── test/                    # 가상 데이터 기반 단위·브라우저 검증
├── scripts/check-public.mjs # 공개 파일 허용 목록·민감 패턴 검사
├── PUBLIC_FILES.json        # 공개할 파일의 명시적 목록
├── docs/                    # 아키텍처, 코드 구조, 사용법, 외부 구성요소
└── SECURITY.md              # 데이터·전송·보안 경계
```

## 수정할 기능별 출발점

| 작업 | 먼저 읽을 파일 |
| --- | --- |
| 글자·박스 편집 | `src/document.js`, `src/main.jsx` |
| 블록 모드·새 문서 형식 | `src/blocks.js`, `src/BlockTools.jsx`, `lib/new-document.mjs`, `test/blocks-ui.mjs` |
| 회사별 문서·선택·삭제 | `src/CompanyFolders.jsx`, `src/SelectionTools.jsx`, `test/organization-ui.mjs` |
| 저장·복원·출력 | `server.mjs`, `lib/paths.mjs`, `test/ui.mjs` |
| 채팅 화면 | `src/AIChat.jsx`, `src/ai.css` |
| 회사별 자료·피드백 프리셋 | `src/CompanyLibrary.jsx`, `src/review-prompt.js`, `lib/company-store.mjs`, `test/companies.test.mjs`, `test/companies-ui.mjs` |
| AI 전송 범위·승인 정책 | `ai-service.mjs`, `test/ai.test.mjs` |
| Codex 프로토콜 변경 | `codex-bridge.mjs`, `test/mock-codex.mjs` |
| 템플릿 추가 | `templates/catalog.json`, 새 독립 HTML, `PUBLIC_FILES.json` |

`server.mjs`가 HTTP 라우트·저장·PDF 출력을 조정하고, 문서 DOM 편집과 AI 요청 처리는 별도 모듈에서 담당합니다.
