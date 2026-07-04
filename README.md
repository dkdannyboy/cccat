<div align="center">

# `(=^･ω･^=)` cccat — Claude Code Cat

**Claude Code가 생각하는 동안, 상태 표시줄에서 영어 한 스푼.**

[![test](https://github.com/dkdannyboy/cccat/actions/workflows/test.yml/badge.svg)](https://github.com/dkdannyboy/cccat/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)
[![local-first](https://img.shields.io/badge/network-zero%20requests-success.svg)](docs/PRIVACY.md)
[![content](https://img.shields.io/badge/expressions-180-orange.svg)](content/pack-core.json)

</div>

cccat은 Claude Code의 대기 시간(생각 중, 도구 실행 중, 응답 대기 등)을 한국 개발자를 위한
짧은 영어 학습 순간으로 바꿔주는 로컬 전용 오픈소스 도구입니다. 상태 표시줄에 애니메이션
카오모지 고양이가 나타나 지금 Claude Code가 뭘 하고 있는지 보여주고, 그 옆에 개발 현장에서
바로 쓰는 영어 표현을 한국어 뜻과 함께 띄워줍니다.

```text
(=^･ω･^=) 대기 중       clean build — 캐시 없이 처음부터 다시 빌드하는 것
                       "Try a clean build before you file a bug."
                       버그 등록하기 전에 클린 빌드부터 한번 해보세요.  · 오늘 3개

⠙ (=˘ω˘=)? 생각 중      sanitize the input — 입력값을 정제(살균)하다
                       "Always sanitize the input before rendering it on the page."

∩(=^･ω･^=)∩ 성공!       cover the edge case — 엣지 케이스를 테스트로 커버하다
                       "Make sure to cover the edge case where the list is empty."  · 오늘 5개
```

<sub>실제 Claude Code 2.1.201 / macOS / tmux에서 캡처한 화면입니다 — [docs/VERIFICATION.md](docs/VERIFICATION.md) 참고. 터미널에서는 상태에 따라 고양이 표정과 스피너가 실시간으로 움직입니다.</sub>

## 목차

- [왜 만들었나](#왜-만들었나)
- [3초 요약](#3초-요약)
- [요구사항](#요구사항)
- [설치](#설치)
- [자체 statusline이 있는 프로젝트](#자체-statusline이-있는-프로젝트)
- [사용법](#사용법)
- [CLI 레퍼런스](#cli-레퍼런스)
- [설정](#설정)
- [제거](#제거)
- [개인정보](#개인정보)
- [FAQ](#faq)
- [문서](#문서)
- [라이선스](#라이선스)

## 3초 요약

| | |
|---|---|
| 🐱 **캐릭터** | Claude 작업 상태(생각/읽기/작성/테스트/git/에러/성공…)에 맞춰 표정이 바뀌는 애니메이션 고양이 |
| 🇰🇷 **한국어 설명** | 개발 현장에서 바로 쓰는 영어 표현 + 자연스러운 한국어 뜻 + 예문 |
| 🎯 **맥락 기반** | 지금 하는 작업(파일 종류, 명령어)에 맞는 표현을 우선 선택 |
| 🔁 **복습** | 간격 반복 알고리즘으로 예전 표현을 적절한 시점에 다시 노출 |
| 🔒 **로컬 전용** | 네트워크 요청 0회. 프롬프트·파일 내용은 저장하지 않음 |
| 🆓 **무료/오픈소스** | 계정·결제·서버 없음. MIT 라이선스 |

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
  셸 스크립트로 감싸고 그 아래에 cccat 줄을 추가 (기존 statusline 출력은 5초 캐시로 보호)
- `UserPromptSubmit`, `PreToolUse`, `PostToolUseFailure`, `Stop`, `Notification`,
  `SubagentStart`, `SubagentStop`, `SessionStart`, `SessionEnd` — 총 9개 훅 이벤트 등록 (기존
  훅은 건드리지 않고 cccat 항목만 추가). 성능을 위해 매 도구 호출마다 발생하는 `PostToolUse`는
  등록하지 않고, `PreToolUse`는 2초 스로틀로 불필요한 실행을 생략합니다
- statusline `refreshInterval`(기본 1초)을 설정해 이벤트가 없어도 애니메이션이 계속 돌게 함.
  애니메이션을 끄면(`config show_animation false`) 타이머 없이 이벤트 기반으로만 갱신됩니다
- 실행 시점에 `node`를 찾는 런처를 두어, 나중에 Node를 업그레이드해도 훅이 깨지지 않습니다
- 재설치해도 안전합니다(멱등) — 중복으로 줄이 추가되지 않습니다

## 자체 statusline이 있는 프로젝트

일부 프로젝트는 `.claude/settings.json`에 자체 statusline을 정의합니다. 프로젝트 설정이
사용자 설정보다 우선하므로, 그런 프로젝트 안에서는 cccat이 가려집니다. 해당 프로젝트
디렉터리에서 **한 번만** 다음을 실행하면 공존시킬 수 있습니다.

```sh
cccat adopt      # 프로젝트 statusline + cccat 줄을 함께 표시
cccat unadopt    # 원상 복원
```

`adopt`는 git에 커밋되지 않는 `.claude/settings.local.json`에만 설정을 추가하고, 팀이 공유하는
`.claude/settings.json`은 절대 건드리지 않습니다. `cccat doctor`가 이 상황을 감지하면 알려줍니다.

## 사용법

설치 후에는 별도 명령 없이 자동으로 동작합니다. 상태 표시줄이 Claude Code가 지금 무슨 작업
중인지(생각 중/코드 읽는 중/작성 중/테스트 중/git 작업 중/에러 등)에 맞춰 고양이 표정과 영어
표현을 바꿔 보여줍니다. 약 30초(기본값)마다 표현이 바뀌고, 이전에 본 표현은 간격 반복
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
체감되지 않는 수준입니다. 도구 호출당 `PreToolUse` 훅이 약 80ms를 더하고(대부분 Node
콜드스타트), 연속 호출 시에는 2초 스로틀로 그마저 생략합니다. 훅은 어떤 경우에도 실패 없이
조용히 종료하도록 설계되어 Claude Code 작업을 막지 않습니다.

**Q. 배터리/CPU를 많이 쓰나요?**
애니메이션을 위해 statusline이 `refresh_sec`(기본 1초)마다 재실행됩니다(호출당 약 0.1초 CPU).
줄이려면 `cccat config set refresh_sec 3` 또는 `cccat config set show_animation false` 후
`cccat install`을 다시 실행하세요. 후자는 타이머를 완전히 제거해 유휴 시 비용이 0이 됩니다.

**Q. 표현이 모자라지 않나요? AI가 실시간으로 생성하나요?**
설치 즉시 검수된 180개 표현이 로컬에 들어 있어, 외부 API 없이도 바로 동작합니다. 실시간
LLM 호출은 하지 않습니다(그래서 네트워크 0회, 비용 0). 내 표현을 추가하려면 아래 참고.

**Q. 이미 다른 statusline을 쓰고 있어요.**
설치 시 기존 statusline 명령을 감싸는 wrapper로 교체되며, 기존 출력이 항상 첫 줄에 그대로
나온 뒤 cccat 줄이 추가됩니다. 내용은 지워지지 않습니다.

**Q. 프로젝트별 `.claude/settings.json`에 statusline이 따로 설정되어 있어요.**
그 프로젝트 디렉터리에서 `cccat adopt`를 한 번 실행하면 공존시킬 수 있습니다.
[자체 statusline이 있는 프로젝트](#자체-statusline이-있는-프로젝트) 참고.

**Q. 영어 말고 다른 설명 언어도 되나요?**
아직은 한국어 설명만 지원합니다. 로드맵은 [FUTURE.md](FUTURE.md) 참고.

**Q. 내 표현을 추가할 수 있나요?**
`~/.cccat/packs/*.json`에 사용자 팩을 추가하면 코어 팩과 함께 로드됩니다. 스키마는
[docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)를 참고하세요.

## 문서

| 문서 | 내용 |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 데이터 흐름, 모듈 구조, 설계 결정 |
| [CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | 콘텐츠 스키마, 태그 체계, 사용자 팩 작성법 |
| [PRIVACY.md](docs/PRIVACY.md) | 수집/미수집 항목, 저장 위치, 삭제 방법 |
| [COMPATIBILITY.md](docs/COMPATIBILITY.md) | 지원/미지원 환경 |
| [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | 알려진 한계 |
| [VERIFICATION.md](docs/VERIFICATION.md) | 실제 Claude Code 검증 기록 |
| [FUTURE.md](FUTURE.md) | 향후 로드맵 |

## 기여

버그 제보와 표현 제안 환영합니다. 이슈나 PR을 열어 주세요. 테스트는 `node --test 'test/**/*.test.js'`로
실행하며, PR은 CI(Node 18/20/22 × Linux/macOS)를 통과해야 합니다.

## 라이선스

MIT — [LICENSE](LICENSE)
