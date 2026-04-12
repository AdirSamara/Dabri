import { normalizeHebrew } from '../utils/hebrewUtils';

// Hebrew number words → numeric values
const HEBREW_NUMBERS: Record<string, number> = {
  'אחת': 1, 'אחד': 1,
  'שתיים': 2, 'שניים': 2, 'שנייה': 2,
  'שלוש': 3, 'שלושה': 3,
  'ארבע': 4, 'ארבעה': 4,
  'חמש': 5, 'חמישה': 5,
  'שש': 6, 'שישה': 6,
  'שבע': 7, 'שבעה': 7,
  'שמונה': 8,
  'תשע': 9, 'תשעה': 9,
  'עשר': 10, 'עשרה': 10,
  'אחת עשרה': 11, 'אחד עשר': 11,
  'שתים עשרה': 12, 'שנים עשר': 12,
  'עשרים': 20,
  'שלושים': 30,
  'ארבעים': 40,
  'חמישים': 50,
};

// Hebrew day names → JS day index (0=Sunday)
const HEBREW_DAYS: Record<string, number> = {
  'ראשון': 0,
  'שני': 1,
  'שלישי': 2,
  'רביעי': 3,
  'חמישי': 4,
  'שישי': 5,
  'שבת': 6,
};

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Parse a Hebrew number string (digit or word) into a number.
 */
export function parseHebrewNumber(text: string): number | null {
  const trimmed = text.trim();

  // Try digit first
  const num = parseInt(trimmed, 10);
  if (!isNaN(num)) return num;

  // Try direct word match
  if (HEBREW_NUMBERS[trimmed] !== undefined) return HEBREW_NUMBERS[trimmed];

  // Try compound: "עשרים וחמש" → 25
  const compoundMatch = trimmed.match(/^(\S+)\s+ו(\S+)$/);
  if (compoundMatch) {
    const tens = HEBREW_NUMBERS[compoundMatch[1]];
    const units = HEBREW_NUMBERS[compoundMatch[2]];
    if (tens !== undefined && units !== undefined) return tens + units;
  }

  return null;
}

/**
 * Parse a relative Hebrew time expression (starts with בעוד/עוד).
 */
export function parseRelativeTime(
  normalized: string,
  ref: Date,
): Date | null {
  const refMs = ref.getTime();

  // "עוד קצת" → 15 minutes
  if (/עוד\s+קצת/.test(normalized)) {
    return new Date(refMs + 15 * MINUTE_MS);
  }

  // "בעוד חצי שעה" → 30 minutes
  if (/בעוד\s+חצי\s+שעה/.test(normalized)) {
    return new Date(refMs + 30 * MINUTE_MS);
  }

  // "בעוד רבע שעה" → 15 minutes
  if (/בעוד\s+רבע\s+שעה/.test(normalized)) {
    return new Date(refMs + 15 * MINUTE_MS);
  }

  // Dual forms: שעתיים, יומיים, שבועיים
  if (/בעוד\s+שעתיים/.test(normalized)) return new Date(refMs + 2 * HOUR_MS);
  if (/בעוד\s+יומיים/.test(normalized)) return new Date(refMs + 2 * DAY_MS);
  if (/בעוד\s+שבועיים/.test(normalized)) return new Date(refMs + 2 * WEEK_MS);

  // "בעוד שעה וחצי" → 90 minutes
  if (/בעוד\s+שעה\s+וחצי/.test(normalized)) {
    return new Date(refMs + 90 * MINUTE_MS);
  }

  // "בעוד שעה" (alone, no number) → 1 hour
  if (/בעוד\s+שעה(?!\s*ו)/.test(normalized)) {
    return new Date(refMs + HOUR_MS);
  }

  // "בעוד יום" → 1 day
  if (/בעוד\s+יום(?!יים)/.test(normalized)) return new Date(refMs + DAY_MS);

  // "בעוד שבוע" → 1 week
  if (/בעוד\s+שבוע(?!יים)/.test(normalized)) return new Date(refMs + WEEK_MS);

  // "בעוד חודש" → ~30 days
  if (/בעוד\s+חודש(?!יים)/.test(normalized)) return new Date(refMs + 30 * DAY_MS);

  // "בעוד X דקות/דקה"
  const minutesMatch = normalized.match(/בעוד\s+(.+?)\s+דקו?ת|בעוד\s+(.+?)\s+דקה/);
  if (minutesMatch) {
    const numStr = (minutesMatch[1] || minutesMatch[2]).trim();
    const n = parseHebrewNumber(numStr);
    if (n !== null) return new Date(refMs + n * MINUTE_MS);
  }

  // "בעוד X שעות"
  const hoursMatch = normalized.match(/בעוד\s+(.+?)\s+שעות/);
  if (hoursMatch) {
    const n = parseHebrewNumber(hoursMatch[1].trim());
    if (n !== null) return new Date(refMs + n * HOUR_MS);
  }

  // "בעוד X ימים"
  const daysMatch = normalized.match(/בעוד\s+(.+?)\s+ימים/);
  if (daysMatch) {
    const n = parseHebrewNumber(daysMatch[1].trim());
    if (n !== null) return new Date(refMs + n * DAY_MS);
  }

  // "בעוד X שבועות"
  const weeksMatch = normalized.match(/בעוד\s+(.+?)\s+שבועות/);
  if (weeksMatch) {
    const n = parseHebrewNumber(weeksMatch[1].trim());
    if (n !== null) return new Date(refMs + n * WEEK_MS);
  }

  // "בעוד X חודשים"
  const monthsMatch = normalized.match(/בעוד\s+(.+?)\s+חודשים/);
  if (monthsMatch) {
    const n = parseHebrewNumber(monthsMatch[1].trim());
    if (n !== null) return new Date(refMs + n * 30 * DAY_MS);
  }

  // "לעוד X ..." (alternate prefix form)
  const altPrefix = normalized.replace(/^לעוד\s+/, 'בעוד ');
  if (altPrefix !== normalized) {
    return parseRelativeTime(altPrefix, ref);
  }

  return null;
}

/**
 * Parse an absolute Hebrew time expression.
 */
export function parseAbsoluteTime(
  normalized: string,
  ref: Date,
): Date | null {
  const result = new Date(ref);

  // --- Determine base date ---
  let dateSet = false;

  if (/מחרתיים/.test(normalized)) {
    result.setDate(result.getDate() + 2);
    dateSet = true;
  } else if (/מחר/.test(normalized)) {
    result.setDate(result.getDate() + 1);
    dateSet = true;
  }

  // "ביום ראשון/שני/..."
  const dayMatch = normalized.match(/ביום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/);
  if (dayMatch) {
    const targetDay = HEBREW_DAYS[dayMatch[1]];
    if (targetDay !== undefined) {
      const current = result.getDay();
      let daysAhead = targetDay - current;
      if (daysAhead <= 0) daysAhead += 7;
      result.setDate(result.getDate() + daysAhead);
      dateSet = true;
    }
  }

  // --- Determine hour and minute ---
  let hourSet = false;
  let hour = 9; // default
  let minute = 0;

  // "בשעה 8:30" or "בשעה 8"
  const clockMatch = normalized.match(/בשעה\s+(\d{1,2})(?::(\d{2}))?/);
  if (clockMatch) {
    hour = parseInt(clockMatch[1], 10);
    minute = clockMatch[2] ? parseInt(clockMatch[2], 10) : 0;
    hourSet = true;
  }

  // "ב-8:30" or "ב-8"
  if (!hourSet) {
    const dashMatch = normalized.match(/ב-?(\d{1,2})(?::(\d{2}))?/);
    if (dashMatch) {
      hour = parseInt(dashMatch[1], 10);
      minute = dashMatch[2] ? parseInt(dashMatch[2], 10) : 0;
      hourSet = true;
    }
  }

  // "בשעה שמונה" (Hebrew number word for hour)
  if (!hourSet) {
    const hebrewHourMatch = normalized.match(
      /בשעה\s+(אחת|שתיים|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|אחת עשרה|שתים עשרה)/
    );
    if (hebrewHourMatch) {
      const h = parseHebrewNumber(hebrewHourMatch[1]);
      if (h !== null) {
        hour = h;
        hourSet = true;
      }
    }
  }

  // Standalone time-of-day keywords (only if no specific hour set)
  if (!hourSet) {
    if (/בבוקר/.test(normalized)) {
      hour = 8;
      hourSet = true;
    } else if (/בצהריים/.test(normalized)) {
      hour = 12;
      hourSet = true;
    } else if (/בערב/.test(normalized)) {
      hour = 19;
      hourSet = true;
    } else if (/בלילה/.test(normalized)) {
      hour = 22;
      hourSet = true;
    }
  }

  // --- AM/PM disambiguation ---
  if (hourSet && hour <= 12) {
    const hasEvening = /בערב/.test(normalized);
    const hasNight = /בלילה/.test(normalized);
    const hasMorning = /בבוקר/.test(normalized);
    const hasAfternoon = /אחרי\s+הצהריים|אחה"צ/.test(normalized);

    if ((hasEvening || hasNight) && hour >= 1 && hour <= 9) {
      hour += 12;
    } else if (hasAfternoon && hour >= 1 && hour <= 6) {
      hour += 12;
    } else if (!hasMorning && !hasEvening && !hasNight && !hasAfternoon) {
      // Bare number — use context: if the hour is already past, assume PM
      if (hour <= 6) {
        hour += 12; // Bare numbers 1-6 are almost always PM
      } else if (hour >= 7 && hour <= 12) {
        // If current time is past this hour, assume PM for today
        if (!dateSet && ref.getHours() >= hour) {
          hour += 12;
        }
      }
    }
  }

  // If no date or time was set, we can't resolve
  if (!dateSet && !hourSet) return null;

  result.setHours(hour, minute, 0, 0);

  // --- Past-time rollover ---
  if (result.getTime() <= ref.getTime()) {
    if (!dateSet) {
      // No specific date → roll to tomorrow
      result.setDate(result.getDate() + 1);
    }
    // If a specific date was set and it's still in the past, return null
    if (result.getTime() <= ref.getTime()) {
      return null;
    }
  }

  return result;
}

/**
 * Main entry: parse any Hebrew time expression to a Date.
 */
export function parseHebrewTime(
  timeStr: string,
  referenceDate?: Date,
): Date | null {
  const ref = referenceDate ?? new Date();
  const normalized = normalizeHebrew(timeStr);

  // Check for relative time (בעוד / עוד / לעוד)
  if (/(?:בעוד|^עוד|לעוד)\s/.test(normalized)) {
    return parseRelativeTime(normalized, ref);
  }

  // Otherwise try absolute time
  return parseAbsoluteTime(normalized, ref);
}
