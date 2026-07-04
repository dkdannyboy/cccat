#!/bin/sh
# cccat 원라인 설치 스크립트
#   curl -fsSL https://raw.githubusercontent.com/dkdannyboy/cccat/main/scripts/install.sh | sh
# 하는 일: ~/.cccat/app 에 저장소를 클론(또는 갱신)하고 `node bin/cccat.js install` 실행.
# 기존 Claude Code 설정은 설치 전에 자동 백업됩니다 (~/.cccat/backup/).
set -e

REPO="https://github.com/dkdannyboy/cccat.git"
APP_DIR="${CCCAT_APP_DIR:-$HOME/.cccat/app}"

if ! command -v node >/dev/null 2>&1; then
  echo "오류: Node.js(>=18)가 필요합니다. https://nodejs.org 에서 설치 후 다시 실행해주세요." >&2
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "오류: git이 필요합니다." >&2
  exit 1
fi

if [ -d "$APP_DIR/.git" ]; then
  echo "• 기존 설치 갱신 중: $APP_DIR"
  git -C "$APP_DIR" pull --ff-only
else
  echo "• 다운로드 중: $REPO → $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --depth 1 "$REPO" "$APP_DIR"
fi

node "$APP_DIR/bin/cccat.js" install
echo
echo "제거하려면: node $APP_DIR/bin/cccat.js uninstall"
