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
