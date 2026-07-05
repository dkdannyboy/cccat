'use strict';
// 실사용 점검(2026-07-05)에서 발견된 결함들의 회귀 테스트
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-reg-'));
process.env.CCCAT_HOME = path.join(TMP, '.cccat');
process.env.CCCAT_CLAUDE_DIR = path.join(TMP, '.claude');

const { render } = require('../lib/render');
const { displayWidth } = require('../lib/width');
const configMod = require('../lib/config');
const content = require('../lib/content');
const CLI = path.join(__dirname, '..', 'bin', 'cccat.js');

test('회귀: 어떤 폭에서도 렌더링이 오버플로하지 않는다', () => {
  const items = content.loadAll();
  let longest = items[0];
  for (const i of items) if ((i.en + i.ko).length > (longest.en + longest.ko).length) longest = i;
  const st = {
    activity: 'thinking', activity_ts: Date.now(),
    current: { id: longest.id, shown_at: Date.now(), mode: 'learn' },
    recent_ids: [], recent_tags: [], today: { date: 'x', shown: 999, review: 99 },
  };
  for (const w of [70, 80, 90, 100, 120, 160]) {
    for (const l of render(st, configMod.DEFAULTS, { width: w })) {
      assert.ok(displayWidth(l) <= w, `width ${w}: got ${displayWidth(l)}`);
    }
  }
});

test('회귀: 유휴 세션(10분 이상 무활동)에서는 statusline이 표현을 회전시키지 않는다', () => {
  fs.rmSync(process.env.CCCAT_HOME, { recursive: true, force: true });
  const env = { ...process.env };
  // 오래된 활동 시각으로 상태를 만든다
  execFileSync(process.execPath, [CLI, 'hook', 'PreToolUse'], {
    env, input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.py' } }), encoding: 'utf8',
  });
  const stFile = path.join(env.CCCAT_HOME, 'state.json');
  const st = JSON.parse(fs.readFileSync(stFile, 'utf8'));
  st.activity_ts = Date.now() - 60 * 60 * 1000; // 1시간 전
  st.current = null; // 회전 조건 충족 상태
  fs.writeFileSync(stFile, JSON.stringify(st));

  execFileSync(process.execPath, [CLI, 'statusline'], { env, input: '{}', encoding: 'utf8' });
  const after = JSON.parse(fs.readFileSync(stFile, 'utf8'));
  assert.equal(after.current, null, '유휴 상태에서 회전 금지');
});

test('회귀: 활동 직후에는 statusline 보조 회전이 동작한다', () => {
  fs.rmSync(process.env.CCCAT_HOME, { recursive: true, force: true });
  const env = { ...process.env };
  execFileSync(process.execPath, [CLI, 'hook', 'SessionStart'], { env, input: '{}', encoding: 'utf8' });
  const stFile = path.join(env.CCCAT_HOME, 'state.json');
  const st = JSON.parse(fs.readFileSync(stFile, 'utf8'));
  st.current = null;
  fs.writeFileSync(stFile, JSON.stringify(st));
  execFileSync(process.execPath, [CLI, 'statusline'], { env, input: '{}', encoding: 'utf8' });
  const after = JSON.parse(fs.readFileSync(stFile, 'utf8'));
  assert.ok(after.current, '활동 중에는 회전해야 함');
});

test('회귀: 4글자 이하 핵심 단어는 퀴즈 빈칸을 만들지 않는다', () => {
  const { blankOut } = require('../lib/render');
  assert.equal(blankOut('ETA?').word, null);
  assert.equal(blankOut('do it now').word, null);
  assert.ok(blankOut('narrow down the cause').word);
});

test('회귀: wrapper가 기존 statusline을 5초 캐시로 실행한다', () => {
  const install = require('../lib/install');
  const w = install.makeWrapper('echo EXPENSIVE');
  assert.ok(w.includes('cache'), '캐시 로직 포함');
  assert.ok(w.includes('EXPENSIVE'), '기존 명령 포함');
});

// ── 2차 감사(evaluator-active) 지적 사항 회귀 ──

test('회귀: 수동으로 statusline을 바꾼 뒤 재설치해도 최신 설정이 보존된다', () => {
  const { execFileSync } = require('child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-reg2-'));
  const env = { ...process.env, CCCAT_HOME: path.join(tmp, '.cccat'), CCCAT_CLAUDE_DIR: path.join(tmp, '.claude') };
  fs.mkdirSync(env.CCCAT_CLAUDE_DIR, { recursive: true });
  const sf = path.join(env.CCCAT_CLAUDE_DIR, 'settings.json');
  fs.writeFileSync(sf, JSON.stringify({ statusLine: { type: 'command', command: 'echo FIRST' } }));
  const CLI2 = path.join(__dirname, '..', 'bin', 'cccat.js');
  execFileSync(process.execPath, [CLI2, 'install'], { env, encoding: 'utf8' });
  // 사용자가 수동으로 statusline을 교체 (cccat 항목 제거)
  fs.writeFileSync(sf, JSON.stringify({ statusLine: { type: 'command', command: 'echo SECOND' } }));
  execFileSync(process.execPath, [CLI2, 'install'], { env, encoding: 'utf8' });
  execFileSync(process.execPath, [CLI2, 'uninstall'], { env, encoding: 'utf8' });
  const after = JSON.parse(fs.readFileSync(sf, 'utf8'));
  assert.equal(after.statusLine.command, 'echo SECOND', '사용자의 최신 설정이 복원되어야 함');
});

test('회귀: manifest 소실 후 uninstall해도 백업에서 statusline을 복구한다', () => {
  const { execFileSync } = require('child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-reg3-'));
  const env = { ...process.env, CCCAT_HOME: path.join(tmp, '.cccat'), CCCAT_CLAUDE_DIR: path.join(tmp, '.claude') };
  fs.mkdirSync(env.CCCAT_CLAUDE_DIR, { recursive: true });
  const sf = path.join(env.CCCAT_CLAUDE_DIR, 'settings.json');
  fs.writeFileSync(sf, JSON.stringify({ statusLine: { type: 'command', command: 'echo PRECIOUS' } }));
  const CLI2 = path.join(__dirname, '..', 'bin', 'cccat.js');
  execFileSync(process.execPath, [CLI2, 'install'], { env, encoding: 'utf8' });
  fs.unlinkSync(path.join(env.CCCAT_HOME, 'install-manifest.json')); // manifest 소실
  execFileSync(process.execPath, [CLI2, 'uninstall'], { env, encoding: 'utf8' });
  const after = JSON.parse(fs.readFileSync(sf, 'utf8'));
  assert.ok(after.statusLine && after.statusLine.command === 'echo PRECIOUS', '백업 복구 실패: ' + JSON.stringify(after.statusLine));
});

test('회귀: hook 명령은 node 경로를 런처로 실행 시점에 해석한다', () => {
  const { execFileSync } = require('child_process');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-reg4-'));
  const env = { ...process.env, CCCAT_HOME: path.join(tmp, '.cccat'), CCCAT_CLAUDE_DIR: path.join(tmp, '.claude') };
  fs.mkdirSync(env.CCCAT_CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'), '{}');
  const CLI2 = path.join(__dirname, '..', 'bin', 'cccat.js');
  execFileSync(process.execPath, [CLI2, 'install'], { env, encoding: 'utf8' });
  const s = JSON.parse(fs.readFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'), 'utf8'));
  const cmd = s.hooks.PreToolUse.find((e) => e.hooks[0].command.includes('cccat')).hooks[0].command;
  assert.ok(cmd.includes('run.sh'), 'hook은 런처 경유: ' + cmd);
  const launcher = fs.readFileSync(path.join(env.CCCAT_HOME, 'run.sh'), 'utf8');
  assert.ok(launcher.includes('command -v node'), 'PATH의 node 우선');
  // 런처가 실제로 동작
  const out = execFileSync('/bin/sh', [path.join(env.CCCAT_HOME, 'run.sh'), 'version'], { env, encoding: 'utf8' });
  assert.ok(out.includes('cccat v'));
});

test('회귀: 퀴즈 빈칸이 문장부호를 정답 힌트로 노출하지 않는다', () => {
  const { blankOut } = require('../lib/render');
  const b = blankOut('this is O(n squared)');
  assert.ok(b.word, '퀴즈 생성됨');
  assert.ok(b.text.includes('s＿＿＿＿d)'), '마지막 글자는 d, 괄호는 바깥: ' + b.text);
});

test('회귀: withLock — 락 보유 중에는 다른 호출이 ok:false로 물러난다', () => {
  const { withLock } = require('../lib/store');
  const lockDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-lock-')), '.lock');
  const r = withLock(lockDir, () => {
    const inner = withLock(lockDir, () => 'nested', { timeoutMs: 100, staleMs: 60000 });
    assert.equal(inner.ok, false, '중첩 획득은 실패해야 함');
    return 'outer';
  });
  assert.equal(r.ok, true);
  assert.equal(r.value, 'outer');
  // 해제 후 재획득 가능
  const again = withLock(lockDir, () => 1);
  assert.equal(again.ok, true);
});

test('회귀: 생성 스크립트의 mtime 취득은 GNU stat 우선 + 숫자 검증 (Linux 이식성)', () => {
  const install = require('../lib/install');
  for (const script of [install.makeLauncher(), install.makeWrapper('echo X')]) {
    assert.ok(script.includes('_mtime'), '_mtime 헬퍼 사용');
    const gnu = script.indexOf('stat -c %Y');
    const bsd = script.indexOf('stat -f %m');
    assert.ok(gnu >= 0 && bsd >= 0, 'stat 양쪽 폴백 존재');
    assert.ok(gnu < bsd, 'GNU(-c %Y)를 BSD(-f %m)보다 먼저 시도해야 함 (Linux stat -f 오작동 회피)');
    assert.ok(/case "\$m" in ''\|\*\[!0-9\]\*\) m=0/.test(script), '숫자 검증 case 포함');
  }
});

test('회귀: 재설치 시 이전 버전이 남긴 빠진-이벤트 cccat 훅도 정리한다', () => {
  const install = require('../lib/install');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-hookmig-'));
  const env = { ...process.env, CCCAT_HOME: path.join(tmp, '.cccat'), CCCAT_CLAUDE_DIR: path.join(tmp, '.claude') };
  fs.mkdirSync(env.CCCAT_CLAUDE_DIR, { recursive: true });
  const sf = path.join(env.CCCAT_CLAUDE_DIR, 'settings.json');
  // 이전 버전이 PostToolUse에 cccat 훅을 남겼다고 가정
  fs.writeFileSync(sf, JSON.stringify({
    hooks: {
      PostToolUse: [{ hooks: [{ type: 'command', command: 'node /old/cccat.js hook PostToolUse' }] }],
      PreToolUse: [{ hooks: [{ type: 'command', command: 'echo keep-me' }] }],
    },
  }));
  const CLI2 = path.join(__dirname, '..', 'bin', 'cccat.js');
  require('child_process').execFileSync(process.execPath, [CLI2, 'install'], { env, encoding: 'utf8' });
  const after = JSON.parse(fs.readFileSync(sf, 'utf8'));
  const stale = (after.hooks.PostToolUse || []).filter((e) => e.hooks.some((h) => (h.command || '').includes('cccat')));
  assert.equal(stale.length, 0, '빠진 이벤트의 cccat 훅 잔류 없음');
  // 남의 훅은 보존
  assert.ok((after.hooks.PreToolUse || []).some((e) => e.hooks.some((h) => h.command === 'echo keep-me')), '기존 타 훅 보존');
  assert.ok(!after.hooks.PostToolUse, 'PostToolUse는 cccat 제거 후 비어 삭제됨');
});
