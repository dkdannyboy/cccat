'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// 테스트용 임시 홈
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cccat-test-'));
process.env.CCCAT_HOME = path.join(TMP, '.cccat');
process.env.CCCAT_CLAUDE_DIR = path.join(TMP, '.claude');

const width = require('../lib/width');
const cat = require('../lib/cat');
const { classify, tagsFromText } = require('../lib/classify');
const review = require('../lib/review');
const selectMod = require('../lib/select');
const configMod = require('../lib/config');
const stateMod = require('../lib/state');
const promo = require('../lib/promo');
const render = require('../lib/render');
const content = require('../lib/content');

beforeEach(() => {
  fs.rmSync(process.env.CCCAT_HOME, { recursive: true, force: true });
  fs.mkdirSync(process.env.CCCAT_HOME, { recursive: true });
});

// ── width ──
test('displayWidth: 한글은 2칸, ASCII는 1칸', () => {
  assert.equal(width.displayWidth('abc'), 3);
  assert.equal(width.displayWidth('가나다'), 6);
  assert.equal(width.displayWidth('a가'), 3);
});

test('displayWidth: ANSI 이스케이프는 0칸', () => {
  assert.equal(width.displayWidth('\x1b[32mhi\x1b[0m'), 2);
});

test('truncate: 표시 폭 기준으로 자름', () => {
  const t = width.truncate('가나다라마', 6);
  assert.ok(width.displayWidth(t) <= 6);
  assert.ok(t.endsWith('…'));
});

// ── cat ──
test('cat.frame: 애니메이션 시간에 따라 프레임이 바뀐다', () => {
  const f1 = cat.frame('idle', 0);
  const f2 = cat.frame('idle', 800);
  assert.notEqual(f1, f2);
});

test('cat.frame: 미지 상태는 idle로 폴백', () => {
  assert.equal(cat.normalizeState('nope'), 'idle');
  assert.ok(cat.frame('nope', 0));
});

test('cat: 모든 상태에 프레임과 라벨 존재', () => {
  for (const name of Object.keys(cat.STATES)) {
    assert.ok(cat.STATES[name].frames.length >= 2, name + ' frames');
    assert.ok(cat.label(name));
  }
});

// ── classify ──
test('classify: 파일 읽기 → reading + 확장자 태그', () => {
  const r = classify('PreToolUse', { tool_name: 'Read', tool_input: { file_path: '/a/b/auth.py' } });
  assert.equal(r.activity, 'reading');
  assert.ok(r.tags.includes('backend'));
});

test('classify: 테스트 파일 수정 → writing + test 태그', () => {
  const r = classify('PostToolUse', { tool_name: 'Edit', tool_input: { file_path: '/x/login.test.ts' } });
  assert.equal(r.activity, 'writing');
  assert.ok(r.tags.includes('test'));
  assert.ok(r.tags.includes('frontend'));
});

test('classify: git 명령 → git', () => {
  const r = classify('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'git merge feature/x' } });
  assert.equal(r.activity, 'git');
  assert.ok(r.tags.includes('git'));
});

test('classify: 테스트 실행 명령 → testing', () => {
  const r = classify('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test -- --watch' } });
  assert.equal(r.activity, 'testing');
});

test('classify: 도구 실패 → error', () => {
  const r = classify('PostToolUseFailure', { tool_name: 'Bash' });
  assert.equal(r.activity, 'error');
  assert.ok(r.tags.includes('debug'));
});

test('classify: 프롬프트에서 태그만 추출 (원문 미저장)', () => {
  const tags = tagsFromText('로그인 버그 좀 고쳐줘, 테스트도 추가');
  assert.ok(tags.includes('debug'));
  assert.ok(tags.includes('test'));
});

// ── review ──
test('review: 노출 횟수에 따라 due 간격 증가', () => {
  const h = { items: {} };
  const now = 1000000;
  const e1 = review.markShown(h, 'x', now);
  const gap1 = e1.due - now;
  const e2 = review.markShown(h, 'x', now + gap1);
  const gap2 = e2.due - (now + gap1);
  assert.ok(gap2 > gap1);
});

test('review: dueIds는 기한 지난 것만', () => {
  const h = { items: {} };
  review.markShown(h, 'a', 0);          // due = 4h
  review.markShown(h, 'b', Date.now()); // due = 미래
  const due = review.dueIds(h, Date.now());
  assert.deepEqual(due, ['a']);
});

// ── select ──
test('select: 맥락 태그와 일치하는 표현 우선', () => {
  const rng = () => 0.99; // 복습 분기 회피
  const r = selectMod.select({ tags: ['git'], recentIds: [], history: { items: {} }, config: {}, rng });
  assert.ok(r.item.tags.includes('git'), `got ${r.item.id} tags=${r.item.tags}`);
});

test('select: 최근 표시 항목은 반복하지 않음', () => {
  const all = content.loadAll();
  const gitItems = all.filter((i) => i.tags.includes('git')).map((i) => i.id);
  const rng = () => 0.99;
  const r = selectMod.select({ tags: ['git'], recentIds: gitItems.slice(0, 19), history: { items: {} }, config: {}, rng });
  assert.ok(!gitItems.slice(0, 19).includes(r.item.id));
});

test('select: 복습 기한이 되면 복습 항목 선택 가능', () => {
  const h = { items: {} };
  review.markShown(h, content.loadAll()[0].id, 0); // 오래전 → due 지남
  const r = selectMod.select({ tags: [], recentIds: [], history: h, config: { review_ratio: 1 }, rng: () => 0.01 });
  assert.equal(r.isReview, true);
});

// ── config ──
test('config: set/get 불리언과 숫자 파싱', () => {
  assert.equal(configMod.set('enabled', 'off').value, false);
  assert.equal(configMod.set('rotate_sec', '40').value, 40);
  assert.equal(configMod.load().rotate_sec, 40);
  assert.equal(configMod.set('nope', '1').ok, false);
});

// ── promo ──
test('promo: 오늘 5개 미만이면 표시 안 함', () => {
  const st = { ...stateMod.EMPTY, today: { date: stateMod.todayStr(), shown: 2 }, promo: { last_shown: '', count: 0 } };
  assert.equal(promo.shouldShow(st, { promo: true, language: 'ko' }), false);
});

test('promo: 조건 충족 시 하루 1회만', () => {
  const st = { ...stateMod.EMPTY, today: { date: stateMod.todayStr(), shown: 6 }, promo: { last_shown: '', count: 0 } };
  const cfg = { promo: true, language: 'ko' };
  assert.equal(promo.shouldShow(st, cfg), true);
  promo.markShown(st);
  assert.equal(promo.shouldShow(st, cfg), false);
});

test('promo: 한국어가 아니면 표시 안 함 / promo=false면 표시 안 함', () => {
  const st = { ...stateMod.EMPTY, today: { date: stateMod.todayStr(), shown: 9 }, promo: { last_shown: '', count: 0 } };
  assert.equal(promo.shouldShow(st, { promo: true, language: 'en' }), false);
  assert.equal(promo.shouldShow(st, { promo: false, language: 'ko' }), false);
});

// ── render ──
test('render: enabled=false면 출력 없음', () => {
  const lines = render.render(stateMod.EMPTY, { ...configMod.DEFAULTS, enabled: false });
  assert.equal(lines.length, 0);
});

test('render: 표현이 있으면 영어와 한국어가 모두 보임', () => {
  const item = content.loadAll()[0];
  const st = { ...stateMod.EMPTY, activity: 'thinking', activity_ts: Date.now(), current: { id: item.id, shown_at: Date.now(), mode: 'learn' } };
  const lines = render.render(st, configMod.DEFAULTS, { width: 120 });
  const joined = lines.join('\n');
  assert.ok(joined.includes(item.en));
  assert.ok(joined.includes(item.ko));
});

test('render: 퀴즈 모드는 빈칸을 만들고 리빌 후 원문 표시', () => {
  const item = content.loadAll().find((i) => i.en.split(' ').length >= 3);
  const now = Date.now();
  const st = { ...stateMod.EMPTY, activity: 'idle', activity_ts: now, current: { id: item.id, shown_at: now, mode: 'quiz' } };
  const masked = render.render(st, configMod.DEFAULTS, { width: 120, now: now + 1000 }).join('\n');
  assert.ok(masked.includes('＿'), 'should contain blank');
  const revealed = render.render(st, configMod.DEFAULTS, { width: 120, now: now + render.QUIZ_REVEAL_MS + 1 }).join('\n');
  assert.ok(revealed.includes(item.en));
});

test('render: blankOut은 가장 긴 단어를 가린다', () => {
  const b = render.blankOut('narrow down the cause');
  assert.ok(b.text.includes('n') && b.text.includes('＿'));
  assert.equal(b.word, 'narrow');
});

test('render: 좁은 폭에서는 한 줄(컴팩트)', () => {
  const item = content.loadAll()[0];
  const st = { ...stateMod.EMPTY, activity: 'idle', activity_ts: Date.now(), current: { id: item.id, shown_at: Date.now(), mode: 'learn' } };
  const lines = render.render(st, configMod.DEFAULTS, { width: 60 });
  assert.equal(lines.length, 1);
});

// ── state ──
test('state: activeTags는 빈도순, 30분 지난 태그 제외', () => {
  const st = { ...stateMod.EMPTY, recent_tags: [] };
  const now = Date.now();
  stateMod.pushTags(st, ['git'], now - 40 * 60000); // 만료
  stateMod.pushTags(st, ['debug', 'debug'], now);
  stateMod.pushTags(st, ['test'], now);
  const tags = stateMod.activeTags(st, now);
  assert.equal(tags[0], 'debug');
  assert.ok(!tags.includes('git'));
});

// ── content ──
test('content: 코어 팩 스키마 검증', () => {
  const items = content.loadAll();
  assert.ok(items.length >= 150, `only ${items.length}`);
  const TAGS = new Set(['git','github','review','debug','test','refactor','deploy','api','db','frontend','backend','security','perf','docs','collab','planning','ai','error','build','install','file','search','config','general']);
  for (const it of items) {
    assert.ok(it.id && it.en && it.ko, 'missing fields: ' + JSON.stringify(it.id));
    assert.ok([1, 2, 3].includes(it.difficulty), 'difficulty ' + it.id);
    for (const t of it.tags) assert.ok(TAGS.has(t), `bad tag ${t} in ${it.id}`);
  }
});
