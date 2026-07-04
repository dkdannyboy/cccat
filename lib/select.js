'use strict';
// 표현 선택: 맥락 일치 > 복습 예정 > 새 표현. 최근 표시 중복 방지.
const content = require('./content');
const review = require('./review');

const RECENT_LIMIT = 20;

function pick(arr, rng) {
  return arr.length ? arr[Math.floor(rng() * arr.length)] : null;
}

/**
 * @param {object} opts
 *  - tags: 현재 활성 맥락 태그(우선순위순)
 *  - recentIds: 최근 표시 id 배열
 *  - history: review history 객체
 *  - config: 설정
 *  - now, rng: 테스트 주입용
 * @returns {{item, isReview:boolean}|null}
 */
function select(opts) {
  const { tags = [], recentIds = [], history, config = {}, now = Date.now(), rng = Math.random } = opts;
  const all = content.loadAll();
  if (!all.length) return null;
  const h = history || review.load();
  const recent = new Set(recentIds.slice(-RECENT_LIMIT));
  const diffMax = config.difficulty_max || 3;
  const usable = all.filter((i) => !recent.has(i.id) && (i.difficulty || 1) <= diffMax);
  const pool = usable.length ? usable : all.filter((i) => !recent.has(i.id));
  if (!pool.length) return { item: pick(all, rng), isReview: false };

  const due = new Set(review.dueIds(h, now));
  const seen = review.seenIds(h);
  const tagSet = new Set(tags);
  const matches = (i) => (i.tags || []).some((t) => tagSet.has(t));

  const ctxFresh = pool.filter((i) => matches(i) && !seen.has(i.id));
  const ctxDue = pool.filter((i) => matches(i) && due.has(i.id));
  const anyDue = pool.filter((i) => due.has(i.id));
  const fresh = pool.filter((i) => !seen.has(i.id));

  const reviewRatio = config.review_ratio != null ? config.review_ratio : 0.3;
  const contextAware = config.context_aware !== false;

  // 1) 복습 차례인가?
  if (anyDue.length && rng() < reviewRatio) {
    const item = pick(ctxDue.length ? ctxDue : anyDue, rng);
    if (item) return { item, isReview: true };
  }
  // 2) 맥락 일치 새 표현
  if (contextAware && ctxFresh.length) return { item: pick(ctxFresh, rng), isReview: false };
  // 3) 맥락 일치 복습
  if (contextAware && ctxDue.length) return { item: pick(ctxDue, rng), isReview: true };
  // 4) 새 표현
  if (fresh.length) return { item: pick(fresh, rng), isReview: false };
  // 5) 복습 예정
  if (anyDue.length) return { item: pick(anyDue, rng), isReview: true };
  // 6) 아무거나 (최근 제외)
  return { item: pick(pool, rng), isReview: false };
}

module.exports = { select, RECENT_LIMIT };
