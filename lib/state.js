'use strict';
const paths = require('./paths');
const { readJson, writeJson } = require('./store');

const EMPTY = {
  activity: 'idle',
  activity_ts: 0,
  recent_tags: [],   // [{tag, ts}] 최근 태그(맥락). 원문 저장 없음.
  session_id: null,
  current: null,     // {id, shown_at, mode: 'learn'|'quiz'}
  recent_ids: [],    // 최근 표시한 표현 id (중복 방지)
  today: { date: '', shown: 0, new: 0, review: 0, ids: [] },
  promo: { last_shown: '', count: 0 },
  paused_until: 0,
};

function load() {
  return { ...EMPTY, ...readJson(paths.stateFile(), {}) };
}

function save(st) {
  return writeJson(paths.stateFile(), st);
}

function todayStr(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 태그 반영: 최근 12개 유지, 30분 지난 태그는 버림
function pushTags(st, tags, now = Date.now()) {
  const cutoff = now - 30 * 60 * 1000;
  st.recent_tags = (st.recent_tags || [])
    .filter((t) => t.ts > cutoff)
    .concat(tags.map((tag) => ({ tag, ts: now })))
    .slice(-12);
}

function activeTags(st, now = Date.now()) {
  const cutoff = now - 30 * 60 * 1000;
  const counts = {};
  for (const { tag, ts } of st.recent_tags || []) {
    if (ts > cutoff) counts[tag] = (counts[tag] || 0) + 1;
  }
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
}

function ensureToday(st, now = Date.now()) {
  const t = todayStr(now);
  if (!st.today || st.today.date !== t) {
    st.today = { date: t, shown: 0, new: 0, review: 0, ids: [] };
    // 날짜가 바뀌었으면 프로모 일일 카운터 리셋 (last_shown 날짜는 보존)
    st.promo = st.promo || { last_shown: '', count: 0 };
    if (st.promo.last_shown !== t) st.promo.count = 0;
  }
}

function isPaused(st, now = Date.now()) {
  return st.paused_until && now < st.paused_until;
}

module.exports = { EMPTY, load, save, pushTags, activeTags, ensureToday, todayStr, isPaused };
