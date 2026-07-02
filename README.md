# Translation Kitten

Translation Kitten is a browser extension for webpage translation, PDF side-by-side reading, selection translation, and YouTube subtitle translation.

This repository is a modified GPL-3.0 fork derived from [Read Frog](https://github.com/mengxi-ream/read-frog). It is not the official Read Frog repository, website, store listing, support channel, or commercial distribution. The fork keeps the upstream license and attribution while maintaining local changes under the Translation Kitten name.

## Current Focus

- Webpage translation with floating and selection toolbars
- PDF reader with source and translation columns
- PDF selection/context-menu translation
- YouTube subtitle translation, including normal videos, embeds, and Shorts
- Local-first development and build workflows for Chrome MV3

## Install For Local Development

Requirements:

- Node.js 22.22.0 or newer
- Corepack enabled
- pnpm 10.33.4, managed by Corepack

```powershell
corepack enable
pnpm install --frozen-lockfile
$env:WXT_SKIP_ENV_VALIDATION='true'
pnpm build
```

Load the built extension from:

```text
.output/chrome-mv3
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose "Load unpacked", and select that folder.

## Useful Commands

```powershell
pnpm type-check
pnpm exec vitest run --maxWorkers=4
$env:WXT_SKIP_ENV_VALIDATION='true'; pnpm build
$env:WXT_SKIP_ENV_VALIDATION='true'; pnpm zip
```

## Environment

Most local development can use `WXT_SKIP_ENV_VALIDATION=true`. Optional runtime URL overrides are documented in `.env.example`.

Do not commit real API keys, OAuth secrets, store credentials, webhook URLs, private keys, or packaged archives. Test fixtures may contain fake keys such as `sk-test`.

## Attribution And License

Translation Kitten is based on Read Frog and remains licensed under GNU GPL v3. See [LICENSE](./LICENSE).

Upstream project:

- Repository: <https://github.com/mengxi-ream/read-frog>
- License: GPL-3.0

This fork changes product naming, PDF-reader behavior, selection/context-menu routing, and YouTube subtitle handling. Any remaining upstream names in source identifiers, compatibility attributes, comments, historical changelog entries, dependencies, or test fixtures should be treated as attribution or implementation history, not as a claim that this repository is the official Read Frog project.

## Contributing

Issues and pull requests for this fork should be opened in this repository:

<https://github.com/SYZBZ/translation-kitten>

When contributing, keep changes source-compatible with GPL-3.0 and avoid adding assets, datasets, or third-party code unless their license permits redistribution in this project.
