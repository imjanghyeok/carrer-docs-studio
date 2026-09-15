# Third-party components

사용 중인 버전·라이선스·원본 고지 링크와 다이어그램 글꼴 목록은 [README의 Credits](../README.md#credits)에 모았습니다. 이 문서는 설치물의 확인 위치와 빌드 변경 사항을 설명합니다.

| 구성요소 | 사용하는 기능 | 확인할 라이선스/고지 위치 |
| --- | --- | --- |
| React / React DOM | UI 컴포넌트·렌더링 | 설치된 react 및 react-dom 패키지의 LICENSE |
| Vite | 개발·프로덕션 번들 | 설치된 vite 패키지의 LICENSE |
| Excalidraw | 도형·화살표·텍스트 캔버스, SVG와 scene | [0.18.1 원본 LICENSE](https://github.com/excalidraw/excalidraw/blob/v0.18.1/LICENSE) 및 README의 글꼴별 고지. 설치한 npm 패키지 루트에는 LICENSE 파일이 없어 원본 태그를 참조합니다. |
| diff | 텍스트 패치 생성과 복원 | 설치된 diff 패키지의 LICENSE |
| parse5 | HTML 파싱과 원문 위치 | 설치된 parse5 패키지의 LICENSE |
| Playwright / Chromium | 브라우저 자동화와 PDF 인쇄 | Playwright LICENSE/NOTICE 및 Chromium 배포 고지 |
| Codex CLI | 인증된 모델 요청과 App Server 프로토콜 | 사용자가 설치한 CLI의 라이선스·사용 조건 |

배포 코드는 패키지 관리자가 의존성을 설치하도록 하며 node_modules나 Chromium 바이너리를 저장소에 복사하지 않습니다. 번들·설치 파일·글꼴을 별도로 재배포할 때는 전이 의존성과 글꼴 고지를 포함해 다시 검토해야 합니다. 이 목록은 법적 라이선스 감사 결과를 대신하지 않습니다.

`vite.config.js`는 Excalidraw 0.18.1의 외부 글꼴 CDN fallback만 빌드 시 제거합니다. 원본 패키지 파일을 수정하지 않으며 버전 업데이트 때 변환 패턴과 오프라인 테스트를 재검토합니다.
