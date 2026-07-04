# cccat — Claude Code Cat

*(=^･ω･^=)* Claude Code가 생각하는 동안, 상태 표시줄에서 영어 한 스푼.

cccat은 Claude Code의 대기 시간(생각 중, 도구 실행 중, 응답 대기 등)을 한국 개발자를 위한
짧은 영어 학습 순간으로 바꿔주는 로컬 전용 오픈소스 도구입니다. 상태 표시줄에 애니메이션
카오모지 고양이가 나타나 지금 Claude Code가 뭘 하고 있는지 보여주고, 그 옆에 개발 현장에서
바로 쓰는 영어 표현을 한국어 뜻과 함께 띄워줍니다.

```
(=^･ω･^=) 대기 중  clean build — 캐시 없이 처음부터 다시 빌드하는 것
"Try a clean build before you file a bug." 버그 등록하기 전에 클린 빌드부터 한번 해보세요. · 오늘 3개

⠙ (=˘ω˘=)? 생각 중  clean build — 캐시 없이 처음부터 다시 빌드하는 것

∩(=^･ω･^=)∩ 성공!  cover the edge case — 엣지 케이스를 테스트로 커버하다
"Make sure to cover the edge case where the list is empty." · 오늘 5개
```

*(실제 Claude Code 2.1.201 / macOS / tmux 140x40에서 캡처, [docs/VERIFICATION.md](docs/VERIFICATION.md) 참고)*

## 왜 만들었나

Claude Code를 쓰다 보면 응답을 기다리는 짬이 자주 생깁니다. 그 몇 초를 스크롤이 아니라
`stage the changes`, `cover the edge case`, `clean build` 같은, 실제로 매일 쓰는 개발 영어
표현을 익히는 시간으로 바꿔보자는 아이디어입니다. 100% 로컬에서 동작하고, 네트워크 요청이
전혀 없으며, 프롬프트 원문이나 파일 내용은 절대 저장하지 않습니다.

## 요구사항

- Node.js **18 이상**
- Claude Code (2.1.201 / macOS에서 검증됨. 자세한 내용은 [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md))

## 설치

### 방법 1 — 저장소 클론

```sh
git clone https://github.com/dkdannyboy/cccat.git
cd cccat
node bin/cccat.js install
```

### 방법 2 — 전역 설치

```sh
git clone https://github.com/dkdannyboy/cccat.git
cd cccat
npm install -g .
cccat install
```

### 방법 3 — 한 줄 설치 스크립트

```sh
curl -fsSL https://raw.githubusercontent.com/dkdannyboy/cccat/main/scripts/install.sh | sh
```

`~/.cccat/app`에 저장소를 클론(또는 갱신)한 뒤 `cccat install`을 실행합니다.

설치 후 Claude Code를 재시작하면 상태 표시줄에 고양이가 나타납니다.

### install이 하는 일

- `~/.claude/settings.json`을 `~/.cccat/backup/`에 타임스탬프와 함께 백업
- 기존에 설정된 statusline이 있다면 절대 지우지 않고, **기존 출력이 항상 먼저 보이도록** wrapper
  셸 스크립트로 감싸고 그 아래에 cccat 줄을 추가
- `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `Notification`,
  `SubagentStart`, `SubagentStop`, `SessionStart`, `SessionEnd` — 총 10개 훅 이벤트 등록 (기존
  훅은 건드리지 않고 cccat 항목만 추가)
- statusline `refreshInterval`을 1초로 설정해 이벤트가 없어도 애니메이션이 계속 돌게 함
- 재설치해도 안전합니다(멱등) — 중복으로 줄이 추가되지 않습니다

## 사용법

설치 후에는 별도 명령 없이 자동으로 동작합니다. 상태 표시줄이 Claude Code가 지금 무슨 작업
중인지(생각 중/코드 읽는 중/작성 중/테스트 중/git 작업 중/에러 등)에 맞춰 고양이 표정과 영어
표현을 바꿔 보여줍니다. 약 25초(기본값)마다 표현이 바뀌고, 이전에 본 표현은 간격 반복
알고리즘에 따라 나중에 복습으로 다시 등장합니다.

설치 없이 미리보기만 하고 싶다면:

```sh
cccat demo thinking
```

## CLI 레퍼런스

| 명령 | 설명 |
|---|---|
| `cccat install` | Claude Code에 설치 (설정 자동 백업) |
| `cccat uninstall [--purge]` | 제거, 기존 statusline/훅 복원. `--purge`는 학습 데이터까지 삭제 |
| `cccat doctor` | 설치 상태, statusline, 훅 개수, 콘텐츠 로드 여부 진단 |
| `cccat adopt` | 자체 statusLine이 있는 프로젝트에서 실행 — 프로젝트 statusline과 공존 설정 (`.claude/settings.local.json` 사용, `settings.json`은 건드리지 않음) |
| `cccat unadopt` | adopt 해제 및 원상 복원 |
| `cccat on` / `cccat off` | 기능 켜기 / 끄기 |
| `cccat pause [분]` / `cccat resume` | 지정 시간(기본 30분) 일시 정지 / 즉시 재개 |
| `cccat config list` | 전체 설정 값 출력 |
| `cccat config get <key>` | 특정 설정 값 조회 |
| `cccat config set <key> <value>` | 설정 값 변경 |
| `cccat stats` | 오늘 본 표현 수, 누적 학습/마스터/저장 개수 |
| `cccat today` | 오늘 본 표현 전체 목록 |
| `cccat save` | 현재 표시 중인 표현을 저장 목록에 추가 |
| `cccat saved` | 저장한 표현 목록 |
| `cccat reset [--all]` | 학습 기록 초기화 (`--all`은 상태까지 초기화) |
| `cccat privacy` | 수집/미수집 항목과 저장 위치 안내 |
| `cccat demo [state]` | 설치 없이 렌더링 미리보기 (실제 회전 엔진 사용) |
| `cccat version` | 버전 출력 |

## 설정

`cccat config set <key> <value>`로 변경합니다. 기본값은 `lib/config.js`에 정의되어 있습니다.

| 키 | 기본값 | 설명 |
|---|---|---|
| `enabled` | `true` | 전체 켜기/끄기 |
| `show_character` | `true` | 고양이 표시 여부 |
| `show_animation` | `true` | 프레임 애니메이션 여부 |
| `show_english` | `true` | 영어 표현 표시 |
| `show_korean` | `true` | 한국어 뜻 표시 |
| `show_example` | `true` | 예문 줄 표시 (넓은 터미널에서만) |
| `quiz_ratio` | `0.2` | 이미 본 표현 중 빈칸 퀴즈로 낼 비율 (0~1) |
| `rotate_sec` | `30` | 표현을 바꾸는 최소 간격(초) |
| `refresh_sec` | `1` | 애니메이션 갱신 주기(초, 1~10). 변경 후 `cccat install` 재실행 필요 |
| `review_ratio` | `0.3` | 새 표현 대신 복습을 우선할 확률 (0~1) |
| `context_aware` | `true` | 최근 작업 맥락(파일 종류/명령어)에 맞는 표현 우선 선택 |
| `promo` | `true` | danielclass.com 안내 문구 표시 (하루 1회 이하) |
| `language` | `ko` | 설명 언어 (현재 `ko`만 지원) |
| `compact` | `false` | 강제로 1줄 모드 사용 |
| `difficulty_max` | `3` | 표시할 표현의 최대 난이도 (1~3) |

## 제거

```sh
cccat uninstall           # statusline/훅 복원, 학습 데이터는 보존
cccat uninstall --purge   # 위 작업 + ~/.cccat 전체 삭제
```

## 개인정보

100% 로컬, 네트워크 요청 0회입니다. 저장하는 것은 도구 종류, 파일 확장자, 명령 카테고리,
키워드로 매칭된 태그, 학습 기록뿐입니다. 프롬프트 원문, 파일 내용, 전체 경로, 환경변수,
비밀키는 절대 저장하지 않습니다. 자세한 내용은 [docs/PRIVACY.md](docs/PRIVACY.md) 또는
`cccat privacy` 명령을 참고하세요.

## FAQ

**Q. Claude Code 응답이 느려지나요?**
아니요. 훅은 stdin을 최대 800ms까지만 기다리고, 어떤 경우에도 실패 없이 조용히 종료합니다.
실제 측정된 wrapper 지연은 약 174ms입니다.

**Q. 이미 다른 statusline을 쓰고 있어요.**
설치 시 기존 statusline 명령을 감싸는 wrapper로 교체되며, 기존 출력이 항상 첫 줄에 그대로
나온 뒤 cccat 줄이 추가됩니다. 내용은 지워지지 않습니다.

**Q. 프로젝트별 `.claude/settings.json`에 statusline이 따로 설정되어 있어요.**
프로젝트 설정이 사용자 설정보다 우선하므로, 그 프로젝트에서는 cccat이 보이지 않습니다.

**Q. 영어 말고 다른 설명 언어도 되나요?**
아직은 한국어 설명만 지원합니다. 로드맵은 [FUTURE.md](FUTURE.md) 참고.

**Q. 내 표현을 추가할 수 있나요?**
`~/.cccat/packs/*.json`에 사용자 팩을 추가하면 코어 팩과 함께 로드됩니다. 스키마는
[docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)를 참고하세요.

## 라이선스

MIT — [LICENSE](LICENSE)
