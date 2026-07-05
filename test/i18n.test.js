'use strict';
// 다국어 설명(i18n) — 일본어 오버레이 + 언어 전환 테스트
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-i18n-'));
process.env.CCCAT_HOME = path.join(TMP, '.cccat');
process.env.CCCAT_CLAUDE_DIR = path.join(TMP, '.claude');

const content = require('../lib/content');
const configMod = require('../lib/config');
const render = require('../lib/render');
const stateMod = require('../lib/state');

test('availableLanguages는 ko와 ja를 포함한다', () => {
  const langs = content.availableLanguages();
  assert.ok(langs.includes('ko'));
  assert.ok(langs.includes('ja'));
});

test('일본어 오버레이가 코어 팩의 모든 id를 빠짐없이 커버한다', () => {
  const core = require('../content/pack-core.json').items.map((i) => i.id);
  const ja = require('../content/i18n/ja.json').items;
  const jaIds = new Set(ja.map((i) => i.id));
  const missing = core.filter((id) => !jaIds.has(id));
  const orphan = ja.map((i) => i.id).filter((id) => !core.includes(id));
  assert.equal(missing.length, 0, '누락: ' + missing.slice(0, 5).join(','));
  assert.equal(orphan.length, 0, '고아: ' + orphan.slice(0, 5).join(','));
  assert.equal(jaIds.size, ja.length, 'ja 내부 중복 id 없음');
  for (const it of ja) {
    assert.ok(it.meaning && it.example_trans, 'ja 항목 필드 완전성: ' + it.id);
  }
});

test('ko는 코어 팩의 뜻을, ja는 일본어 오버레이 뜻을 정규화한다', () => {
  const koItem = content.byId('dbg-trace-issue-to-source', 'ko');
  const jaItem = content.byId('dbg-trace-issue-to-source', 'ja');
  assert.equal(koItem.meaning, koItem.ko);
  assert.notEqual(jaItem.meaning, jaItem.ko, 'ja는 한국어와 달라야 함');
  assert.ok(/[぀-ヿ一-鿿]/.test(jaItem.meaning), '일본어(가나/한자) 포함');
  // 원본 ko 필드는 하위 호환을 위해 유지
  assert.ok(jaItem.ko);
});

test('오버레이에 없는 언어는 ko로 폴백한다', () => {
  const it = content.byId('git-stage-changes', 'zzz');
  assert.equal(it.meaning, it.ko);
});

test('config.set(language)은 지원 언어만 허용한다', () => {
  assert.equal(configMod.set('language', 'ja').ok, true);
  assert.equal(configMod.set('language', 'ko').ok, true);
  const bad = configMod.set('language', 'xx');
  assert.equal(bad.ok, false);
  assert.ok(/unsupported/.test(bad.error));
});

test('render는 설정 언어의 meaning을 사용한다 (ja)', () => {
  const item = content.byId('sec-sanitize-the-input', 'ja');
  const st = {
    ...stateMod.EMPTY, activity: 'thinking', activity_ts: Date.now(),
    current: { id: item.id, shown_at: Date.now(), mode: 'learn' },
  };
  const cfg = { ...configMod.DEFAULTS, language: 'ja' };
  const out = render.render(st, cfg, { width: 120 }).join('\n');
  assert.ok(out.includes(item.en));
  assert.ok(out.includes(item.meaning), '일본어 뜻 표시');
});

test('퀴즈 안내 문구가 언어별로 다르다', () => {
  const item = content.loadAll('ja').find((i) => i.en.split(' ').length >= 3);
  const now = Date.now();
  const st = {
    ...stateMod.EMPTY, activity: 'idle', activity_ts: now,
    current: { id: item.id, shown_at: now, mode: 'quiz' },
  };
  const jaOut = render.render(st, { ...configMod.DEFAULTS, language: 'ja' }, { width: 120, now: now + 1000 }).join('\n');
  assert.ok(jaOut.includes('空欄') || jaOut.includes('＿'), '일본어 퀴즈 안내 또는 빈칸');
});

test('일본어 팩의 예문 번역이 실제 일본어다 (한국어가 아님)', () => {
  const ja = require('../content/i18n/ja.json').items;
  const sample = ja.slice(0, 20);
  for (const it of sample) {
    // 한글 음절이 예문 번역에 없어야 함 (일본어만)
    assert.ok(!/[가-힣]/.test(it.example_trans), '한글 혼입: ' + it.id + ' → ' + it.example_trans);
  }
});

test('상태 라벨이 언어별로 번역된다 (ja)', () => {
  const cat = require('../lib/cat');
  assert.equal(cat.label('success', 'ko'), '성공!');
  assert.equal(cat.label('success', 'ja'), '成功！');
  assert.equal(cat.label('git', 'ja'), 'Git作業中');
  // 모든 상태에 일본어 라벨 존재
  for (const name of Object.keys(cat.STATES)) {
    assert.ok(cat.LABELS.ja[name], 'ja 라벨 누락: ' + name);
  }
  // 미지원 언어는 한국어 폴백
  assert.equal(cat.label('idle', 'zz'), cat.STATES.idle.label);
});

test('오늘 카운터가 언어별로 번역된다 (ja: 今日/個/復習)', () => {
  const content = require('../lib/content');
  const item = content.byId('git-rebase-onto-main', 'ja');
  const st = {
    ...stateMod.EMPTY, activity: 'git', activity_ts: Date.now(),
    current: { id: item.id, shown_at: Date.now(), mode: 'learn' },
    today: { date: 'x', shown: 3, review: 1 },
  };
  const out = render.render(st, { ...configMod.DEFAULTS, language: 'ja' }, { width: 130 }).join('\n');
  assert.ok(out.includes('今日 3個'), '일본어 카운터: ' + out);
  assert.ok(!out.includes('오늘'), '한국어 잔존 없음');
});
