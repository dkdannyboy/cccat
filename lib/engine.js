'use strict';
// 회전 엔진: 언제 새 표현으로 바꿀지 결정하고 기록한다.
const stateMod = require('./state');
const review = require('./review');
const selectMod = require('./select');
const promo = require('./promo');

// 필요 시 현재 표현을 교체. st/history를 변경하고 저장 필요 여부를 반환.
function maybeRotate(st, config, now = Date.now(), rng = Math.random) {
  const rotateMs = (config.rotate_sec || 30) * 1000;
  if (st.current && now - st.current.shown_at < rotateMs) return false;

  const h = review.load();
  stateMod.ensureToday(st, now);

  const res = selectMod.select({
    tags: stateMod.activeTags(st, now),
    recentIds: st.recent_ids || [],
    history: h,
    config,
    now,
    rng,
  });
  if (!res || !res.item) return false;

  const isQuiz = review.seenIds(h).has(res.item.id) && rng() < (config.quiz_ratio || 0);
  const entry = review.markShown(h, res.item.id, now, res.isReview);
  review.save(h);

  st.current = { id: res.item.id, shown_at: now, mode: isQuiz ? 'quiz' : 'learn', is_review: res.isReview };
  st.recent_ids = [...(st.recent_ids || []), res.item.id].slice(-selectMod.RECENT_LIMIT);
  st.today.shown += 1;
  st.today.ids = [...new Set([...(st.today.ids || []), res.item.id])];
  if (res.isReview) st.today.review += 1;
  else if (entry.seen === 1) st.today.new += 1;

  // 성취 시점 프로모 판정 (표시 자체는 render에서)
  if (!st.promo_pending && promo.shouldShow(st, config, now)) {
    st.promo_pending = true;
  }
  return true;
}

module.exports = { maybeRotate };
