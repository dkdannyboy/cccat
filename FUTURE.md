# Future Ideas

This is a roadmap of ideas, not commitments. None of these are implemented yet, and none of
them are promises about monetization or timelines.

## Multi-language explanations

**Partially shipped (v0.2):** `config.language` now supports `ko` and `ja`. `lib/content.js`
normalizes items into language-neutral fields (`meaning`/`example_trans`/`nuance_text`) and
loads overlay packs from `content/i18n/<lang>.json`; switch with `cccat lang <code>`. See
[CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md#explanation-languages-i18n).

Next steps: add Chinese (`zh`) and others via the same overlay mechanism; let non-Korean users
opt into the promo-free experience automatically (already the case — promo is `ko`-only); and
consider community-contributed overlays. Note the base English expressions stay shared across
all languages — only the explanation is translated.

## More characters, always with a free base character

The kaomoji cat (`lib/cat.js`) is a fixed set of ASCII/Unicode frames per activity state.
Additional characters (different animals, different art styles) could be added as swappable
`STATES` tables, selected via config — while keeping the current cat as a permanently free,
no-strings-attached default. Any future character variety should never gate the core
learning loop behind anything.

## Optional LLM enrichment

Everything today is rule-based pattern matching (`lib/classify.js`) and a static content pack.
An opt-in mode could use an LLM to generate more nuanced tags from context, or to generate
fresh example sentences — strictly opt-in and clearly disclosed, since cccat's current
zero-network-request guarantee is a core part of its privacy story and must remain the
default behavior.

## Plugin marketplace packaging

Packaging cccat as a proper Claude Code plugin (rather than a settings.json patcher) would
simplify install/uninstall and version management, and could allow discovery through a plugin
marketplace. This would need Claude Code's plugin hook/statusline APIs to support the same
wrapping behavior cccat currently implements by hand in `lib/install.js`.

## Other ideas under consideration

- Configurable quiz reveal timing (currently fixed at 12s)
- Per-project enable/disable independent of a project's own `statusLine` override
- Exporting saved expressions to flashcard formats (Anki, etc.)
- A richer `cccat today`/`cccat stats` view (streaks, weak-tag breakdown)
