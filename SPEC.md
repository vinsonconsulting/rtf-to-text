# `stripRtf` — Function Specification

**Package:** `rtf-to-text` v0.1.0
**Source:** [`src/index.ts`](src/index.ts) — single function, zero dependencies
**Spec basis:** reflects `\*` ignorable-destination skipping (atop the named-only export at `37565b4`)

---

## 1. Signature

```ts
export function stripRtf(input: string): string
```

- **Named export only.** There is no default export.
- **Pure and synchronous.** No I/O, no configuration, no global or module state, no
  randomness. The same input always produces the same output.
- **Total.** Every `string` is valid input; the function never throws on well-formed or
  malformed RTF (see §7).
- **Complexity.** Single linear pass over the input, O(n) time and O(n) output memory. The
  look-ahead for group detection is bounded to 29 characters (O(1) per group); the final
  whitespace cleanup is one O(n) regex pass.

---

## 2. Contract

> Given a string, return the human-readable plaintext it contains. If the string is RTF,
> strip the RTF envelope, control words, and skippable control groups, decoding the pieces
> that carry text or structure. If the string is **not** RTF, return it **unchanged**.

This dual behavior makes the function safe to run over a mixed pile of `.rtf` and `.txt`
content without sniffing each item first.

---

## 3. RTF detection (passthrough gate)

```ts
if (!input.trimStart().startsWith('{\\rtf')) return input;
```

- Leading whitespace is ignored for the test (`trimStart`), but the returned passthrough
  value is the **original, untrimmed** string.
- The sole trigger is the literal prefix **`{\rtf`**. Any string whose first non-whitespace
  characters are `{\rtf...` enters the parser; everything else is returned verbatim.
- **Consequence:** input that is genuinely RTF but does not begin with `{\rtf` (e.g. leading
  BOM bytes before the brace, or a fragment that starts mid-document) is treated as plain
  text and passed through untouched.

---

## 4. Parsing model

A single left-to-right scan maintains three pieces of state:

| State | Meaning |
|---|---|
| `depth` | current brace-nesting depth (`{` increments, `}` decrements) |
| `skipDepth` | the depth at which an active skip-group opened; `-1` when not skipping |
| `output` | the accumulated plaintext |

### 4.1 Braces and group skipping

- `{` → `depth++`. If not already skipping (`skipDepth < 0`), the next 29 characters are
  tested against the **skip-group pattern**:

  ```
  /^\\(?:fonttbl|colortbl|stylesheet|info|pict|fldinst|object|datafield)\b/
  ```

  A match arms skipping: `skipDepth = depth`. The control word must appear **immediately**
  after the opening brace (the pattern is anchored with `^`).
- In addition, a group whose first token is **`\*`** (RTF's ignorable-destination marker,
  matched by `/^\\\*/` against the same look-ahead) is also skipped. This is generic
  ignorable-destination handling: `\*` means "skip this whole group if you don't recognize
  it," so groups like `{\*\generator …}`, `{\*\themedata …}`, and `{\*\colorschememapping …}`
  are discarded regardless of their destination keyword.
- `}` → if currently skipping and `depth <= skipDepth`, skipping is disarmed
  (`skipDepth = -1`); then `depth--`.
- While `skipDepth >= 0`, every character is consumed and **nothing is emitted**, including
  any nested groups inside the skipped one.

**Skipped destinations (content discarded entirely):** the eight named groups `fonttbl`,
`colortbl`, `stylesheet`, `info`, `pict`, `fldinst`, `object`, `datafield`, **plus any group
whose first token is `\*`** (generic ignorable destinations, e.g. `\*\generator`,
`\*\themedata`, `\*\colorschememapping`).

### 4.2 Control words — `\word[-N][space]`

After a backslash that is not an escaped literal or a Unicode escape, the scanner reads:

1. an alphabetic run `[a-zA-Z]+` → the control **word**,
2. an optional signed integer parameter (`-?[0-9]+`) — **parsed and discarded**,
3. a single optional trailing space, consumed as the word/parameter delimiter.

The word is then mapped:

| Control word(s) | Emits |
|---|---|
| `\par`, `\pard` | `\n` (newline) |
| `\line` | `\n` (newline) |
| `\tab` | `\t` (tab) |
| `\lquote`, `\rquote` | `'` (straight apostrophe) |
| `\ldblquote`, `\rdblquote` | `"` (straight double quote) |
| `\bullet` | `•` (U+2022) |
| `\endash` | `–` (U+2013) |
| `\emdash` | `—` (U+2014) |
| **any other word** | nothing — silently dropped |

All presentational control words (`\b`, `\i`, `\fs24`, `\ansi`, `\deff0`, `\f0`, …) fall into
the "dropped" bucket: their parameters are consumed and they emit no text.

> **Note:** `\pard` is RTF's *paragraph-defaults reset*, not strictly a paragraph break, but
> it is treated as a newline here. In practice it precedes paragraph content, and leading
> newlines are removed by the final `trim()`.

### 4.3 Escaped literals — `\{`, `\}`, `\\`

A backslash followed by `{`, `}`, or `\` emits that literal character. Checked **before**
control-word parsing.

### 4.4 Unicode escapes — `\uN?`

Triggered when a backslash is followed by `u` and then a sign or digit.

- Reads a **signed decimal** code point `N`.
- Negative values are interpreted as unsigned-16-bit-wrapped: `charCode = N + 65536`.
- Emits `String.fromCharCode(charCode)` (a single UTF-16 code unit).
- Consumes **exactly one** following ANSI substitution character — unless that next character
  is `\`, `{`, or `}` (a control/group boundary), in which case nothing extra is consumed.

Example: `caf\u233?` → `café`; `\u-3913?` → U+F0B7 (= `String.fromCharCode(61623)`).

### 4.5 Literal text and source line breaks

- Raw `\r` and `\n` in the RTF source are treated as layout, not content, and are dropped.
- Any other character is appended to `output` verbatim.

---

## 5. Output post-processing

```ts
return output.replace(/\n{3,}/g, '\n\n').trim();
```

- Runs of **3 or more** newlines collapse to exactly two (a single blank line).
- Leading and trailing whitespace is trimmed from the final result.

---

## 6. Worked behavior (from the test suite)

| Input | Output |
|---|---|
| `Hello, this is just plain text.` | unchanged (passthrough) |
| `{\rtf1\ansi Hello world}` | `Hello world` |
| `{\rtf1 First.\par Second.}` | `First.\nSecond.` |
| `{\rtf1 Col1\tab Col2}` | `Col1\tCol2` |
| `{\rtf1 \{curly\} and \\backslash}` | `{curly} and \backslash` |
| `{\rtf1{\fonttbl{\f0 Times;}}Hello}` | `Hello` |
| `{\rtf1{\*\generator X}Hi}` | `Hi` |
| `{\rtf1 caf\u233?}` | `café` |
| `{\rtf1 \ldblquote Hello\rdblquote  he said}` | `"Hello" he said` |
| `{\rtf1\b Bold\b0  and \i italic\i0  and \fs24 sized}` | `Bold and italic and sized` |
| `{\rtf1 A\par\par\par\par B}` | `A\n\nB` |

The double-space cases (`\rdblquote  he`) are correct: one space is consumed as the control-word
delimiter, the second survives as literal text.

---

## 7. Known limitations (by design — "strip", not "parse")

These are intentional consequences of being a lightweight stripper, not a conformant RTF
reader. Documented so callers know the edges:

1. **Hex escapes `\'hh` are not decoded.** RTF encodes non-ASCII ANSI bytes as `\'e9`-style
   sequences; `stripRtf` drops the empty control word and leaves `'e9` as literal text.
   Source documents that rely on `\'hh` rather than `\uN?` will show stray hex.
2. **`\ucN` (Unicode skip-count) is ignored.** Every `\uN?` consumes exactly one substitution
   character. Documents that set `\uc0` or `\uc2` may drop or retain the wrong number of
   fallback characters.
3. **Non-`\*`-marked unknown destinations are not skipped.** The eight named destinations in
   §4.1 *and* any `\*`-marked ignorable destination (e.g. `\*\generator`, `\*\themedata`,
   custom `\*` groups) are discarded. What remains is the rare case of an unknown destination
   that is **not** `\*`-marked: its text is parsed as content and can leak into the output. In
   practice this is uncommon, since RTF convention is to mark unknown/ignorable destinations
   with `\*`.
4. **`String.fromCharCode` emits a single UTF-16 unit.** Correct for the 16-bit `\uN?` RTF
   spec, but astral code points expressed outside that range are not reconstructed.
5. **Detection is prefix-only** (`{\rtf`). RTF that does not start exactly with `{\rtf` is
   passed through as plain text (see §3).

None of these cause exceptions; they degrade to leaving extra characters in the text.

---

## 8. Invariants a change must preserve

- Non-RTF input (per §3) is returned **byte-for-byte unchanged**.
- The function never throws for any string input.
- No runtime dependencies are introduced (zero-dependency is a project rule —
  see [`CONTRIBUTING.md`](CONTRIBUTING.md)).
- Output contains no raw RTF control syntax for the cases covered by §4.
- Determinism: identical input → identical output, always.
- Any new behavior arrives with a test in [`test/rtf-strip.test.ts`](test/rtf-strip.test.ts)
  that fails before the change and passes after.
