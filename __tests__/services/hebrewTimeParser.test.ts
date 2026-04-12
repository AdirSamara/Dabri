import {
  parseHebrewTime,
  parseHebrewNumber,
  parseRelativeTime,
  parseAbsoluteTime,
} from '../../src/services/hebrewTimeParser';

// Fixed reference date: 2026-04-12 10:00:00 (Sunday)
const REF = new Date(2026, 3, 12, 10, 0, 0, 0);
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe('parseHebrewNumber', () => {
  it('parses digit strings', () => {
    expect(parseHebrewNumber('5')).toBe(5);
    expect(parseHebrewNumber('25')).toBe(25);
  });

  it('parses Hebrew number words', () => {
    expect(parseHebrewNumber('שלוש')).toBe(3);
    expect(parseHebrewNumber('עשר')).toBe(10);
    expect(parseHebrewNumber('שמונה')).toBe(8);
  });

  it('parses compound numbers "עשרים וחמש" → 25', () => {
    expect(parseHebrewNumber('עשרים וחמש')).toBe(25);
  });

  it('returns null for invalid input', () => {
    expect(parseHebrewNumber('hello')).toBeNull();
    expect(parseHebrewNumber('שלום')).toBeNull();
  });
});

describe('parseRelativeTime', () => {
  it('"בעוד 5 דקות" → +5 minutes', () => {
    const result = parseRelativeTime('בעוד 5 דקות', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 5 * MINUTE);
  });

  it('"בעוד שעה" → +1 hour', () => {
    const result = parseRelativeTime('בעוד שעה', REF);
    expect(result!.getTime()).toBe(REF.getTime() + HOUR);
  });

  it('"בעוד שעתיים" → +2 hours', () => {
    const result = parseRelativeTime('בעוד שעתיים', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 2 * HOUR);
  });

  it('"בעוד חצי שעה" → +30 minutes', () => {
    const result = parseRelativeTime('בעוד חצי שעה', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 30 * MINUTE);
  });

  it('"בעוד רבע שעה" → +15 minutes', () => {
    const result = parseRelativeTime('בעוד רבע שעה', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 15 * MINUTE);
  });

  it('"בעוד דקה" → +1 minute', () => {
    const result = parseRelativeTime('בעוד דקה', REF);
    expect(result!.getTime()).toBe(REF.getTime() + MINUTE);
  });

  it('"בעוד דקה וחצי" → +1.5 minutes', () => {
    const result = parseRelativeTime('בעוד דקה וחצי', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 1.5 * MINUTE);
  });

  it('"בעוד שעה וחצי" → +90 minutes', () => {
    const result = parseRelativeTime('בעוד שעה וחצי', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 90 * MINUTE);
  });

  it('"עוד קצת" → +15 minutes', () => {
    const result = parseRelativeTime('עוד קצת', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 15 * MINUTE);
  });

  it('"בעוד כמה דקות" → +5 minutes', () => {
    const result = parseRelativeTime('בעוד כמה דקות', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 5 * MINUTE);
  });

  it('Hebrew number words: "בעוד עשרים וחמש דקות" → +25 min', () => {
    const result = parseRelativeTime('בעוד עשרים וחמש דקות', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 25 * MINUTE);
  });

  it('"בעוד שלוש שעות" → +3 hours', () => {
    const result = parseRelativeTime('בעוד שלוש שעות', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 3 * HOUR);
  });

  it('"בעוד יומיים" → +2 days', () => {
    const result = parseRelativeTime('בעוד יומיים', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 2 * DAY);
  });

  it('"בעוד שבוע" → +7 days', () => {
    const result = parseRelativeTime('בעוד שבוע', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 7 * DAY);
  });

  it('"בעוד רגע" → +1 minute', () => {
    const result = parseRelativeTime('בעוד רגע', REF);
    expect(result!.getTime()).toBe(REF.getTime() + MINUTE);
  });

  it('"בקרוב" returns +5 minutes from main entry', () => {
    const result = parseHebrewTime('בקרוב', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 5 * MINUTE);
  });

  it('"לעוד 10 דקות" alternate prefix → +10 min', () => {
    const result = parseRelativeTime('לעוד 10 דקות', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 10 * MINUTE);
  });
});

describe('parseAbsoluteTime', () => {
  it('"מחר בשעה 8" → tomorrow 08:00', () => {
    const result = parseAbsoluteTime('מחר בשעה 8', REF);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(REF.getDate() + 1);
    expect(result!.getHours()).toBe(8);
    expect(result!.getMinutes()).toBe(0);
  });

  it('"מחרתיים" → day after tomorrow', () => {
    const result = parseAbsoluteTime('מחרתיים בבוקר', REF);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(REF.getDate() + 2);
  });

  it('"היום בצהריים" → today 12:00', () => {
    const result = parseAbsoluteTime('היום בצהריים', REF);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(REF.getDate());
    expect(result!.getHours()).toBe(12);
  });

  it('"בערב" → 19:00 today or tomorrow', () => {
    const result = parseAbsoluteTime('בערב', REF);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(19);
  });

  it('"בלילה" → 22:00', () => {
    const result = parseAbsoluteTime('בלילה', REF);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(22);
  });

  it('"בבוקר" → 08:00', () => {
    const result = parseAbsoluteTime('מחר בבוקר', REF);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(8);
  });

  // Day names — REF is Sunday (day 0)
  it('"ביום שלישי" → next Tuesday', () => {
    const result = parseAbsoluteTime('ביום שלישי בבוקר', REF);
    expect(result).not.toBeNull();
    expect(result!.getDay()).toBe(2); // Tuesday
  });

  it('"בשישי בערב" → next Friday 19:00', () => {
    const result = parseAbsoluteTime('בשישי בערב', REF);
    expect(result).not.toBeNull();
    expect(result!.getDay()).toBe(5); // Friday
    expect(result!.getHours()).toBe(19);
  });

  it('"בשעה 14:30" → specific time with minutes', () => {
    const result = parseAbsoluteTime('מחר בשעה 14:30', REF);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
  });

  // AM/PM disambiguation
  it('bare number 3 → assumed PM (15:00)', () => {
    const result = parseAbsoluteTime('מחר בשעה 3', REF);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(15);
  });

  it('"בשעה 3 בבוקר" → keeps AM (03:00)', () => {
    const result = parseAbsoluteTime('מחר בשעה 3 בבוקר', REF);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(3);
  });

  it('"בשעה 7 בערב" → PM (19:00)', () => {
    const result = parseAbsoluteTime('מחר בשעה 7 בערב', REF);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(19);
  });

  it('returns null for unrecognized time', () => {
    const result = parseAbsoluteTime('שלום', REF);
    expect(result).toBeNull();
  });

  it('Hebrew number word hour: "בשעה שמונה" → 08:00', () => {
    const result = parseAbsoluteTime('מחר בשעה שמונה בבוקר', REF);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(8);
  });
});

describe('parseHebrewTime (main entry)', () => {
  it('routes relative expressions to parseRelativeTime', () => {
    const result = parseHebrewTime('בעוד 5 דקות', REF);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(REF.getTime() + 5 * MINUTE);
  });

  it('routes absolute expressions to parseAbsoluteTime', () => {
    const result = parseHebrewTime('מחר בשעה 8', REF);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(REF.getDate() + 1);
  });

  it('"בקרוב" → +5 minutes', () => {
    const result = parseHebrewTime('בקרוב', REF);
    expect(result!.getTime()).toBe(REF.getTime() + 5 * MINUTE);
  });

  it('returns null for invalid input', () => {
    const result = parseHebrewTime('שלום עולם', REF);
    expect(result).toBeNull();
  });

  it('uses current time as default reference', () => {
    const before = Date.now();
    const result = parseHebrewTime('בעוד שעה');
    const after = Date.now();
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeGreaterThanOrEqual(before + HOUR);
    expect(result!.getTime()).toBeLessThanOrEqual(after + HOUR);
  });
});
