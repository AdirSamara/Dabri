/**
 * Strips Hebrew niqqud (vowel marks) from text.
 * Removes Unicode range U+0591–U+05C7.
 */
export function stripNiqqud(text: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return text.replace(/[\u0591-\u05C7]/g, '');
}

/**
 * Normalizes Hebrew text: strips niqqud, trims, collapses spaces, lowercases.
 */
export function normalizeHebrew(text: string): string {
  return stripNiqqud(text)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Classic dynamic-programming Levenshtein edit distance.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Generates a short unique ID using timestamp + random suffix.
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
