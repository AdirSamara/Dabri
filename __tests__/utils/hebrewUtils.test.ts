import {
  stripNiqqud,
  normalizeHebrew,
  levenshteinDistance,
  generateId,
} from '../../src/utils/hebrewUtils';

describe('stripNiqqud', () => {
  it('removes niqqud marks from vocalized Hebrew text', () => {
    expect(stripNiqqud('שָׁלוֹם')).toBe('שלום');
  });

  it('removes cantillation marks', () => {
    // U+0591 (etnahta) through U+05AF are cantillation marks
    const withCantillation = 'בְּ֭רֵאשִׁ֖ית';
    const result = stripNiqqud(withCantillation);
    expect(result).not.toMatch(/[\u0591-\u05AF]/);
  });

  it('returns empty string when given empty string', () => {
    expect(stripNiqqud('')).toBe('');
  });

  it('returns clean text unchanged when there are no niqqud marks', () => {
    const clean = 'שלום עולם';
    expect(stripNiqqud(clean)).toBe(clean);
  });

  it('preserves non-Hebrew characters', () => {
    expect(stripNiqqud('Hello שָׁלוֹם 123')).toBe('Hello שלום 123');
  });
});

describe('normalizeHebrew', () => {
  it('collapses multiple whitespace characters into a single space', () => {
    expect(normalizeHebrew('שלום    עולם')).toBe('שלום עולם');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeHebrew('  שלום  ')).toBe('שלום');
  });

  it('folds uppercase Latin characters to lowercase', () => {
    expect(normalizeHebrew('Hello World')).toBe('hello world');
  });

  it('strips niqqud and normalizes whitespace in one pass', () => {
    expect(normalizeHebrew('  שָׁלוֹם   עוֹלָם  ')).toBe('שלום עולם');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeHebrew('   ')).toBe('');
  });
});

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('שלום', 'שלום')).toBe(0);
  });

  it('returns 1 for a single insertion', () => {
    expect(levenshteinDistance('כלב', 'כלבי')).toBe(1);
  });

  it('returns length of the non-empty string when comparing with empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('computes correct distance for Hebrew names with a typo', () => {
    // דניאל vs דניל (missing alef) => distance 1
    expect(levenshteinDistance('דניאל', 'דניל')).toBe(1);
  });

  it('computes correct distance for completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  it('is symmetric', () => {
    const d1 = levenshteinDistance('kitten', 'sitting');
    const d2 = levenshteinDistance('sitting', 'kitten');
    expect(d1).toBe(d2);
  });
});

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns a non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('generates unique IDs across 100 calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});
