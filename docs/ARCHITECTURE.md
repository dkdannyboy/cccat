# Architecture

## Data flow

cccat has no daemon and no persistent process. It is driven entirely by two entry points that
Claude Code itself invokes:

```
Claude Code lifecycle event (UserPromptSubmit, PreToolUse, PostToolUse, ...)
        │
        ▼
  cccat hook <event>   (bin/cccat.js → lib/hook.js)
        │  reads hook JSON from stdin (800ms timeout, never throws)
        │  lib/classify.js  → { activity, tags }   (no raw text/paths kept)
        │  lib/state.js     → merge activity + tags into ~/.cccat/state.json
        │  lib/engine.js    → maybe rotate to a new expression (writes history.json)
        ▼
   ~/.cccat/state.json + ~/.cccat/history.json   (on disk, JSON)
        ▲
        │  Claude Code statusline refresh (every render, plus refreshInterval: 1s)
        ▼
  cccat statusline      (bin/cccat.js → lib/statusline.js)
        │  reads state.json, may also rotate if hook hasn't fired recently
        │  lib/render.js  → 1–3 lines of ANSI text
        ▼
  stdout  →  displayed in Claude Code's status line
```

Two independent triggers keep the expression rotating even if hook events are sparse:
`lib/hook.js` rotates on every lifecycle event, and `lib/statusline.js` rotates defensively if
`rotate_sec * 3` has elapsed without a hook firing. Both paths call the same
`engine.maybeRotate()`.

## Module map

| Module | Responsibility |
|---|---|
| `bin/cccat.js` | CLI entry point; dispatches subcommands (install, config, stats, demo, ...) |
| `lib/hook.js` | Hook entry point (`cccat hook <event>`); reads stdin JSON, classifies, rotates, saves state |
| `lib/statusline.js` | Statusline entry point (`cccat statusline`); defensive rotation + renders output |
| `lib/classify.js` | Turns a raw hook payload into `{ activity, tags }` — the only place that touches payload content, and only to match patterns (never stores the input) |
| `lib/select.js` | Picks the next expression: context match > due review > new, avoiding the last 20 shown |
| `lib/review.js` | Spaced-repetition bookkeeping: intervals (4h/1d/3d/7d/14d/30d), due dates, stats |
| `lib/engine.js` | Orchestrates rotation: calls select + review + promo, mutates in-memory state |
| `lib/state.js` | `~/.cccat/state.json` shape, load/save, tag decay (30 min window), daily counters |
| `lib/config.js` | `~/.cccat/config.json` defaults, load/save/set with type coercion |
| `lib/content.js` | Loads `content/pack-core.json` + any `~/.cccat/packs/*.json`, deduped by id, 5s cache |
| `lib/render.js` | Builds the 1–3 ANSI-colored status line strings, quiz blank-out, width-aware truncation |
| `lib/cat.js` | Kaomoji frame tables per activity state, time-based frame selection |
| `lib/promo.js` | danielclass.com nudge: Korean-only, ≥5 expressions seen today, once per day |
| `lib/install.js` | Backs up and patches `~/.claude/settings.json` (statusline wrapper + hooks), uninstall/doctor |
| `lib/paths.js` | All `~/.cccat/*` and `~/.claude/*` path resolution (overridable via `CCCAT_HOME`/`CCCAT_CLAUDE_DIR` for tests) |
| `lib/store.js` | Generic JSON read/write helpers |
| `lib/width.js` | Terminal display-width measurement and truncation for CJK-aware layout |

## Design decisions

### Why statusline + hooks, not a plugin or companion process

Claude Code's statusline and hook system are the only extension points that run on every
turn without the user opening a separate window or terminal pane. A companion process (daemon,
TUI, browser tab) would need its own lifecycle management, could drift out of sync with the
actual Claude Code session, and would violate the "never block or distract from the real work"
goal. Hooks give cccat a signal on every tool call; the statusline gives it a place to render
that costs nothing extra to look at, since the user is already watching it for model name and
context info.

### Why a shell wrapper for statusline instead of overwriting settings.json directly

Users may already have a `statusLine.command` configured. Overwriting it would silently break
their existing setup. Wrapping it in a small `/bin/sh` script means the original command's
output is always printed first (byte for byte), and cccat's own line(s) are appended below.
Uninstall reads the same wrapper metadata to restore the original command exactly.

### Why hooks append rather than replace

Each `HOOK_EVENTS` entry is filtered by a `cccat` marker string embedded in the command, so
`install()` removes only its own previous entries before appending a fresh one — any other
tool's hooks on the same event stay untouched. This makes install/uninstall idempotent and
non-destructive to other tooling that also uses hooks.

### Why no network calls

The project's core promise is 100% local operation. `lib/classify.js` intentionally reduces
every hook payload to a small enum + tag list before it ever reaches `state.js`, so there is
no raw prompt/file/path data to accidentally transmit even if that were ever added later.

### Why JSON files instead of a database

State (`state.json`), history (`history.json`), and config (`config.json`) are all small,
single-writer, single-reader-at-a-time files written synchronously via `lib/store.js`. A
database would add a dependency and startup cost for data that's a few KB and read/written a
few times per minute at most.
