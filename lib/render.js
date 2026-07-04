'use strict';
// statusline 출력 렌더링. 1~2줄, 터미널 폭 존중, ANSI 색상.
const cat = require('./cat');
const contentMod = require('./content');
const { displayWidth, truncate } = require('./width');

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
  magenta: '\x1b[35m', gray: '\x1b[90m', white: '\x1b[37m',
};

const QUIZ_REVEAL_MS = 12000;

// 퀴즈용 빈칸: 가장 긴 단어의 속을 가린다
function blankOut(en) {
  const words = en.split(/\s+/);
  let idx = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i].replace(/[^a-zA-Z]/g, '').length > words[idx].replace(/[^a-zA-Z]/g, '').length) idx = i;
  }
  const w = words[idx];
  // 앞뒤 문장부호는 그대로 두고 알파벳 몸통만 가린다.
  // (예: "O(n squared)" 에서 닫는 괄호가 정답 힌트로 새지 않도록)
  const m = w.match(/^([^a-zA-Z]*)([a-zA-Z][a-zA-Z-]*[a-zA-Z]|[a-zA-Z]+)([^a-zA-Z]*)$/);
  if (!m) return { text: en, word: null };
  const [, lead, core, trail] = m;
  const letters = core.replace(/[^a-zA-Z]/g, '');
  if (letters.length <= 3) return { text: en, word: null }; // 너무 짧은 단어는 퀴즈 무의미
  words[idx] = lead + core[0] + '＿'.repeat(Math.min(letters.length - 2, 4)) + core[core.length - 1] + trail;
  return { text: words.join(' '), word: w };
}

/**
 * @returns {string[]} 출력 줄 배열 (0~2줄 + 프로모 시 3줄까지)
 */
function render(st, config, opts = {}) {
  const now = opts.now || Date.now();
  const width = opts.width || Number(process.env.COLUMNS) || 100;
  const lines = [];

  if (!config.enabled) return lines;

  const paused = st.paused_until && now < st.paused_until;
  const idleMs = now - (st.activity_ts || 0);
  let activity = st.activity || 'idle';
  if (paused) activity = 'sleeping';
  else if (idleMs > 10 * 60 * 1000) activity = 'sleeping';

  // ── 1줄: 고양이 + 상태 + 표현 ──
  let head = '';
  if (config.show_character) {
    const face = cat.frame(activity, now, config.show_animation);
    head = `${C.cyan}${face}${C.reset} ${C.gray}${cat.label(activity)}${C.reset}`;
  }

  const item = st.current && contentMod.byId(st.current.id);
  let exprPart = '';
  let exampleLine = '';

  if (item && !paused) {
    const isQuiz = st.current.mode === 'quiz' && now - st.current.shown_at < QUIZ_REVEAL_MS;
    let en = item.en;
    let quizMark = '';
    if (isQuiz && config.show_english) {
      const b = blankOut(item.en);
      if (b.word) { en = b.text; quizMark = `${C.yellow}Q${C.reset} `; }
    }
    const revMark = st.current.is_review ? `${C.magenta}↻${C.reset} ` : '';
    const enPart = config.show_english ? `${C.bold}${C.green}${en}${C.reset}` : '';
    const koPart = config.show_korean ? `${C.white}${item.ko}${C.reset}` : '';
    const sep = enPart && koPart ? `${C.gray} — ${C.reset}` : '';
    exprPart = `${quizMark}${revMark}${enPart}${sep}${koPart}`;

    if (config.show_example && item.example && !isQuiz) {
      const ex = item.example_ko && width >= 110
        ? `“${item.example}” ${item.example_ko}`
        : `“${item.example}”`;
      exampleLine = `${C.dim}${truncate(ex, width - 12)}${C.reset}`;
    }
    if (isQuiz) {
      exampleLine = `${C.dim}빈칸에 들어갈 말은? 잠시 후 공개됩니다${C.reset}`;
    }
    if (item.nuance && !isQuiz && config.show_example && width >= 110 && !item.example) {
      exampleLine = `${C.dim}${truncate(item.nuance, width - 12)}${C.reset}`;
    }
  }

  const compact = config.compact || width < 70;
  const gap = head && exprPart ? '  ' : '';
  let line1 = `${head}${gap}${exprPart}`;
  if (displayWidth(line1) > width && config.show_character) {
    // 1차: 상태 라벨 제거
    const face = cat.frame(activity, now, config.show_animation);
    head = `${C.cyan}${face}${C.reset}`;
    line1 = `${head}  ${exprPart}`;
  }
  if (displayWidth(line1) > width && item) {
    // 2차: 표현 자체를 폭에 맞게 잘라냄 (색상 코드 없이 재구성)
    const headW = displayWidth(head) + 2;
    const plain = truncate(
      `${config.show_english ? item.en : ''}${config.show_english && config.show_korean ? ' — ' : ''}${config.show_korean ? item.ko : ''}`,
      Math.max(10, width - headW)
    );
    line1 = `${head}  ${C.green}${plain}${C.reset}`;
  }
  if (line1.trim()) lines.push(line1);

  // ── 2줄: 예문 + 오늘 카운터 (카운터 폭까지 포함해 잘라냄) ──
  if (!compact && exampleLine) {
    const counterText = st.today && st.today.shown
      ? ` · 오늘 ${st.today.shown}개${st.today.review ? ` (복습 ${st.today.review})` : ''}`
      : '';
    const counter = counterText ? `${C.gray}${counterText}${C.reset}` : '';
    const room = width - 2 - displayWidth(counterText);
    if (displayWidth(exampleLine) > room) {
      // exampleLine은 dim 래핑된 단일 문자열 — ANSI 제거 후 재구성
      const plainEx = exampleLine.replace(/\x1b\[[0-9;]*m/g, '');
      exampleLine = `${C.dim}${truncate(plainEx, Math.max(10, room))}${C.reset}`;
    }
    lines.push(`  ${exampleLine}${counter}`);
  }

  // ── 프로모 (하루 1회 이하) ──
  if (opts.promoMessage && !compact) {
    lines.push(`  ${C.dim}${C.magenta}♥${C.reset}${C.dim} ${opts.promoMessage}${C.reset}`);
  }

  return lines;
}

module.exports = { render, blankOut, QUIZ_REVEAL_MS };
