import { describe, it, expect } from 'vitest';
import { stripRtf } from '../src/index';

describe('stripRtf', () => {
  it('returns plain text input unchanged', () => {
    const plain = 'Hello, this is just plain text.';
    expect(stripRtf(plain)).toBe(plain);
  });

  it('strips basic RTF envelope and formatting', () => {
    const rtf = '{\\rtf1\\ansi Hello world}';
    expect(stripRtf(rtf)).toBe('Hello world');
  });

  it('converts \\par to newlines', () => {
    const rtf = '{\\rtf1 First paragraph.\\par Second paragraph.}';
    expect(stripRtf(rtf)).toBe('First paragraph.\nSecond paragraph.');
  });

  it('converts \\line to newlines', () => {
    const rtf = '{\\rtf1 Line one.\\line Line two.}';
    expect(stripRtf(rtf)).toBe('Line one.\nLine two.');
  });

  it('converts \\tab to tab characters', () => {
    const rtf = '{\\rtf1 Col1\\tab Col2}';
    expect(stripRtf(rtf)).toBe('Col1\tCol2');
  });

  it('handles escaped braces and backslash', () => {
    const rtf = '{\\rtf1 \\{curly\\} and \\\\backslash}';
    expect(stripRtf(rtf)).toBe('{curly} and \\backslash');
  });

  it('skips fonttbl group', () => {
    const rtf = '{\\rtf1{\\fonttbl{\\f0 Times New Roman;}}Hello}';
    expect(stripRtf(rtf)).toBe('Hello');
  });

  it('skips colortbl group', () => {
    const rtf = '{\\rtf1{\\colortbl ;\\red255\\green0\\blue0;}Hello}';
    expect(stripRtf(rtf)).toBe('Hello');
  });

  it('skips stylesheet group', () => {
    const rtf = '{\\rtf1{\\stylesheet{\\s0 Normal;}}Content here}';
    expect(stripRtf(rtf)).toBe('Content here');
  });

  it('skips info group', () => {
    const rtf = '{\\rtf1{\\info{\\author Jim}} Document text}';
    expect(stripRtf(rtf)).toBe('Document text');
  });

  it('skips \\* ignorable destinations like \\*\\generator', () => {
    expect(stripRtf('{\\rtf1{\\*\\generator Riched20 10.0.19041}Hello}')).toBe('Hello')
  })

  it('skips \\* destinations alongside named ones', () => {
    expect(
      stripRtf('{\\rtf1{\\*\\themedata 0102030405}{\\fonttbl{\\f0 Arial;}}Body text}')
    ).toBe('Body text')
  })

  it('skips nested groups inside a \\* destination', () => {
    expect(stripRtf('{\\rtf1{\\*\\datastore {\\nested junk}}Visible}')).toBe('Visible')
  })

  it('handles Unicode escapes', () => {
    // \u233? is é (Latin small e with acute), ? is ANSI replacement
    const rtf = '{\\rtf1 caf\\u233?}';
    expect(stripRtf(rtf)).toBe('café');
  });

  it('handles negative Unicode values (wrapped 16-bit)', () => {
    // \u-3913? is 61623 = 0xF0B7
    const rtf = '{\\rtf1 \\u-3913?}';
    const result = stripRtf(rtf);
    expect(result).toBe(String.fromCharCode(61623));
  });

  it('converts smart quotes', () => {
    const rtf = '{\\rtf1 \\ldblquote Hello\\rdblquote  he said}';
    expect(stripRtf(rtf)).toBe('"Hello" he said');
  });

  it('converts special punctuation', () => {
    const rtf = '{\\rtf1 item\\bullet  one\\endash two\\emdash three}';
    expect(stripRtf(rtf)).toBe('item• one–two—three');
  });

  it('strips formatting control words (bold, italic, font size)', () => {
    const rtf = '{\\rtf1\\b Bold\\b0  and \\i italic\\i0  and \\fs24 sized}';
    expect(stripRtf(rtf)).toBe('Bold and italic and sized');
  });

  it('collapses excessive blank lines', () => {
    const rtf = '{\\rtf1 A\\par\\par\\par\\par B}';
    expect(stripRtf(rtf)).toBe('A\n\nB');
  });

  it('handles realistic RTF document', () => {
    const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}{\\colortbl ;\\red0\\green0\\blue0;}
\\pard\\f0\\fs24 The cat sat on the mat.\\par
It was a \\b very\\b0  good cat.\\par
}`;
    const result = stripRtf(rtf);
    expect(result).toContain('The cat sat on the mat.');
    expect(result).toContain('It was a very good cat.');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('fonttbl');
  });

  it('trims leading and trailing whitespace', () => {
    const rtf = '{\\rtf1   Hello   }';
    expect(stripRtf(rtf)).toBe('Hello');
  });
});
