'use strict';
// 터미널 표시 폭 계산: CJK 전각 문자 = 2칸. ANSI 이스케이프는 0칸.

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function isWide(cp) {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK Radicals, punctuation
    (cp >= 0x3041 && cp <= 0x33ff) || // Kana, CJK symbols
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) || // Emoji blocks
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

function displayWidth(str) {
  const s = String(str).replace(ANSI_RE, '');
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue; // ZWJ, variation selectors
    if (cp >= 0x0300 && cp <= 0x036f) continue; // combining marks
    w += isWide(cp) ? 2 : 1;
  }
  return w;
}

// 표시 폭 기준으로 자르고 필요하면 말줄임 추가. ANSI 없는 문자열 전용.
function truncate(str, maxWidth, ellipsis = '…') {
  if (displayWidth(str) <= maxWidth) return str;
  const ew = displayWidth(ellipsis);
  let w = 0;
  let out = '';
  for (const ch of String(str)) {
    const cw = displayWidth(ch);
    if (w + cw > maxWidth - ew) break;
    out += ch;
    w += cw;
  }
  return out + ellipsis;
}

module.exports = { displayWidth, truncate };
