#!/bin/zsh
cd "${0:A:h}" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print 'Node.js 22 이상을 설치한 뒤 다시 실행하세요.'
  read '?Enter를 누르면 닫습니다.'
  exit 1
fi
node start.mjs
if [[ $? -ne 0 ]]; then
  read '?오류 내용을 확인한 뒤 Enter를 누르면 닫습니다.'
fi
