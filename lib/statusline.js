'use strict';
// statusline 진입점: Claude Code가 주기적으로 호출한다.
// stdin JSON(모델/작업공간 정보)을 읽고 cccat 줄(1~3줄)을 출력한다.
// 기존 statusline 출력은 wrapper 셸 스크립트가 먼저 출력한다.
const stateMod = require('./state');
const configMod = require('./config');
const engine = require('./engine');
const promo = require('./promo');
const { render } = require('./render');

function readStdin(timeoutMs = 500) {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.on('data', (d) => { data += d; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
  });
}

async function run() {
  let payload = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch { /* 무시 */ }

  const config = configMod.load();
  if (!config.enabled) return;

  const st = stateMod.load();
  const now = Date.now();
  let dirty = false;

  // hook이 아직 안 돌았거나 오래 멈춘 경우에도 표현이 갱신되도록 보조 회전.
  // 단, 최근 10분 내 실제 활동이 있을 때만 — 유휴(밤새 켜둔) 세션에서
  // 콘텐츠를 소진하고 학습 기록을 오염시키는 것을 막는다.
  const recentlyActive = now - (st.activity_ts || 0) < 10 * 60 * 1000;
  if (!stateMod.isPaused(st, now) && recentlyActive) {
    if (!st.current || now - st.current.shown_at > (config.rotate_sec || 30) * 3000) {
      dirty = engine.maybeRotate(st, config, now) || dirty;
    }
  }

  // 프로모: pending이면 이번 렌더에 1회 표시하고 소진
  let promoMessage = null;
  if (st.promo_pending && promo.shouldShow(st, config, now)) {
    promoMessage = promo.message(now);
    promo.markShown(st, now);
    st.promo_pending = false;
    dirty = true;
  } else if (st.promo_pending) {
    st.promo_pending = false;
    dirty = true;
  }

  if (dirty) stateMod.save(st);

  const lines = render(st, config, { now, promoMessage });
  if (lines.length) process.stdout.write(lines.join('\n') + '\n');
}

module.exports = { run };
