'use strict';
// 스크린샷용 HTML 생성: 여러 상태의 status line을 터미널 스타일 HTML로 렌더한다.
// CJK(한국어/일본어)는 브라우저 폰트 폴백으로 정확히 그려진다.
// 사용법: node scripts/shot-html.js <lang> > out.html
const path = require('path');
process.env.CCCAT_HOME = path.join(require('os').tmpdir(), 'cccat-shot-home-html');
const cat = require('../lib/cat');
const content = require('../lib/content');

const lang = process.argv[2] || 'ja';

// 대표 상태 + 대표 표현 (실제 렌더 엔진의 색상 규칙을 그대로 반영)
const scenes = [
  { state: 'thinking', id: 'dbg-trace-issue-to-source', shown: 1 },
  { state: 'git', id: 'git-rebase-onto-main', shown: 2 },
  { state: 'testing', id: 'tst-cover-edge-case', shown: 3 },
  { state: 'success', id: 'sec-sanitize-the-input', shown: 4 },
];

const COUNTER = { ko: { today: '오늘', unit: '개', review: '복습' }, ja: { today: '今日', unit: '個', review: '復習' } };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function line(scene) {
  const it = content.byId(scene.id, lang);
  const face = cat.frame(scene.state, 300, false); // 대표 프레임(정적)
  const label = cat.label(scene.state, lang);
  const c = COUNTER[lang] || COUNTER.ko;
  const counter = ` · ${c.today} ${scene.shown}${c.unit} (${c.review} 1)`;
  return `<div class="row">` +
    `<span class="cat">${esc(face)}</span> <span class="dim">${esc(label)}</span>  ` +
    `<span class="en">${esc(it.en)}</span><span class="dim"> — </span><span class="mean">${esc(it.meaning)}</span>` +
    `</div>` +
    `<div class="row ex"><span class="q">“${esc(it.example)}”</span><span class="dim">${esc(counter)}</span></div>` +
    `<div class="gap"></div>`;
}

const body = scenes.map(line).join('\n');
process.stdout.write(`<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: transparent; }
  .term {
    display: inline-block;
    background: #1a1b26;
    border: 1px solid #33467c;
    border-radius: 12px;
    padding: 26px 30px 20px;
    font-family: "Menlo", "SF Mono", "Hiragino Sans", "Apple SD Gothic Neo", monospace;
    font-size: 16px;
    line-height: 1.55;
    letter-spacing: 0.2px;
    white-space: nowrap;
  }
  .titlebar { margin-bottom: 18px; }
  .titlebar span { display: inline-block; width: 13px; height: 13px; border-radius: 50%; margin-right: 8px; }
  .b1 { background: #ff5f56; } .b2 { background: #ffbd2e; } .b3 { background: #27c93f; }
  .cat { color: #56b6c2; font-weight: 600; }
  .en { color: #43d17a; font-weight: 700; }
  .mean { color: #c8ccd4; }
  .dim { color: #6b7089; }
  .ex { color: #565a73; font-size: 15px; }
  .ex .q { color: #565a73; }
  .row { }
  .gap { height: 14px; }
  .gap:last-child { height: 0; }
</style></head><body>
  <div class="term">
    <div class="titlebar"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>
    ${body}
  </div>
</body></html>`);
