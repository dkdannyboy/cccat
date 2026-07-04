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
// node 경로를 실행 시점에 해석하는 런처.
// 설치 시점의 절대경로를 하드코딩하면 brew upgrade node 등으로 경로가 사라졌을 때
// 모든 hook이 조용히 실패하므로, PATH의 node를 우선 사용하고 설치 시 경로는 폴백으로만 쓴다.
function launcherPath() {
  return path.join(paths.home(), 'run.sh');
}
function makeLauncher() {
  return `#!/bin/sh
# cccat 런처 — node를 실행 시점에 찾는다 (PATH 우선, 설치 시 경로 폴백)
NODE="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE" ] || ! [ -x "$NODE" ]; then NODE="${nodeBin()}"; fi
[ -x "$NODE" ] || exit 0
exec "$NODE" "${cliPath()}" "$@"
`;
}
function hookCommand(event) {
  return `"${launcherPath()}" hook ${event}`;
}
function wrapperPath() {
  return path.join(paths.home(), 'statusline.sh');
}
function manifestPath() {
  return path.join(paths.home(), 'install-manifest.json');
}

// 가장 최근 백업 settings에서 statusLine을 꺼낸다 (manifest 소실 시 복구용).
// 백업이 없거나 백업의 statusLine도 cccat wrapper면 null.
function latestBackupStatusLine() {
  try {
    const files = fs.readdirSync(paths.backupDir())
      .filter((f) => f.startsWith('settings-') && f.endsWith('.json'))
      .sort()
      .reverse();
    for (const f of files) {
      const s = readJson(path.join(paths.backupDir(), f), null);
      if (!s) continue;
      const cmd = s.statusLine && String(s.statusLine.command || '');
      if (cmd && !cmd.includes(MARKER)) return s.statusLine;
      if (!s.statusLine) return null; // 설치 전에도 없었음
    }
  } catch { /* 백업 디렉터리 없음 */ }
  return null;
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
${prevBlock}"${launcherPath()}" statusline < "$tmp" 2>/dev/null
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
  //    현재 statusLine이 cccat wrapper가 아니면 — 사용자가 그 사이에 바꾼 것이므로 —
  //    "현재" 값을 보존한다. cccat wrapper 그대로일 때만 manifest의 원본을 이어받는다.
  //    (과거 스냅샷으로 사용자의 최신 설정을 덮어쓰는 사고 방지)
  let prevStatusLine;
  const curCmd = settings.statusLine && String(settings.statusLine.command || '');
  if (curCmd && curCmd.includes(MARKER) && already && 'prev_statusline' in already) {
    prevStatusLine = already.prev_statusline;
  } else {
    prevStatusLine = settings.statusLine || null;
  }
  const prevCommand = prevStatusLine && prevStatusLine.type === 'command' ? prevStatusLine.command : null;
  fs.writeFileSync(launcherPath(), makeLauncher());
  fs.chmodSync(launcherPath(), 0o755);
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

  // 1) statusline 복원. manifest가 없으면(소실) 최신 백업에서 복구를 시도한다 —
  //    사용자의 원래 statusline을 실수로 지우지 않기 위해.
  if (settings.statusLine && String(settings.statusLine.command || '').includes(MARKER)) {
    let prev = manifest ? manifest.prev_statusline : undefined;
    if (prev === undefined) {
      prev = latestBackupStatusLine();
      if (prev) log.push('statusline: manifest 소실 — 백업에서 원본 복구');
    }
    if (prev) {
      settings.statusLine = prev;
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

  // 3) wrapper/launcher 및 manifest 제거
  try { fs.unlinkSync(wrapperPath()); } catch { /* 없음 */ }
  try { fs.unlinkSync(launcherPath()); } catch { /* 없음 */ }
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
  if (manifest && manifest.node && !fs.existsSync(manifest.node)) {
    out.push(`경고: 설치 당시 node 경로(${manifest.node})가 사라졌습니다. PATH의 node로 폴백하지만, 문제가 있으면 cccat install 로 재설치하세요.`);
  }
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

module.exports = { install, uninstall, doctor, HOOK_EVENTS, wrapperPath, launcherPath, manifestPath, makeWrapper, makeLauncher, isCccatHook, latestBackupStatusLine };
