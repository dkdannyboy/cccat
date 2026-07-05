'use strict';
const paths = require('./paths');
const { readJson, writeJson } = require('./store');

const DEFAULTS = {
  enabled: true,            // 전체 켜기/끄기
  show_character: true,     // 고양이 표시
  show_animation: true,     // 애니메이션(프레임 전환)
  show_english: true,       // 영어 표현 표시
  show_korean: true,        // 한국어 뜻 표시
  show_example: true,       // 예문 줄 표시
  quiz_ratio: 0.2,          // 빈칸 퀴즈 비율 (0~1)
  rotate_sec: 30,           // 표현 교체 최소 간격(초)
  refresh_sec: 1,           // statusline 애니메이션 갱신 주기(초, 1~10) — 변경 후 재설치 필요
  review_ratio: 0.3,        // 복습 항목 비율 (0~1)
  context_aware: true,      // 작업 맥락 기반 선택
  promo: true,              // danielclass.com 안내 (하루 1회 이하)
  language: 'ko',           // 설명 언어 (현재 ko만 지원)
  compact: false,           // 강제 컴팩트 모드(1줄)
  difficulty_max: 3,        // 표시할 최대 난이도
};

function load() {
  const user = readJson(paths.configFile(), {});
  return { ...DEFAULTS, ...user };
}

function save(cfg) {
  // 기본값과 같은 키도 그대로 저장(사용자가 명시한 값 유지)
  return writeJson(paths.configFile(), cfg);
}

function set(key, value) {
  if (!(key in DEFAULTS)) return { ok: false, error: `unknown key: ${key}` };
  const cur = load();
  const def = DEFAULTS[key];
  let v = value;
  if (typeof def === 'boolean') {
    if (['true', 'on', '1', 'yes'].includes(String(value).toLowerCase())) v = true;
    else if (['false', 'off', '0', 'no'].includes(String(value).toLowerCase())) v = false;
    else return { ok: false, error: `expected true/false for ${key}` };
  } else if (typeof def === 'number') {
    v = Number(value);
    if (!Number.isFinite(v)) return { ok: false, error: `expected number for ${key}` };
  }
  if (key === 'language') {
    const supported = require('./content').availableLanguages();
    if (!supported.includes(String(v))) {
      return { ok: false, error: `unsupported language: ${v} (지원: ${supported.join(', ')})` };
    }
  }
  cur[key] = v;
  save(cur);
  return { ok: true, value: v };
}

module.exports = { DEFAULTS, load, save, set };
