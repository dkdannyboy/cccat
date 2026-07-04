'use strict';
// adopt/unadopt (프로젝트 공존) + 성능 개선(훅 축소, 스로틀, refresh_sec) 테스트
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'bin', 'cccat.js');

function mkWorld() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-adopt-'));
  const env = {
    ...process.env,
    CCCAT_HOME: path.join(tmp, '.cccat'),
    CCCAT_CLAUDE_DIR: path.join(tmp, '.claude'),
  };
  fs.mkdirSync(env.CCCAT_CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'), '{}');
  const proj = path.join(tmp, 'myproject');
  fs.mkdirSync(path.join(proj, '.claude'), { recursive: true });
  return { tmp, env, proj };
}

function run(env, cwd, args, input) {
  return execFileSync(process.execPath, [CLI, ...args], { env, cwd, input: input || '', encoding: 'utf8', timeout: 10000 });
}

test('adopt: 프로젝트 statusline을 보존한 wrapper를 settings.local.json에 설정, settings.json은 불변', () => {
  const { env, proj } = mkWorld();
  const projSettings = { statusLine: { type: 'command', command: 'echo PROJECT-LINE' }, other: 1 };
  fs.writeFileSync(path.join(proj, '.claude', 'settings.json'), JSON.stringify(projSettings, null, 2));
  run(env, proj, ['install']);
  const out = run(env, proj, ['adopt']);
  assert.ok(out.includes('adopt 완료'), out);

  // settings.json 그대로
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(proj, '.claude', 'settings.json'), 'utf8')), projSettings);
  // settings.local.json에 cccat wrapper
  const local = JSON.parse(fs.readFileSync(path.join(proj, '.claude', 'settings.local.json'), 'utf8'));
  assert.ok(local.statusLine.command.includes('cccat'));
  // wrapper가 프로젝트 원래 statusline을 품음 + 실제 실행 시 두 출력 모두
  const wrapper = local.statusLine.command;
  assert.ok(fs.readFileSync(wrapper, 'utf8').includes('echo PROJECT-LINE'));
  run(env, proj, ['hook', 'PreToolUse'], JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.py' } }));
  const rendered = execFileSync('/bin/sh', [wrapper], { env, cwd: proj, input: '{}', encoding: 'utf8' });
  assert.ok(rendered.startsWith('PROJECT-LINE'), rendered.split('\n')[0]);
  assert.ok(/ω/.test(rendered), '고양이 줄 포함');
});

test('unadopt: local에 원래 statusLine이 없었으면 키 제거, adopt가 만든 파일이면 삭제', () => {
  const { env, proj } = mkWorld();
  fs.writeFileSync(path.join(proj, '.claude', 'settings.json'),
    JSON.stringify({ statusLine: { type: 'command', command: 'echo P' } }));
  run(env, proj, ['adopt']);
  assert.ok(fs.existsSync(path.join(proj, '.claude', 'settings.local.json')));
  run(env, proj, ['unadopt']);
  assert.ok(!fs.existsSync(path.join(proj, '.claude', 'settings.local.json')), 'adopt가 생성한 파일은 삭제');
});

test('adopt/unadopt: 기존 settings.local.json의 다른 키와 statusLine을 보존·복원', () => {
  const { env, proj } = mkWorld();
  fs.writeFileSync(path.join(proj, '.claude', 'settings.json'),
    JSON.stringify({ statusLine: { type: 'command', command: 'echo P' } }));
  const localBefore = { enabledMcpjsonServers: ['x'], statusLine: { type: 'command', command: 'echo LOCAL-ORIG' } };
  fs.writeFileSync(path.join(proj, '.claude', 'settings.local.json'), JSON.stringify(localBefore, null, 2));

  run(env, proj, ['adopt']);
  let local = JSON.parse(fs.readFileSync(path.join(proj, '.claude', 'settings.local.json'), 'utf8'));
  assert.deepEqual(local.enabledMcpjsonServers, ['x'], '다른 키 보존');
  assert.ok(local.statusLine.command.includes('cccat'));
  // local의 statusLine이 우선이었으므로 wrapper는 LOCAL-ORIG를 품어야 함
  assert.ok(fs.readFileSync(local.statusLine.command, 'utf8').includes('echo LOCAL-ORIG'));

  run(env, proj, ['unadopt']);
  local = JSON.parse(fs.readFileSync(path.join(proj, '.claude', 'settings.local.json'), 'utf8'));
  assert.deepEqual(local, localBefore, '원상 복원');
});

test('adopt: 재실행(멱등)해도 원본 statusline이 이중 래핑되지 않음', () => {
  const { env, proj } = mkWorld();
  fs.writeFileSync(path.join(proj, '.claude', 'settings.json'),
    JSON.stringify({ statusLine: { type: 'command', command: 'echo ORIG' } }));
  run(env, proj, ['adopt']);
  run(env, proj, ['adopt']);
  const local = JSON.parse(fs.readFileSync(path.join(proj, '.claude', 'settings.local.json'), 'utf8'));
  const wrapper = fs.readFileSync(local.statusLine.command, 'utf8');
  assert.ok(wrapper.includes('echo ORIG'));
  assert.ok(!wrapper.includes('statusline.sh" <'), '자기 자신 래핑 금지');
  run(env, proj, ['unadopt']);
  assert.ok(!fs.existsSync(path.join(proj, '.claude', 'settings.local.json')));
});

test('adopt: 프로젝트 statusline이 없으면 불필요 안내', () => {
  const { env, proj } = mkWorld();
  const out = run(env, proj, ['adopt']);
  assert.ok(out.includes('필요 없습니다'), out);
});

test('훅 축소: PostToolUse는 등록하지 않는다 (성능)', () => {
  const { env, proj } = mkWorld();
  run(env, proj, ['install']);
  const s = JSON.parse(fs.readFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'), 'utf8'));
  assert.ok(s.hooks.PreToolUse, 'PreToolUse 유지');
  assert.ok(s.hooks.PostToolUseFailure, '실패 이벤트 유지');
  assert.ok(!s.hooks.PostToolUse, 'PostToolUse 제거');
});

test('런처 스로틀: state.json이 방금 갱신됐으면 PreToolUse는 node를 띄우지 않는다', () => {
  const { env, proj } = mkWorld();
  run(env, proj, ['install']);
  // 첫 이벤트로 state 생성
  run(env, proj, ['hook', 'PreToolUse'], JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.py' } }));
  const stFile = path.join(env.CCCAT_HOME, 'state.json');
  const before = fs.readFileSync(stFile, 'utf8');
  // 곧바로 런처 경유 PreToolUse — 스로틀로 스킵되어 state 불변이어야 함
  execFileSync('/bin/sh', [path.join(env.CCCAT_HOME, 'run.sh'), 'hook', 'PreToolUse'],
    { env, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status' } }), encoding: 'utf8' });
  assert.equal(fs.readFileSync(stFile, 'utf8'), before, '스로틀로 상태 불변');
  // Stop 이벤트는 스로틀 없이 통과
  execFileSync('/bin/sh', [path.join(env.CCCAT_HOME, 'run.sh'), 'hook', 'Stop'],
    { env, input: JSON.stringify({ hook_event_name: 'Stop' }), encoding: 'utf8' });
  const after = JSON.parse(fs.readFileSync(stFile, 'utf8'));
  assert.equal(after.activity, 'success', 'Stop은 즉시 반영');
});

test('refresh_sec 설정이 statusLine refreshInterval에 반영, 애니메이션 끄면 타이머 없음', () => {
  const { env, proj } = mkWorld();
  run(env, proj, ['config', 'set', 'refresh_sec', '3']);
  run(env, proj, ['install']);
  let s = JSON.parse(fs.readFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'), 'utf8'));
  assert.equal(s.statusLine.refreshInterval, 3);
  run(env, proj, ['config', 'set', 'show_animation', 'false']);
  run(env, proj, ['install']);
  s = JSON.parse(fs.readFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'), 'utf8'));
  assert.equal(s.statusLine.refreshInterval, undefined, '애니메이션 꺼짐 → 이벤트 기반만');
});
