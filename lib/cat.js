'use strict';
// cccat 캐릭터: 터미널 호환 가능한 카오모지 고양이.
// 애니메이션은 statusline 재호출 시각 기반으로 프레임을 선택한다.

const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// 포즈 어휘: 상태마다 몸짓(팔/꼬리/소품)이 다르게 보이도록 프레임을 구성한다.
// 좌우로 팔을 뻗는 댄스, 만세(flex), 앞발 모으기(ฅ) 등을 상태 성격에 맞게 배치.
const STATES = {
  idle: {
    label: '대기 중',
    frames: [
      '(=^･ω･^=)',
      '(=^-ω-^=)',   // 눈 깜빡
      '(=^･ω･^=)ﾉ', // 살짝 인사
      '(=^･ω<^=)☆', // 윙크
      '(=^･ω･^=)~',  // 꼬리 살랑
      '(=^-ω-^=)',
    ],
    spin: false,
  },
  thinking: {
    label: '생각 중',
    frames: ['(=˘ω˘=)?', '(=˘ω˘=)‥', '(=˘ω˘=)…', '(=¬ω¬=)…', '(=˘ω˘=)!'],
    spin: true,
  },
  reading: {
    label: '읽는 중',
    frames: ['(=φωφ=)♪', '(=φωφ=)♫', '(=φωφ=)⋯', '(=◕ω◕=)♪'],
    spin: true,
  },
  writing: {
    label: '코드 작성 중',
    frames: ['(=✧ω✧=)✎', '(=✧ω✧=)✐', 'ฅ(=✧ω✧=)✎', '(=｀ω´=)✎ﾞ'],
    spin: true,
  },
  running: {
    label: '명령 실행 중',
    frames: ['ᕕ(=･ω･=)ᕗ', 'ᕙ(=･ω･=)ᕤ', 'ᕕ(=^ω^=)ᕗ', 'ε=(=･ω･=)ﾉ'],
    spin: true,
  },
  searching: {
    label: '검색 중',
    frames: ['(=◉ω◉=)⌕', '(=◎ω◎=)⌕', 'ฅ(=◉ω◉=)⌕', '(=◉ω◉=)⌕?'],
    spin: true,
  },
  testing: {
    label: '테스트 중',
    frames: ['(=•̀ω•́=)✓', '(=•̀ω•́=)✗', '(=•̀ω•́=)✓', '(=◕ω◕=)✓✓', '(=•̀ω•́=)?'],
    spin: true,
  },
  building: {
    label: '빌드 중',
    frames: ['(=｀ω´=)⚒', '(=｀ω´=)⚙', '(=•̀ω•́=)⚒ﾞ', 'ฅ(=｀ω´=)⚙'],
    spin: true,
  },
  git: {
    label: 'Git 작업 중',
    frames: ['(=･ω･=)⎇', '(=･ω<=)⎇', 'ฅ(=･ω･=)⎇', '(=^ω^=)⎇✓'],
    spin: true,
  },
  agent: {
    label: '에이전트 작업 중',
    frames: ['(=^･ω･^=)ノ彡', '(=^･ω･^=)ノ~', 'ヾ(=^･ω･^=)ノ彡', '(=^･ω･^=)ﾉ☆'],
    spin: true,
  },
  error: {
    label: '문제 발생',
    frames: ['(=；ω；=)!', '(=˃̣̣̥ω˂̣̣̥=)!', '(=TωT=)…', '(=；ω；=)?'],
    spin: false,
  },
  success: {
    label: '성공!',
    // 좌우 댄스 → 만세 → 반짝: 축하 시퀀스
    frames: ['ヽ(=^･ω･^=)ﾉ', '＜(=^ω^=)＞', '∩(=^･ω･^=)∩', '~(=^ω^=)~', 'ヾ(=^ω^=)ﾉ☆'],
    spin: false,
  },
  waiting: {
    label: '입력 대기',
    frames: ['(=^･ω･^=)ゞ', '(=^･ω･^=)?', 'ฅ(=^･ω･^=)ฅ', '(=◕ω◕=)?'],
    spin: false,
  },
  sleeping: {
    label: '쉬는 중',
    frames: ['(=－ω－=)zZ', '(=－ω－=)Zz', '(=￣ω￣=)zzZ', '(=－ω－=)zz'],
    spin: false,
  },
  done: {
    label: '세션 완료',
    frames: ['(=^･ω･^=)b', 'ヽ(=^･ω･^=)ﾉ', '∠(=^ω^=)ゞ', 'ヾ(=^ω^=)ﾉ☆'],
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

// 상태 라벨의 언어별 번역 (STATES.label 은 한국어 기본값)
const LABELS = {
  ja: {
    idle: '待機中', thinking: '考え中', reading: '読み込み中', writing: 'コード作成中',
    running: 'コマンド実行中', searching: '検索中', testing: 'テスト中', building: 'ビルド中',
    git: 'Git作業中', agent: 'エージェント作業中', error: '問題発生', success: '成功！',
    waiting: '入力待ち', sleeping: '休憩中', done: 'セッション完了',
  },
};

function label(stateName, lang) {
  const n = normalizeState(stateName);
  return (lang && LABELS[lang] && LABELS[lang][n]) || STATES[n].label;
}

module.exports = { STATES, LABELS, frame, label, normalizeState };
