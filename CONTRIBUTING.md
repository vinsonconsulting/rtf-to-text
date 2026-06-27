# Contributing

Small, focused package — contributions welcome, especially real-world RTF that
comes out wrong.

## Setup

```bash
npm install
npm test          # vitest
npm run build     # tsdown → dist/ (ESM + CJS + types)
npm run typecheck # tsc --noEmit
```

## Ground rules

- **Stay zero-dependency.** The value here is being tiny and sharp. A PR that adds
  a runtime dependency needs a very good reason.
- **Bring a test.** If you're fixing a case where RTF strips wrong, add the input
  and expected output to `test/rtf-strip.test.ts` first — it should fail before
  your change and pass after.
- **One function, one job.** This strips RTF to text. Full document parsing,
  styling, and round-tripping are out of scope by design.

## Releasing

Tagging `vX.Y.Z` on `main` triggers the publish workflow (build → `npm publish`
with provenance). Bump the version in `package.json` in the same commit as the tag.
