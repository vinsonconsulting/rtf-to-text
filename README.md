# rtf-to-text

[![npm](https://img.shields.io/npm/v/rtf-to-text?logo=npm)](https://www.npmjs.com/package/rtf-to-text)
[![CI](https://github.com/vinsonconsulting/rtf-to-text/actions/workflows/ci.yml/badge.svg)](https://github.com/vinsonconsulting/rtf-to-text/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-2ea44f)](package.json)
[![types: included](https://img.shields.io/badge/types-included-3178C6?logo=typescript&logoColor=white)](dist/index.d.ts)
[![license: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**Strip RTF down to clean plaintext. One function, zero dependencies, ESM + CJS + types.**

RTF is a format you receive, rarely one you want. A user pastes from Word, an export drops a `.rtf`, a clipboard hands you `{\rtf1\ansi...}` instead of the sentence inside it. The npm options for getting the text back out are mostly heavyweight document parsers or packages that haven't been touched in years. This is the small, sharp tool: give it a string, get the words.

```bash
npm install rtf-to-text
```

## Use it

```ts
import { stripRtf } from 'rtf-to-text';

stripRtf('{\\rtf1\\ansi Hello \\b world\\b0}');
// → "Hello world"

stripRtf('Already plain text.');
// → "Already plain text."   (non-RTF passes through untouched)
```

CommonJS works too:

```js
const { stripRtf } = require('rtf-to-text');
```

## What it handles

- **Passthrough** — input that isn't RTF (doesn't start with `{\rtf`) is returned unchanged, so you can run it over a mixed pile of `.rtf` and `.txt` without sniffing each one first.
- **Control groups** — `fonttbl`, `colortbl`, `stylesheet`, `info`, `pict`, and friends are skipped wholesale, not leaked as noise.
- **Unicode escapes** — `\uN?` decoded properly, including negative (16-bit-wrapped) values, and the trailing ANSI replacement char is consumed.
- **Structure** — `\par` / `\line` → newlines, `\tab` → tab; runs of blank lines are collapsed and the result is trimmed.
- **Escaped literals & punctuation** — `\{`, `\}`, `\\`, plus smart quotes, bullet, en/em dashes mapped to their real characters.
- **Formatting** — `\b`, `\i`, `\fs24`, and every other presentational control word is dropped silently.

## What it is not

A faithful RTF *parser* or a fonts-and-colors document model. It throws formatting away on purpose — the goal is the text a human would read, suitable for search indexing, analysis, ingestion pipelines, diffing, or just showing the user what they actually pasted. If you need to preserve styling, reach for a full document library instead.

## API

```ts
function stripRtf(input: string): string
```

Pure and synchronous. No I/O, no configuration, no state. The same input always returns the same output.

## Why this exists

Extracted from a production text-analysis pipeline (a CEFR teaching tool) where teachers paste passages from Word and the RTF wrapper has to come off before anything else can happen. It earned its keep there over thousands of real documents; this is that one piece, tested and standalone.

## License

[Apache-2.0](LICENSE) © Jim Vinson · [jimvinson.com](https://jimvinson.com)
