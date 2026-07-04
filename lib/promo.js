'use strict';
// danielclass.com 안내: 한국어 사용자에게만, 하루 1회 이하, 성취 시점(오늘 N개째 표현)에만.
const state = require('./state');

const MESSAGES = [
  '오늘도 영어 한 스푼 완료 · 무료 영어 자료: danielclass.com',
  '더 많은 실전 개발 영어 → danielclass.com',
  '꾸준함이 실력! 무료 영어 자료: danielclass.com',
];

const MIN_SHOWN_TODAY = 5; // 오늘 5개 이상 봤을 때만 (자연스러운 성취 시점)

function shouldShow(st, config, now = Date.now()) {
  if (!config.promo) return false;
  if ((config.language || 'ko') !== 'ko') return false;
  const today = state.todayStr(now);
  if (st.promo && st.promo.last_shown === today && st.promo.count >= 1) return false;
  if (!st.today || st.today.date !== today) return false;
  return st.today.shown >= MIN_SHOWN_TODAY;
}

function message(now = Date.now()) {
  const day = Math.floor(now / (24 * 3600 * 1000));
  return MESSAGES[day % MESSAGES.length];
}

function markShown(st, now = Date.now()) {
  st.promo = { last_shown: state.todayStr(now), count: ((st.promo && st.promo.count) || 0) + 1 };
}

module.exports = { shouldShow, message, markShown, MIN_SHOWN_TODAY };
