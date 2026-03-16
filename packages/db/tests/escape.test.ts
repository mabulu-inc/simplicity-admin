import { describe, it, expect } from 'vitest';
import { escapeIdentifier } from '../src/escape.js';

describe('escapeIdentifier', () => {
  it('wraps a simple name in double quotes', () => {
    expect(escapeIdentifier('users')).toBe('"users"');
  });

  it('escapes names containing double quotes', () => {
    expect(escapeIdentifier('my"table')).toBe('"my""table"');
    expect(escapeIdentifier('"already"')).toBe('"""already"""');
  });

  it('escapes SQL reserved words', () => {
    expect(escapeIdentifier('select')).toBe('"select"');
    expect(escapeIdentifier('ORDER')).toBe('"ORDER"');
    expect(escapeIdentifier('table')).toBe('"table"');
  });

  it('handles unicode identifiers', () => {
    expect(escapeIdentifier('名前')).toBe('"名前"');
    expect(escapeIdentifier('café')).toBe('"café"');
    expect(escapeIdentifier('über_feld')).toBe('"über_feld"');
  });

  it('handles empty string edge case', () => {
    expect(() => escapeIdentifier('')).toThrow();
  });

  it('preserves case sensitivity', () => {
    expect(escapeIdentifier('MyTable')).toBe('"MyTable"');
  });

  it('handles names with spaces', () => {
    expect(escapeIdentifier('my table')).toBe('"my table"');
  });

  it('handles names with multiple consecutive double quotes', () => {
    expect(escapeIdentifier('a""b')).toBe('"a""""b"');
  });
});
