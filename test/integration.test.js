'use strict';
// 통합 테스트: 임시 HOME에서 설치→hook→statusline→제거 전체 흐름 검증
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'bin', 'cccat.js');

function mkEnv() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-int-'));
  const env = {
    ...process.env,
    CCCAT_HOME: path.join(tmp, '.cccat'),
    CCCAT_CLAUDE_DIR: path.join(tmp, '.claude'),
  };
  fs.mkdirSync(env.CCCAT_CLAUDE_DIR, { recursive: true });
  return { tmp, env };
}

function run(env, args, input) {
  return execFileSync(process.execPath, [CLI, ...args], {
    env, input: input || '', encoding: 'utf8', timeout: 10000,
  });
}

test('설치: 기존 settings 백업 + statusline 보존 + hooks 추가', () => {
  const { env } = mkEnv();
  const settingsFile = path.join(env.CCCAT_CLAUDE_DIR, 'settings.json');
  const original = {
    statusLine: { type: 'command', command: 'echo my-old-statusline' },
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo existing-hook' }] }] },
    model: 'opus',
  };
  fs.writeFileSync(settingsFile, JSON.stringify(original, null, 2));

  run(env, ['install']);

  const after = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  // statusline이 wrapper로 교체됨
  assert.ok(after.statusLine.command.includes('cccat'));
  // wrapper 안에 기존 명령이 보존됨
  const wrapper = fs.readFileSync(path.join(env.CCCAT_HOME, 'statusline.sh'), 'utf8');
  assert.ok(wrapper.includes('echo my-old-statusline'));
  // 기존 hook 유지 + cccat hook 추가
  assert.ok(after.hooks.Stop.some((e) => e.hooks[0].command === 'echo existing-hook'));
  assert.ok(after.hooks.Stop.some((e) => e.hooks[0].command.includes('cccat')));
  assert.ok(after.hooks.PreToolUse);
  // 다른 설정 보존
  assert.equal(after.model, 'opus');
  // 백업 존재
  const backups = fs.readdirSync(path.join(env.CCCAT_HOME, 'backup'));
  assert.ok(backups.length >= 1);
});

test('hook 이벤트 수신 → 상태 저장 → statusline 렌더링', () => {
  const { env } = mkEnv();
  run(env, ['install']);

  // PreToolUse: git 명령
  run(env, ['hook', 'PreToolUse'], JSON.stringify({
    hook_event_name: 'PreToolUse', session_id: 's1',
    tool_name: 'Bash', tool_input: { command: 'git merge feature/login' },
  }));

  const st = JSON.parse(fs.readFileSync(path.join(env.CCCAT_HOME, 'state.json'), 'utf8'));
  assert.equal(st.activity, 'git');
  assert.ok(st.recent_tags.some((t) => t.tag === 'git'));
  assert.ok(st.current, '표현이 선택되어야 함');

  // statusline 출력에 고양이와 표현 포함
  const out = run(env, ['statusline'], JSON.stringify({ session_id: 's1', model: { display_name: 'Test' } }));
  assert.ok(/ω/.test(out), '고양이 얼굴 포함: ' + out);
  assert.ok(out.trim().length > 0);

  // 학습 기록 저장 확인
  const h = JSON.parse(fs.readFileSync(path.join(env.CCCAT_HOME, 'history.json'), 'utf8'));
  assert.ok(Object.keys(h.items).length >= 1);
});

test('작업 맥락에 따라 표현이 달라진다 (git 맥락 → git 태그 표현)', () => {
  const { env } = mkEnv();
  run(env, ['install']);
  run(env, ['hook', 'PreToolUse'], JSON.stringify({
    hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git rebase main' },
  }));
  const st = JSON.parse(fs.readFileSync(path.join(env.CCCAT_HOME, 'state.json'), 'utf8'));
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'pack-core.json'), 'utf8'));
  const item = pack.items.find((i) => i.id === st.current.id);
  assert.ok(item.tags.includes('git'), `expected git-tagged item, got ${item.id} ${item.tags}`);
});

test('off 상태에서는 hook이 상태를 만들지 않고 statusline 출력 없음', () => {
  const { env } = mkEnv();
  run(env, ['install']);
  run(env, ['off']);
  run(env, ['hook', 'PreToolUse'], JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.py' } }));
  const out = run(env, ['statusline'], '{}');
  assert.equal(out.trim(), '');
  run(env, ['on']);
  run(env, ['hook', 'PreToolUse'], JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.py' } }));
  const out2 = run(env, ['statusline'], '{}');
  assert.ok(out2.trim().length > 0);
});

test('pause/resume', () => {
  const { env } = mkEnv();
  run(env, ['install']);
  run(env, ['hook', 'PreToolUse'], JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.py' } }));
  run(env, ['pause', '10']);
  const out = run(env, ['statusline'], '{}');
  assert.ok(out.includes('쉬는 중') || !out.includes('—'), '일시정지 중에는 표현 대신 잠자는 고양이');
  run(env, ['resume']);
  const st = JSON.parse(fs.readFileSync(path.join(env.CCCAT_HOME, 'state.json'), 'utf8'));
  assert.equal(st.paused_until, 0);
});

test('제거: statusline과 hooks가 원래대로 복원됨', () => {
  const { env } = mkEnv();
  const settingsFile = path.join(env.CCCAT_CLAUDE_DIR, 'settings.json');
  const original = {
    statusLine: { type: 'command', command: 'echo my-old-statusline' },
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo existing-hook' }] }] },
  };
  fs.writeFileSync(settingsFile, JSON.stringify(original, null, 2));

  run(env, ['install']);
  run(env, ['uninstall']);

  const after = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  assert.deepEqual(after.statusLine, original.statusLine, 'statusline 복원');
  assert.equal(after.hooks.Stop.length, 1);
  assert.equal(after.hooks.Stop[0].hooks[0].command, 'echo existing-hook');
  assert.ok(!after.hooks.PreToolUse, 'cccat hooks 제거됨');
  // 데이터는 보존
  assert.ok(fs.existsSync(path.join(env.CCCAT_HOME, 'history.json')) || fs.existsSync(env.CCCAT_HOME));
});

test('제거(설치 전 statusline 없던 경우): statusline 키 자체가 제거됨', () => {
  const { env } = mkEnv();
  fs.writeFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'), '{}');
  run(env, ['install']);
  run(env, ['uninstall']);
  const after = JSON.parse(fs.readFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'), 'utf8'));
  assert.ok(!after.statusLine);
});

test('재설치(멱등): 원래 statusline이 이중 래핑되지 않음', () => {
  const { env } = mkEnv();
  const settingsFile = path.join(env.CCCAT_CLAUDE_DIR, 'settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify({ statusLine: { type: 'command', command: 'echo orig' } }));
  run(env, ['install']);
  run(env, ['install']);
  const wrapper = fs.readFileSync(path.join(env.CCCAT_HOME, 'statusline.sh'), 'utf8');
  assert.ok(wrapper.includes('echo orig'), '원본 보존');
  assert.ok(!wrapper.includes('statusline.sh" statusline'), '자기 자신 래핑 금지');
  const after = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  const cccatStops = Object.values(after.hooks).flat().filter((e) => e.hooks[0].command.includes('cccat'));
  const events = Object.keys(after.hooks);
  for (const ev of events) {
    const cnt = after.hooks[ev].filter((e) => e.hooks[0].command.includes('cccat')).length;
    assert.ok(cnt <= 1, `${ev}에 cccat hook 중복`);
  }
  run(env, ['uninstall']);
  const restored = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  assert.equal(restored.statusLine.command, 'echo orig', '재설치 후에도 원본 복원');
});

test('wrapper 셸 스크립트가 기존 출력 + cccat 줄을 함께 출력', () => {
  const { env } = mkEnv();
  fs.writeFileSync(path.join(env.CCCAT_CLAUDE_DIR, 'settings.json'),
    JSON.stringify({ statusLine: { type: 'command', command: 'echo OLD-LINE' } }));
  run(env, ['install']);
  run(env, ['hook', 'PreToolUse'], JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.md' } }));
  const wrapper = path.join(env.CCCAT_HOME, 'statusline.sh');
  const out = execFileSync('/bin/sh', [wrapper], { env, input: '{}', encoding: 'utf8' });
  assert.ok(out.startsWith('OLD-LINE'), '기존 statusline 먼저: ' + out.split('\n')[0]);
  assert.ok(/ω/.test(out), 'cccat 줄 포함');
});

test('데이터 초기화: reset --all', () => {
  const { env } = mkEnv();
  run(env, ['install']);
  run(env, ['hook', 'PreToolUse'], JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.py' } }));
  run(env, ['reset', '--all']);
  assert.ok(!fs.existsSync(path.join(env.CCCAT_HOME, 'history.json')));
  assert.ok(!fs.existsSync(path.join(env.CCCAT_HOME, 'state.json')));
});

test('hook은 비정상 입력에도 절대 실패하지 않는다', () => {
  const { env } = mkEnv();
  run(env, ['install']);
  run(env, ['hook', 'PreToolUse'], 'NOT JSON {{{');
  run(env, ['hook'], '');
  // 예외 없이 도달하면 성공
  assert.ok(true);
});

test('statusline 실행 시간 < 400ms', () => {
  const { env } = mkEnv();
  run(env, ['install']);
  run(env, ['hook', 'PreToolUse'], JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'a.py' } }));
  const t0 = Date.now();
  run(env, ['statusline'], '{}');
  const dt = Date.now() - t0;
  assert.ok(dt < 400, `took ${dt}ms`);
});
