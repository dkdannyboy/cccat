<div align="center">

# `(=^･ω･^=)` cccat — Claude Code Cat

**A spoonful of English in your status line, while Claude Code thinks.**

**English** · [한국어](README.ko.md)

[![test](https://github.com/dkdannyboy/cccat/actions/workflows/test.yml/badge.svg)](https://github.com/dkdannyboy/cccat/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)
[![local-first](https://img.shields.io/badge/network-zero%20requests-success.svg)](docs/PRIVACY.md)
[![content](https://img.shields.io/badge/expressions-240%2B-orange.svg)](content/pack-core.json)
[![languages](https://img.shields.io/badge/explanations-KO%20%7C%20JA-ff69b4.svg)](#explanation-languages)

</div>

cccat turns Claude Code's idle moments — thinking, running tools, waiting for a response — into
tiny English-learning moments for developers whose first language isn't English. An animated
kaomoji cat sits in your status line reflecting what Claude Code is doing, and next to it shows
a practical English expression from real dev work, explained **in your own language**.

Explanations currently ship in **Korean** and **Japanese**, and the design makes adding more
languages a matter of dropping in one overlay file — the English expressions stay shared.

```text
(=^･ω･^=) idle          clean build — 캐시 없이 처음부터 다시 빌드하는 것
                        "Try a clean build before you file a bug."

⠙ (=˘ω˘=)? thinking      sanitize the input — 入力値をサニタイズする
                        "Always sanitize the input before rendering it on the page."

∩(=^･ω･^=)∩ success!     cover the edge case — 엣지 케이스를 테스트로 커버하다
                        "Make sure to cover the edge case where the list is empty."  · 5 today
```

<sub>Captured in a real Claude Code 2.1.201 / macOS / tmux session — see [docs/VERIFICATION.md](docs/VERIFICATION.md).
The cat's face and spinner animate in real time as Claude Code's activity changes. The two lines
above show Korean and Japanese explanations side by side; you pick one language at a time.</sub>

## Table of contents

- [Why](#why)
- [At a glance](#at-a-glance)
- [Requirements](#requirements)
- [Install](#install)
- [Explanation languages](#explanation-languages)
- [Projects with their own status line](#projects-with-their-own-status-line)
- [Usage](#usage)
- [CLI reference](#cli-reference)
- [Configuration](#configuration)
- [Uninstall](#uninstall)
- [Privacy](#privacy)
- [FAQ](#faq)
- [Docs](#docs)
- [License](#license)

## Why

Using Claude Code, you spend a lot of little moments waiting for a response. The idea is to turn
those few seconds into learning real, everyday developer English — expressions like
`stage the changes`, `cover the edge case`, `clean build` — instead of scrolling away. It runs
100% locally, makes zero network requests, and never stores your prompts or file contents.

## At a glance

| | |
|---|---|
| 🐱 **Character** | An animated cat whose face changes with Claude's activity (thinking / reading / writing / testing / git / error / success …) |
| 🌐 **Native-language explanations** | Practical English expressions + a natural explanation in your language + example. Korean & Japanese today |
| 🎯 **Context-aware** | Prefers expressions related to what you're doing right now (file types, commands) |
| 🔁 **Spaced review** | Resurfaces older expressions at the right time via a spaced-repetition schedule |
| 🔒 **Local-first** | Zero network requests. Prompts and file contents are never stored |
| 🆓 **Free / open source** | No account, no payment, no server. MIT licensed |

## Requirements

- Node.js **18+** (`npx` ships with Node)
- Claude Code (verified on 2.1.201 / macOS — see [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md))

## Install

### Option 1 — npx (easiest, nothing to clone)

```sh
npx github:dkdannyboy/cccat install
```

One line, no clone and no global install. Remove later with `npx github:dkdannyboy/cccat uninstall`.

### Option 2 — one-line install script

```sh
curl -fsSL https://raw.githubusercontent.com/dkdannyboy/cccat/main/scripts/install.sh | sh
```

Clones (or updates) the repo into `~/.cccat/app` and runs `cccat install`.

### Option 3 — clone (for development / contributing)

```sh
git clone https://github.com/dkdannyboy/cccat.git
cd cccat
node bin/cccat.js install     # or: npm install -g . && cccat install
```

Restart Claude Code after installing and the cat appears in your status line.

### What `install` does

- Backs up `~/.claude/settings.json` to `~/.cccat/backup/` with a timestamp
- Copies its own source into `~/.cccat/app` so hooks reference a stable path (an npx cache path
  would otherwise break once cleaned)
- If you already have a status line, it is **never removed** — cccat wraps it so your existing
  output always shows first, with the cccat lines below it (your original output is cached for 5s)
- Registers **9** hook events (`UserPromptSubmit`, `PreToolUse`, `PostToolUseFailure`, `Stop`,
  `Notification`, `SubagentStart`, `SubagentStop`, `SessionStart`, `SessionEnd`) — your existing
  hooks are untouched. For performance it does *not* register the per-tool-call `PostToolUse`, and
  throttles `PreToolUse` to skip redundant runs within 2s
- Sets a status line `refreshInterval` (1s by default) so the animation keeps moving between
  events. Turning animation off (`config show_animation false`) removes the timer entirely
- Uses a launcher that resolves `node` at run time, so upgrading Node later won't break the hooks
- Reinstalling is safe (idempotent) — no duplicate lines

## Explanation languages

The default explanation language is Korean; Japanese is fully supported (all 240+ expressions
translated). Switch at any time:

```sh
cccat lang ja     # Japanese explanations
cccat lang ko     # back to Korean
cccat lang        # show current + supported languages
```

Changes apply immediately — no reinstall. Meanings, examples and quiz hints all follow the
chosen language. Only the *explanation* is translated; the English expressions are shared across
all languages. Adding a language is just a `content/i18n/<code>.json` overlay — see
[docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md#explanation-languages-i18n). Contributions of new
language overlays are welcome.

> The optional [danielclass.com](https://danielclass.com) note (free English study material) is
> shown only to Korean-language users, at most once a day.

## Projects with their own status line

Some projects define their own status line in `.claude/settings.json`. Since project settings
take precedence over user settings, cccat is hidden inside such a project. Run this **once** in
that project's directory to make them coexist:

```sh
cccat adopt      # show the project's status line + the cccat lines together
cccat unadopt    # revert
```

`adopt` only writes to the git-ignored `.claude/settings.local.json` and never touches the
shared `.claude/settings.json`. `cccat doctor` detects this situation and suggests the command.

## Usage

After installing it just works. The status line follows what Claude Code is doing (thinking /
reading / writing / testing / git / error …), changing the cat's face and the English
expression. The expression rotates about every 30s (default), and previously seen expressions
come back later as review via a spaced-repetition schedule.

Preview without installing:

```sh
cccat demo thinking
```

## CLI reference

| Command | Description |
|---|---|
| `cccat install` | Install into Claude Code (auto-backs up settings) |
| `cccat uninstall [--purge]` | Remove, restore prior status line/hooks. `--purge` also deletes learning data |
| `cccat doctor` | Diagnose install state, status line, hook count, content |
| `cccat lang [code]` | Show/change explanation language (`ko`, `ja`) |
| `cccat adopt` | In a project with its own status line, set up coexistence (writes `.claude/settings.local.json`; never touches `settings.json`) |
| `cccat unadopt` | Undo `adopt` and restore |
| `cccat on` / `cccat off` | Enable / disable |
| `cccat pause [min]` / `cccat resume` | Pause for N minutes (default 30) / resume now |
| `cccat config list` | Print all settings |
| `cccat config get <key>` | Read one setting |
| `cccat config set <key> <value>` | Change a setting |
| `cccat stats` | Today's count, cumulative learning/mastered/saved |
| `cccat today` | Full list of expressions seen today |
| `cccat save` | Save the currently shown expression |
| `cccat saved` | List saved expressions |
| `cccat reset [--all]` | Reset learning history (`--all` also resets state) |
| `cccat privacy` | What is/isn't collected and where it's stored |
| `cccat demo [state]` | Preview rendering without installing (real rotation engine) |
| `cccat version` | Print version |

## Configuration

Change with `cccat config set <key> <value>`. Defaults live in `lib/config.js`.

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Master on/off |
| `show_character` | `true` | Show the cat |
| `show_animation` | `true` | Frame animation |
| `show_english` | `true` | Show the English expression |
| `show_korean` | `true` | Show the explanation (in the active language) |
| `show_example` | `true` | Show the example line (wide terminals only) |
| `quiz_ratio` | `0.2` | Fraction of already-seen expressions shown as fill-in-the-blank quizzes (0–1) |
| `rotate_sec` | `30` | Minimum seconds between expression changes |
| `refresh_sec` | `1` | Animation refresh interval (seconds, 1–10). Re-run `cccat install` after changing |
| `review_ratio` | `0.3` | Probability of preferring review over a new expression (0–1) |
| `context_aware` | `true` | Prefer expressions matching recent activity (file type / command) |
| `promo` | `true` | Show the danielclass.com note (≤ once/day, Korean users only) |
| `language` | `ko` | Explanation language (`ko`, `ja`). Also settable via `cccat lang <code>` |
| `compact` | `false` | Force single-line mode |
| `difficulty_max` | `3` | Max difficulty of shown expressions (1–3) |

## Uninstall

```sh
cccat uninstall           # restore status line/hooks, keep learning data
cccat uninstall --purge   # the above + delete all of ~/.cccat
```

## Privacy

100% local, zero network requests. It stores only: tool type, file extension, command category,
keyword-matched tags, and learning history. It never stores prompt text, file contents, full
paths, environment variables, or secrets. See [docs/PRIVACY.md](docs/PRIVACY.md) or run
`cccat privacy`.

## FAQ

**Does it slow Claude Code down?**
Not noticeably. Each tool call adds ~80ms via the `PreToolUse` hook (mostly Node cold-start), and
consecutive calls skip even that thanks to a 2s throttle. Hooks are designed to exit quietly on
any input, so they never block Claude Code.

**Does it use a lot of CPU/battery?**
The status line re-runs every `refresh_sec` (1s default) for the animation (~0.1s CPU per call).
Reduce it with `cccat config set refresh_sec 3` or remove the timer entirely with
`cccat config set show_animation false`, then `cccat install`.

**Where do the expressions come from? Is it generated live by AI?**
240+ curated expressions ship locally, so it works with no external API. There are no live LLM
calls (hence zero network, zero cost). Add your own via a user pack (below).

**I already use a status line.**
Install wraps your existing status line command; its output always shows on the first line, then
the cccat lines follow. Nothing is removed.

**A project defines its own status line.**
Run `cccat adopt` once in that project directory —
see [Projects with their own status line](#projects-with-their-own-status-line).

**Can I get explanations in another language?**
Korean and Japanese today. Adding a language is a single overlay file
([docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md#explanation-languages-i18n)); PRs welcome.

**Can I add my own expressions?**
Drop a pack into `~/.cccat/packs/*.json` and it loads alongside the core pack. Schema in
[docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md).

## Docs

| Doc | Contents |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data flow, module map, design decisions |
| [CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | Content schema, tag vocabulary, user packs, i18n overlays |
| [PRIVACY.md](docs/PRIVACY.md) | What is/isn't collected, storage location, deletion |
| [COMPATIBILITY.md](docs/COMPATIBILITY.md) | Supported / unsupported environments |
| [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | Known limitations |
| [VERIFICATION.md](docs/VERIFICATION.md) | Real Claude Code verification log |
| [FUTURE.md](FUTURE.md) | Roadmap ideas |

## Contributing

Bug reports and expression suggestions are welcome — open an issue or PR. Run tests with
`npm test`; PRs must pass CI (Node 18/20/22 × Linux/macOS). New language overlays especially
welcome.

## License

MIT — [LICENSE](LICENSE)
