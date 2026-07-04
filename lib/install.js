'use strict';
// 설치/제거: ~/.claude/settings.json 을 백업 후 최소 수정.
// - statusline: 기존 명령을 보존하는 wrapper 셸 스크립트로 교체 (기존 출력 먼저, cccat 줄 추가)
// - hooks: cccat hook 항목 추가 (기존 hooks 는 절대 건드리지 않음)
// 제거 시 manifest 기반으로 원래 상태 복원.
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const { readJson, writeJson } = require('./store');

const HOOK_EVENTS = [
  'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'Stop', 'Notification', 'SubagentStart', 'SubagentStop', 'SessionStart', 'SessionEnd',
];
const MARKER = 'cccat'; // hook 명령 식별용

function nodeBin() {
  return process.execPath;
}
function cliPath() {
  return path.join(paths.repoRoot(), 'bin', 'cccat.js');
}
function hookCommand(event) {
  return `"${nodeBin()}" "${cliPath()}" hook ${event}`;
}
function wrapperPath() {
  return path.join(paths.home(), 'statusline.sh');
}
function manifestPath() {
  return path.join(paths.home(), 'install-manifest.json');
}

function isCccatHook(entry) {
  return (entry.hooks || []).some((h) => String(h.command || '').includes(MARKER));
}

function makeWrapper(prevCommand) {
  // 기존 statusline은 5초 캐시로 실행 빈도를 낮춘다.
  // (refreshInterval:1 때문에 매초 재실행되면 git status 등 무거운 기존 스크립트가
  //  상시 CPU를 소모하므로, 기존 줄은 최대 5초 지연을 허용하고 캐시한다)
  const prevBlock = prevCommand
    ? `# 기존 statusline (설치 전 설정 그대로, 5초 캐시)
cache="${paths.home().replace(/"/g, '\\"')}/prev-status.cache"
fresh=""
if [ -f "$cache" ]; then
  age=$(( $(date +%s) - $(stat -f %m "$cache" 2>/dev/null || stat -c %Y "$cache" 2>/dev/null || echo 0) ))
  [ "$age" -lt 5 ] && fresh=1
fi
if [ -z "$fresh" ]; then
  ${prevCommand} < "$tmp" > "$cache.new" 2>/dev/null && mv -f "$cache.new" "$cache" || : > "$cache"
fi
[ -s "$cache" ] && cat "$cache"
`
    : '';
  return `#!/bin/sh
# cccat statusline wrapper — 설치 시 자동 생성됨. cccat uninstall 로 원복됩니다.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
cat > "$tmp"
${prevBlock}"${nodeBin()}" "${cliPath()}" statusline < "$tmp" 2>/dev/null
exit 0
`;
}

function install(opts = {}) {
  paths.ensureHome();
  const settingsFile = paths.settingsFile();
  const settings = readJson(settingsFile, {});
  const log = [];

  // 이미 설치되어 있으면 재설치(멱등)
  const already = readJson(manifestPath(), null);

  // 1) 백업
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(paths.backupDir(), `settings-${ts}.json`);
  if (fs.existsSync(settingsFile)) {
    fs.copyFileSync(settingsFile, backupFile);
    log.push(`백업 생성: ${backupFile}`);
  }

  // 2) 기존 statusline 보존 + wrapper 생성
  //    재설치 시에는 manifest에 저장된 "원래" statusline을 계속 보존한다.
  let prevStatusLine;
  if (already && 'prev_statusline' in already) {
    prevStatusLine = already.prev_statusline;
  } else {
    prevStatusLine = settings.statusLine || null;
  }
  const prevCommand = prevStatusLine && prevStatusLine.type === 'command' ? prevStatusLine.command : null;
  fs.writeFileSync(wrapperPath(), makeWrapper(prevCommand));
  fs.chmodSync(wrapperPath(), 0o755);
  // refreshInterval: 이벤트가 없어도 1초마다 재실행 → 고양이 애니메이션 유지 (공식 옵션)
  settings.statusLine = { type: 'command', command: wrapperPath(), refreshInterval: 1 };
  log.push(prevCommand
    ? `statusline: 기존 명령 보존 + cccat 줄 추가 (${prevCommand})`
    : 'statusline: cccat 설정');

  // 3) hooks 추가 (기존 항목 유지, cccat 항목만 갱신)
  settings.hooks = settings.hooks || {};
  for (const event of HOOK_EVENTS) {
    const arr = (settings.hooks[event] || []).filter((e) => !isCccatHook(e));
    arr.push({ hooks: [{ type: 'command', command: hookCommand(event), timeout: 5 }] });
    settings.hooks[event] = arr;
  }
  log.push(`hooks: ${HOOK_EVENTS.length}개 이벤트 등록`);

  // 4) 저장
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');

  // 5) manifest
  writeJson(manifestPath(), {
    installed_at: new Date().toISOString(),
    version: require('../package.json').version,
    backup_file: fs.existsSync(backupFile) ? backupFile : null,
    prev_statusline: prevStatusLine,
    node: nodeBin(),
    cli: cliPath(),
  });
  log.push('설치 완료');
  return { ok: true, log };
}

function uninstall(opts = {}) {
  const settingsFile = paths.settingsFile();
  const settings = readJson(settingsFile, {});
  const manifest = readJson(manifestPath(), null);
  const log = [];

  // 1) statusline 복원
  if (settings.statusLine && String(settings.statusLine.command || '').includes(MARKER)) {
    if (manifest && manifest.prev_statusline) {
      settings.statusLine = manifest.prev_statusline;
      log.push('statusline: 기존 설정 복원');
    } else {
      delete settings.statusLine;
      log.push('statusline: 제거 (설치 전에 없었음)');
    }
  }

  // 2) cccat hooks 제거
  if (settings.hooks) {
    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = settings.hooks[event].filter((e) => !isCccatHook(e));
      if (!settings.hooks[event].length) delete settings.hooks[event];
    }
    if (!Object.keys(settings.hooks).length) delete settings.hooks;
    log.push('hooks: cccat 항목 제거');
  }

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');

  // 3) wrapper 및 manifest 제거
  try { fs.unlinkSync(wrapperPath()); } catch { /* 없음 */ }
  try { fs.unlinkSync(manifestPath()); } catch { /* 없음 */ }

  // 4) 데이터 처리
  if (opts.purge) {
    fs.rmSync(paths.home(), { recursive: true, force: true });
    log.push(`학습 데이터 삭제: ${paths.home()}`);
  } else {
    log.push(`학습 데이터 보존: ${paths.home()} (완전 삭제: cccat uninstall --purge)`);
  }
  log.push('제거 완료');
  return { ok: true, log };
}

function doctor() {
  const out = [];
  const settings = readJson(paths.settingsFile(), {});
  const manifest = readJson(manifestPath(), null);
  out.push(`settings: ${paths.settingsFile()}`);
  out.push(`데이터 디렉터리: ${paths.home()}`);
  out.push(`설치 상태: ${manifest ? `설치됨 (${manifest.installed_at}, v${manifest.version})` : '설치 안 됨'}`);
  const sl = settings.statusLine && String(settings.statusLine.command || '');
  out.push(`statusline: ${sl ? (sl.includes(MARKER) ? 'cccat wrapper 활성' : `다른 statusline 사용 중 (${sl})`) : '없음'}`);
  let hookCount = 0;
  for (const arr of Object.values(settings.hooks || {})) {
    hookCount += arr.filter(isCccatHook).length;
  }
  out.push(`cccat hooks: ${hookCount}개 등록됨`);
  try {
    const items = require('./content').loadAll();
    out.push(`콘텐츠: ${items.length}개 표현 로드됨`);
  } catch (e) {
    out.push(`콘텐츠 로드 실패: ${e.message}`);
  }
  // 현재 디렉터리의 프로젝트 설정이 statusLine을 정의하면 cccat이 가려진다
  for (const f of ['.claude/settings.json', '.claude/settings.local.json']) {
    const proj = readJson(path.join(process.cwd(), f), null);
    if (proj && proj.statusLine && !String(proj.statusLine.command || '').includes(MARKER)) {
      out.push(`경고: 이 프로젝트의 ${f} 이 자체 statusLine을 정의하고 있어 이 프로젝트에서는 cccat이 표시되지 않습니다.`);
    }
  }
  return out;
}

module.exports = { install, uninstall, doctor, HOOK_EVENTS, wrapperPath, manifestPath, makeWrapper, isCccatHook };
