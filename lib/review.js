'use strict';
// 간단한 간격 반복 복습: 본 횟수에 따라 다음 복습 시점을 늘린다.
const paths = require('./paths');
const { readJson, writeJson } = require('./store');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
// n번째 노출 후 다음 복습까지 간격
const INTERVALS = [4 * HOUR, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

function load() {
  return readJson(paths.historyFile(), { items: {} });
}

function save(h) {
  return writeJson(paths.historyFile(), h);
}

function stateOf(entry) {
  if (!entry) return 'new';
  if (entry.seen >= 6) return 'mastered';
  if (entry.seen >= 2) return 'learning';
  return 'seen';
}

// 표현을 보여줬을 때 기록
function markShown(h, id, now = Date.now(), wasReview = false) {
  const e = h.items[id] || { seen: 0, correct: 0, wrong: 0, first_seen: now, saved: false };
  e.seen += 1;
  e.last_seen = now;
  e.due = now + INTERVALS[Math.min(e.seen - 1, INTERVALS.length - 1)];
  e.was_review = wasReview;
  h.items[id] = e;
  return e;
}

function markSaved(h, id, saved = true) {
  const e = h.items[id] || { seen: 0, correct: 0, wrong: 0, first_seen: Date.now(), saved: false };
  e.saved = saved;
  h.items[id] = e;
}

// 복습 대상: due가 지난 항목 (mastered 포함 — 오래되면 다시 봄)
function dueIds(h, now = Date.now()) {
  return Object.entries(h.items)
    .filter(([, e]) => e.due && e.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

function seenIds(h) {
  return new Set(Object.keys(h.items));
}

function stats(h) {
  const s = { total: 0, new: 0, seen: 0, learning: 0, mastered: 0, saved: 0 };
  for (const e of Object.values(h.items)) {
    s.total += 1;
    s[stateOf(e)] = (s[stateOf(e)] || 0) + 1;
    if (e.saved) s.saved += 1;
  }
  return s;
}

module.exports = { load, save, markShown, markSaved, dueIds, seenIds, stats, stateOf, INTERVALS };
