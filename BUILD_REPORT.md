# Build Report — tsup → tsdown Migration

**Package:** `rtf-to-text` v0.1.0
**Commit:** `9bc0857` — _chore: migrate tsup to tsdown, add publint + attw, Node 22/24 CI_
**Branch:** merged to `main` (fast-forward); migration branch `chore/tsdown-validators` deleted
**Status:** ✅ green — all checks passing, packaging validators clean

---

## Summary

Pre-publish re-tooling of the build pipeline. The bundler was swapped from **tsup** to
**tsdown** (the rolldown-based successor), two packaging-correctness validators were added
to the workflow, and the CI Node matrix was modernized to the currently-supported LTS lines.
No source or public API changed — `stripRtf(input: string): string` and the dual ESM + CJS +
`.d.ts` shape are identical to before.

Publishing, the GitHub remote, and version tags remain **out of scope** (handled separately).

---

## Toolchain

| Tool | Version | Role |
|---|---|---|
| tsdown | `^0.22.3` | bundler (ESM + CJS + declarations), replaces tsup |
| publint | `^0.3.21` | lints `package.json` packaging metadata |
| @arethetypeswrong/cli (`attw`) | `^0.18.4` | verifies type resolution across module systems |
| typescript | `^5.7.3` | typecheck + declaration emit |
| vitest | `^4.0.18` | tests |

Build environment: Node `v26.0.0`, npm `11.12.1`. tsdown build target: `node18.0.0`
(derived from `engines.node >= 18`).

---

## Build output

`npm run build` (tsdown, `clean: true`) emits four files into `dist/`:

| File | Format | Raw | gzip |
|---|---|---|---|
| `index.mjs` | ESM | 3.00 kB | 1.19 kB |
| `index.cjs` | CJS | 3.13 kB | 1.25 kB |
| `index.d.mts` | ESM types | 0.79 kB | 0.51 kB |
| `index.d.cts` | CJS types | 0.79 kB | 0.51 kB |

No source maps are emitted (the tsdown config intentionally omits `sourcemap`), so the
published tarball stays minimal.

---

## Package layout

`package.json` is ESM-first (`"type": "module"`) with conditional `types` per export
condition — the form `attw` resolves cleanly under `node16`/bundler resolution:

```json
"main": "./dist/index.cjs",
"module": "./dist/index.mjs",
"types": "./dist/index.d.cts",
"exports": {
  ".": {
    "import":  { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  }
}
```

`npm pack --dry-run` tarball — **7 files, nothing extraneous:**

```
LICENSE
README.md
dist/index.cjs
dist/index.d.cts
dist/index.d.mts
dist/index.mjs
package.json
```

---

## Packaging validation

**publint** — `npm run lint:pkg` (also wired into `prepublishOnly`):

```
Running publint v0.3.21 for rtf-to-text...
All good!
```

**are-the-types-wrong** (`attw --pack .`) — every resolution mode passes:

```
┌───────────────────┬───────────────┐
│                   │ "rtf-to-text" │
├───────────────────┼───────────────┤
│ node10            │ 🟢            │
│ node16 (from CJS) │ 🟢 (CJS)      │
│ node16 (from ESM) │ 🟢 (ESM)      │
│ bundler           │ 🟢            │
└───────────────────┴───────────────┘
 No problems found 🌟
```

---

## Verification gauntlet

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ clean |
| Tests | `npm test` | ✅ 19/19 passing |
| Build | `npm run build` | ✅ ESM + CJS + both declarations |
| Package lint | `npx publint` | ✅ All good! |
| Type resolution | `npx attw --pack .` | ✅ No problems |
| Tarball contents | `npm pack --dry-run` | ✅ only LICENSE, README, dist/*, package.json |
| Residual references | `grep -ri tsup` | ✅ no matches |
| Dependency audit | `npm audit` | ✅ 0 vulnerabilities |

---

## Changed files

| File | Change |
|---|---|
| `tsup.config.ts` → `tsdown.config.ts` | renamed; rewritten to the minimal config (entry, esm+cjs, dts, clean) |
| `package.json` | `build: tsdown`; added `lint:pkg`; `prepublishOnly` now builds + lints; deps swapped; exports map reconciled to emitted filenames |
| `package-lock.json` | tsup removed; tsdown + publint + attw (and transitive deps) added |
| `tsconfig.json` | `include` references `tsdown.config.ts` |
| `CONTRIBUTING.md` | build comment updated tsup → tsdown |
| `.github/workflows/ci.yml` | Node matrix `[22, 24]`; added `npx publint` + `npx attw --pack .` after build |
| `.github/workflows/publish.yml` | setup-node `node-version: 24` (build + publish steps unchanged) |

---

## Notes

- **ESM extension.** tsdown emits ESM as `.mjs` / `.d.mts` (tsup previously emitted `.js` /
  `.d.ts`). The exports map points at the files tsdown actually emits; `attw` confirms the
  map resolves correctly for every consumer. `.mjs` is unambiguous regardless of the
  `"type"` field.
- **`npx tsdown migrate` could not be used.** It requires an interactive TTY and crashes in a
  non-interactive shell (`uv_tty_init returned EINVAL`). The equivalent migration was applied
  manually — install tsdown / remove tsup / write config / delete the tsup config / update
  scripts — reaching an identical, fully-verified end state.
- **`src/index.ts` ships both a named (`stripRtf`) and a default export.** tsdown surfaces a
  `[MIXED_EXPORTS]` informational warning about CJS interop; `attw` verifies the resulting
  type resolution is correct across all module systems, so no action was needed.

---

## Out of scope (handled separately)

Push, GitHub remote, `npm publish`, and version tag. All work in this report is **local only**.
