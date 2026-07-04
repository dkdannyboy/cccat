'use strict';
// cccat 캐릭터: 터미널 호환 가능한 카오모지 고양이.
// 애니메이션은 statusline 재호출 시각 기반으로 프레임을 선택한다.

const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const STATES = {
  idle: {
    label: '대기 중',
    frames: ['(=^･ω･^=)', '(=^-ω-^=)', '(=^･ω･^=)', '(=^･ω<^=)'],
    spin: false,
  },
  thinking: {
    label: '생각 중',
    frames: ['(=˘ω˘=)?', '(=˘ω˘=)‥', '(=˘ω˘=)…', '(=˘ω˘=)!'],
    spin: true,
  },
  reading: {
    label: '읽는 중',
    frames: ['(=φωφ=)♪', '(=φωφ=)♫'],
    spin: true,
  },
  writing: {
    label: '코드 작성 중',
    frames: ['(=✧ω✧=)✎', '(=✧ω✧=)✐'],
    spin: true,
  },
  running: {
    label: '명령 실행 중',
    frames: ['ᕕ(=･ω･=)ᕗ', 'ᕙ(=･ω･=)ᕤ'],
    spin: true,
  },
  searching: {
    label: '검색 중',
    frames: ['(=◉ω◉=)⌕', '(=◎ω◎=)⌕'],
    spin: true,
  },
  testing: {
    label: '테스트 중',
    frames: ['(=•̀ω•́=)✓', '(=•̀ω•́=)✗', '(=•̀ω•́=)✓', '(=•̀ω•́=)?'],
    spin: true,
  },
  building: {
    label: '빌드 중',
    frames: ['(=｀ω´=)⚒', '(=｀ω´=)🔧'.replace('🔧', '⚙')],
    spin: true,
  },
  git: {
    label: 'Git 작업 중',
    frames: ['(=･ω･=)⎇', '(=･ω<=)⎇'],
    spin: true,
  },
  agent: {
    label: '에이전트 작업 중',
    frames: ['(=^･ω･^=)ノ彡', '(=^･ω･^=)ノ~'],
    spin: true,
  },
  error: {
    label: '문제 발생',
    frames: ['(=；ω；=)!', '(=˃̣̣̥ω˂̣̣̥=)!'],
    spin: false,
  },
  success: {
    label: '성공!',
    frames: ['ヽ(=^･ω･^=)ﾉ', '∩(=^･ω･^=)∩'],
    spin: false,
  },
  waiting: {
    label: '입력 대기',
    frames: ['(=^･ω･^=)ゞ', '(=^･ω･^=)?'],
    spin: false,
  },
  sleeping: {
    label: '쉬는 중',
    frames: ['(=－ω－=)zZ', '(=－ω－=)Zz', '(=－ω－=)zz'],
    spin: false,
  },
  done: {
    label: '세션 완료',
    frames: ['(=^･ω･^=)b', 'ヽ(=^･ω･^=)ﾉ'],
    spin: false,
  },
};

// state 이름 검증 및 폴백
function normalizeState(name) {
  return STATES[name] ? name : 'idle';
}

// now(ms) 기반 프레임 선택 — statusline이 재호출될 때마다 다른 프레임이 나온다.
function frame(stateName, now = Date.now(), animate = true) {
  const st = STATES[normalizeState(stateName)];
  const idx = animate ? Math.floor(now / 700) % st.frames.length : 0;
  let out = st.frames[idx];
  if (st.spin && animate) {
    out = SPIN[Math.floor(now / 120) % SPIN.length] + ' ' + out;
  }
  return out;
}

function label(stateName) {
  return STATES[normalizeState(stateName)].label;
}

module.exports = { STATES, frame, label, normalizeState };
