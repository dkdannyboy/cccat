'use strict';
// 프로젝트 단위 공존(adopt): 프로젝트가 자체 statusLine을 정의하면
// 사용자 레벨 cccat statusline이 가려진다. 이 경우 프로젝트의
// .claude/settings.local.json(프로젝트 settings.json보다 우선, git 미추적)에
// "프로젝트 원래 statusline + cccat 줄" wrapper를 설정해 공존시킨다.
// 프로젝트의 settings.json(팀 공유 파일)은 절대 건드리지 않는다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const paths = require('./paths');
const { readJson } = require('./store');
const installMod = require('./install');

const MARKER = 'cccat';

function projectKey(projectDir) {
  return crypto.createHash('sha1').update(path.resolve(projectDir)).digest('hex').slice(0, 12);
}
function projectHome(projectDir) {
  return path.join(paths.home(), 'projects', projectKey(projectDir));
}

// 프로젝트에서 실제로 적용될 statusLine (local > project)
function effectiveProjectStatusLine(projectDir) {
  const local = readJson(path.join(projectDir, '.claude', 'settings.local.json'), {});
  const proj = readJson(path.join(projectDir, '.claude', 'settings.json'), {});
  if ('statusLine' in local) return { source: 'local', value: local.statusLine };
  if ('statusLine' in proj) return { source: 'project', value: proj.statusLine };
  return { source: 'none', value: null };
}

function adopt(projectDir = process.cwd()) {
  const log = [];
  const localFile = path.join(projectDir, '.claude', 'settings.local.json');
  const eff = effectiveProjectStatusLine(projectDir);

  if (eff.source === 'none') {
    return { ok: false, log: ['이 프로젝트는 자체 statusLine이 없습니다 — 사용자 레벨 cccat이 그대로 표시되므로 adopt가 필요 없습니다.'] };
  }
  const effCmd = eff.value && String(eff.value.command || '');
  const home = projectHome(projectDir);
  fs.mkdirSync(home, { recursive: true });
  const manifestFile = path.join(home, 'manifest.json');
  const already = readJson(manifestFile, null);

  // 보존할 "원래" statusline 결정:
  // 현재 적용값이 cccat wrapper면(재-adopt) manifest의 원본을 이어받고,
  // 아니면 현재 적용값이 원본이다.
  let prevStatusLine;
  if (effCmd && effCmd.includes(MARKER) && already && 'prev_statusline' in already) {
    prevStatusLine = already.prev_statusline;
  } else {
    prevStatusLine = eff.value;
  }
  const prevCommand = prevStatusLine && prevStatusLine.type === 'command' ? prevStatusLine.command : null;

  // 기존 settings.local.json 백업 (있을 때만)
  const localExisted = fs.existsSync(localFile);
  const local = readJson(localFile, {});
  if (localExisted) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(localFile, path.join(home, `backup-settings.local-${ts}.json`));
    log.push('settings.local.json 백업 생성');
  }

  // 프로젝트 전용 wrapper 생성 (기존 statusline 출력 캐시는 프로젝트별로 분리)
  const wrapperFile = path.join(home, 'statusline.sh');
  fs.writeFileSync(wrapperFile, installMod.makeWrapper(prevCommand, path.join(home, 'prev-status.cache')));
  fs.chmodSync(wrapperFile, 0o755);

  // settings.local.json에 statusLine만 추가/교체 (다른 키는 그대로 보존)
  const hadLocalStatusLine = 'statusLine' in local;
  local.statusLine = { type: 'command', command: wrapperFile, ...installMod.statusLineRefresh() };
  fs.mkdirSync(path.dirname(localFile), { recursive: true });
  fs.writeFileSync(localFile, JSON.stringify(local, null, 2) + '\n');

  const { writeJson } = require('./store');
  writeJson(manifestFile, {
    project_dir: path.resolve(projectDir),
    adopted_at: new Date().toISOString(),
    prev_statusline: prevStatusLine,
    local_existed: already ? already.local_existed : localExisted,
    local_had_statusline: already ? already.local_had_statusline : hadLocalStatusLine,
  });

  log.push(`프로젝트 statusline 보존: ${prevCommand || '(command 타입 아님 — cccat만 표시)'}`);
  log.push(`settings.local.json에 cccat wrapper 설정 (settings.json은 건드리지 않음)`);
  log.push('adopt 완료 — 이 프로젝트에서 Claude Code를 다시 시작하면 고양이가 나타납니다.');
  return { ok: true, log };
}

function unadopt(projectDir = process.cwd()) {
  const log = [];
  const localFile = path.join(projectDir, '.claude', 'settings.local.json');
  const home = projectHome(projectDir);
  const manifest = readJson(path.join(home, 'manifest.json'), null);
  const local = readJson(localFile, {});
  const cmd = local.statusLine && String(local.statusLine.command || '');

  if (!cmd || !cmd.includes(MARKER)) {
    return { ok: false, log: ['이 프로젝트는 adopt 상태가 아닙니다.'] };
  }

  if (manifest && manifest.local_had_statusline && manifest.prev_statusline !== undefined) {
    local.statusLine = manifest.prev_statusline; // 원래 local에 있던 statusLine 복원
    log.push('settings.local.json의 원래 statusLine 복원');
  } else {
    delete local.statusLine; // 우리가 추가했던 키 제거 → 프로젝트 settings.json 것이 다시 적용됨
    log.push('settings.local.json에서 cccat statusLine 제거 (프로젝트 기본으로 복귀)');
  }

  if (Object.keys(local).length === 0 && manifest && manifest.local_existed === false) {
    try { fs.unlinkSync(localFile); log.push('settings.local.json 삭제 (adopt가 생성했던 파일)'); } catch { /* 무시 */ }
  } else {
    fs.writeFileSync(localFile, JSON.stringify(local, null, 2) + '\n');
  }

  try { fs.rmSync(home, { recursive: true, force: true }); } catch { /* 무시 */ }
  log.push('unadopt 완료');
  return { ok: true, log };
}

module.exports = { adopt, unadopt, effectiveProjectStatusLine, projectHome, projectKey };
