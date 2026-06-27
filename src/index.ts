/**
 * rtf-to-text — strip RTF to clean plaintext.
 *
 * A single zero-dependency function. Given an RTF string it returns readable
 * plaintext; given anything that is not RTF it returns the input unchanged, so
 * it is safe to run over a mixed pile of `.rtf` and `.txt` without sniffing first.
 *
 * Handles:
 * - RTF group skipping (fonttbl, colortbl, stylesheet, info, pict, …)
 * - Unicode escapes (\uN?), including negative (16-bit-wrapped) values
 * - Paragraph / line / tab breaks (\par, \line, \tab)
 * - Escaped literals (\{, \}, \\) and common punctuation (smart quotes, bullet, dashes)
 * - Plain-text passthrough (non-RTF input returned as-is)
 */
export function stripRtf(input: string): string {
  // If it doesn't look like RTF, return as-is
  if (!input.trimStart().startsWith('{\\rtf')) {
    return input;
  }

  let output = '';
  let i = 0;
  let depth = 0;
  let skipDepth = -1; // When >= 0, skip content until depth drops below this

  // Groups whose content we skip entirely
  const SKIP_GROUPS = /^\\(?:fonttbl|colortbl|stylesheet|info|pict|fldinst|object|datafield)\b/;

  while (i < input.length) {
    const ch = input[i];

    if (ch === '{') {
      depth++;

      // Check if this group should be skipped
      if (skipDepth < 0) {
        // Peek ahead for group type
        const ahead = input.slice(i + 1, i + 30);
        if (SKIP_GROUPS.test(ahead)) {
          skipDepth = depth;
        }
      }
      i++;
      continue;
    }

    if (ch === '}') {
      if (skipDepth >= 0 && depth <= skipDepth) {
        skipDepth = -1;
      }
      depth--;
      i++;
      continue;
    }

    // If inside a skipped group, consume without emitting
    if (skipDepth >= 0) {
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= input.length) break;

      const next = input[i];

      // Escaped literal characters
      if (next === '{' || next === '}' || next === '\\') {
        output += next;
        i++;
        continue;
      }

      // Unicode escape: \uN? (N = signed decimal, ? = ANSI replacement char)
      if (next === 'u' && i + 1 < input.length && /[-\d]/.test(input[i + 1])) {
        i++; // skip 'u'
        let numStr = '';
        if (input[i] === '-') {
          numStr += '-';
          i++;
        }
        while (i < input.length && /\d/.test(input[i])) {
          numStr += input[i];
          i++;
        }
        const codePoint = parseInt(numStr, 10);
        // Negative values are unsigned 16-bit wrapped
        const charCode = codePoint < 0 ? codePoint + 65536 : codePoint;
        output += String.fromCharCode(charCode);
        // Skip the ANSI replacement character (typically '?')
        if (i < input.length && input[i] !== '\\' && input[i] !== '{' && input[i] !== '}') {
          i++;
        }
        continue;
      }

      // Control word: \word[N][ ]
      let word = '';
      while (i < input.length && /[a-zA-Z]/.test(input[i])) {
        word += input[i];
        i++;
      }

      // Optional numeric parameter
      if (i < input.length && /[-\d]/.test(input[i])) {
        if (input[i] === '-') {
          i++;
        }
        while (i < input.length && /\d/.test(input[i])) {
          i++;
        }
      }

      // Consume trailing space (delimiter)
      if (i < input.length && input[i] === ' ') {
        i++;
      }

      // Convert meaningful control words to text
      if (word === 'par' || word === 'pard') {
        output += '\n';
      } else if (word === 'line') {
        output += '\n';
      } else if (word === 'tab') {
        output += '\t';
      } else if (word === 'lquote' || word === 'rquote') {
        output += "'";
      } else if (word === 'ldblquote' || word === 'rdblquote') {
        output += '"';
      } else if (word === 'bullet') {
        output += '•';
      } else if (word === 'endash') {
        output += '–';
      } else if (word === 'emdash') {
        output += '—';
      }
      // All other control words are silently dropped (formatting, \b, \i, \fs, etc.)
      continue;
    }

    // Skip CR/LF (RTF uses \r\n line endings in the source but they're not content)
    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    // Regular character — emit it
    output += ch;
    i++;
  }

  // Clean up: collapse multiple blank lines, trim
  return output
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
