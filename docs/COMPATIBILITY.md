# Compatibility

## Supported

| Environment | Status | Notes |
|---|---|---|
| macOS + Claude Code 2.1.201 | Verified | Full E2E verification in real TUI, see [VERIFICATION.md](VERIFICATION.md) |
| macOS + tmux | Verified | 140x40 pane, animation and rotation confirmed |
| Node.js 18, 20, 22 | Supported | `engines.node >= 18` in package.json; no version-specific APIs used |
| Linux + Claude Code | Should work | Same `/bin/sh` wrapper mechanism, same JSON-only I/O; not explicitly tested |
| Wide terminals (≥110 cols) | Full | Two-line output with English, Korean, and example sentence + Korean translation |
| Narrow terminals (70–109 cols) | Reduced | Two-line output without the example's Korean translation |
| Narrow terminals (<70 cols) | Compact | Forced single-line mode (`lib/render.js` compact path) |

## Unsupported / untested

| Environment | Status | Notes |
|---|---|---|
| Windows (native, no WSL) | Untested | The statusline wrapper (`lib/install.js`) generates a `/bin/sh` script; Claude Code on native Windows would need a shell capable of running it |
| WSL (Windows Subsystem for Linux) | Expected to work, untested | Runs a real `/bin/sh` environment, same as Linux |
| Non-Korean `conversation_language` | Partial | Content explanations are Korean-only regardless of OS locale; the `promo` nudge is disabled automatically when `config.language` isn't `ko` |
| Claude Code versions before hooks/statusline support | Unsupported | cccat requires the `statusLine` setting and the 10 hook events it registers; older Claude Code releases without these features have nothing to attach to |

## Requirements checklist

- Node.js ≥ 18 (`node --version`)
- Claude Code with hook and statusline support
- A POSIX shell available at `/bin/sh` (present on macOS, Linux, and WSL)
- git, if installing via the one-line `scripts/install.sh` script

Run `cccat doctor` after installation to check the current environment's install status,
statusline wrapper, hook registration count, and content pack load status in place.
