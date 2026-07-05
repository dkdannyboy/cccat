'use strict';
// 스크린샷용: 특정 언어/상태의 status line 2줄을 실제 렌더 엔진으로 출력한다.
// 사용법: node scripts/shot.js <lang> <state> <itemId>
// 애니메이션 프레임은 고정(대표 프레임)해서 정적 이미지에 적합하게 만든다.
const path = require('path');
process.env.CCCAT_HOME = process.env.CCCAT_HOME || path.join(require('os').tmpdir(), 'cccat-shot-home');
const { render } = require('../lib/render');
const configMod = require('../lib/config');
const content = require('../lib/content');

const [, , lang = 'ja', state = 'thinking', itemId] = process.argv;
const cfg = { ...configMod.DEFAULTS, language: lang, show_animation: false };
const item = itemId ? content.byId(itemId, lang) : content.loadAll(lang)[0];
const st = {
  activity: state, activity_ts: Date.now(),
  current: { id: item.id, shown_at: Date.now(), mode: 'learn', is_review: false },
  today: { date: 'x', shown: Number(process.env.SHOT_COUNT || 3), review: 1 },
  recent_ids: [], recent_tags: [],
};
// 고정 시각으로 프레임 결정(대표 프레임)
const now = 300; // frame idx 0 근처
process.stdout.write(render(st, cfg, { now, width: 96 }).join('\n') + '\n');
