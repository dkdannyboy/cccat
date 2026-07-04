'use strict';
// hook 진입점: stdin JSON에서 안전한 신호만 추출해 상태를 갱신한다.
// 절대 실패하지 않고, 절대 Claude Code를 지연시키지 않는 것이 최우선.
const stateMod = require('./state');
const configMod = require('./config');
const { classify } = require('./classify');
const engine = require('./engine');

function readStdin(timeoutMs = 800) {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.on('data', (d) => { data += d; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
  });
}

async function run(eventArg) {
  let payload = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch { /* 페이로드 파싱 실패 — 이벤트 이름만으로 진행 */ }

  const event = payload.hook_event_name || eventArg || 'unknown';
  const config = configMod.load();
  const st = stateMod.load();
  const now = Date.now();

  if (!config.enabled) return; // 꺼져 있으면 아무것도 안 함

  const { activity, tags } = classify(event, payload);
  st.activity = activity;
  st.activity_ts = now;
  if (payload.session_id) st.session_id = String(payload.session_id).slice(0, 64);
  stateMod.ensureToday(st, now);
  if (tags.length && config.context_aware) stateMod.pushTags(st, tags, now);

  if (!stateMod.isPaused(st, now)) {
    engine.maybeRotate(st, config, now);
  }
  stateMod.save(st);
}

module.exports = { run };
