'use strict';
// 원자적 JSON 읽기/쓰기. 실패해도 절대 throw로 Claude Code를 방해하지 않는 안전 계층.
const fs = require('fs');
const path = require('path');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

// 프로세스 간 간단한 뮤텍스 (mkdir 원자성 이용).
// 여러 Claude Code 세션이 state/history를 동시에 read-modify-write 할 때
// 갱신 유실을 막는다. 획득 실패 시 { ok: false } — 호출자는 이번 갱신을 건너뛴다.
function withLock(lockDir, fn, opts = {}) {
  const timeoutMs = opts.timeoutMs || 1000;
  const staleMs = opts.staleMs || 3000;
  const t0 = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lockDir, { recursive: false });
      break;
    } catch {
      try {
        const st = fs.statSync(lockDir);
        if (Date.now() - st.mtimeMs > staleMs) { // 죽은 프로세스의 잔류 락
          try { fs.rmdirSync(lockDir); } catch { /* 경합 — 다음 루프 */ }
          continue;
        }
      } catch { continue; } // 락이 방금 해제됨 — 재시도
      if (Date.now() - t0 > timeoutMs) return { ok: false };
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); // 20ms 동기 대기
    }
  }
  try {
    return { ok: true, value: fn() };
  } finally {
    try { fs.rmdirSync(lockDir); } catch { /* 이미 해제됨 */ }
  }
}

module.exports = { readJson, writeJson, withLock };
