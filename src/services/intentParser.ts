import { ParsedIntent, Intent } from '../types';
import { GoogleGenerativeAI, ResponseSchema } from "@google/generative-ai";
import { GEMINI_MODEL, INTENT_PARSER_PROMPT } from '../utils/constants';

const KNOWN_INTENTS: Intent[] = [
  'SEND_SMS',
  'READ_SMS',
  'MAKE_CALL',
  'SEND_WHATSAPP',
  'READ_WHATSAPP',
  'READ_NOTIFICATIONS',
  'SET_REMINDER',
  'NAVIGATE',
  'OPEN_APP',
  'UNKNOWN',
];

const UNKNOWN_INTENT: ParsedIntent = {
  intent: 'UNKNOWN',
  contact: null,
  message: null,
  appName: null,
  destination: null,
  navApp: null,
  reminderText: null,
  reminderTime: null,
  count: null,
  source: 'regex',
};

// Parse how many SMS messages the user asked for
function smsCount(text: string): number {
  // "הודעה האחרונה" / "הודעה אחרונה" → 1
  if (/הודע[הת]\s+(?:ה)?אחרונה/.test(text)) return 1;

  // Digit: "3 הודעות" / "5 הודעות"
  const digitMatch = text.match(/(\d+)\s+הודעו?ת/);
  if (digitMatch) return Math.min(parseInt(digitMatch[1], 10), 5);

  // Hebrew number words before הודעות
  const SMS_NUMBERS: Record<string, number> = {
    'שתי': 2, 'שתיים': 2, 'שני': 2, 'שניים': 2,
    'שלוש': 3, 'שלושה': 3, 'שלושת': 3,
    'ארבע': 4, 'ארבעה': 4, 'ארבעת': 4,
    'חמש': 5, 'חמישה': 5, 'חמשת': 5,
    'שש': 6, 'שישה': 6, 'ששת': 6,
    'שבע': 7, 'שבעה': 7, 'שבעת': 7,
    'שמונה': 8, 'שמונת': 8,
    'תשע': 9, 'תשעה': 9, 'תשעת': 9,
    'עשר': 10, 'עשרה': 10, 'עשרת': 10,
  };
  const hebrewMatch = text.match(
    /(שתי|שתיים|שני|שניים|שלוש|שלושה|שלושת|ארבע|ארבעה|ארבעת|חמש|חמישה|חמשת|שש|שישה|ששת|שבע|שבעה|שבעת|שמונה|שמונת|תשע|תשעה|תשעת|עשר|עשרה|עשרת)\s+(?:ה)?הודעו?ת/
  );
  if (hebrewMatch && SMS_NUMBERS[hebrewMatch[1]] !== undefined) {
    return SMS_NUMBERS[hebrewMatch[1]];
  }

  // Default
  return 5;
}

/** Strip Hebrew grammar particles from a captured app name. */
function cleanAppName(raw: string): string {
  let name = raw.trim();
  // Strip leading את ה / את / ה (definite article)
  name = name.replace(/^את\s+ה/, '');
  name = name.replace(/^את\s+/, '');
  name = name.replace(/^ה(?=[א-ת])/, '');
  // Strip leading ל (residual from lamed-verbs)
  name = name.replace(/^ל(?=[א-ת])/, '');
  // Strip "לי" at start
  name = name.replace(/^לי\s+/, '');
  // Strip app-noun prefixes (belt-and-suspenders with regex)
  name = name.replace(/^אפליקציית\s+/, '');
  name = name.replace(/^אפליקציה\s+(?:של\s+)?/, '');
  name = name.replace(/^יישום\s+/, '');
  name = name.replace(/^תוכנת\s+/, '');
  // Strip trailing בבקשה
  name = name.replace(/\s+בבקשה$/, '');
  return name.trim();
}

/** Strip Hebrew grammar particles from a captured navigation destination. */
function cleanDestination(raw: string): string {
  let dest = raw.trim();
  dest = dest.replace(/^את\s+ה/, '');
  dest = dest.replace(/^את\s+/, '');
  dest = dest.replace(/^ה(?=[א-ת])/, '');
  dest = dest.replace(/^לי\s+/, '');
  dest = dest.replace(/\s+בבקשה$/, '');
  dest = dest.replace(/^בבקשה\s+/, '');
  return dest.trim();
}

/** Extract explicit nav-app preference from the full utterance. */
function extractNavApp(text: string): 'waze' | 'google_maps' | null {
  if (/וויז|ווייז|ויז|waze/i.test(text)) return 'waze';
  if (/גוגל\s*מפות|google\s*maps/i.test(text)) return 'google_maps';
  return null;
}

function parseIntentWithRegex(text: string): ParsedIntent {
  console.log('[intentParser] Using REGEX parser for:', text);

  // ── 0. SET_REMINDER — checked FIRST so reminder content containing action
  //    keywords (לחייג, לשלוח, לפתוח etc.) is not hijacked by later patterns ──

  // LIST_REMINDERS — various Hebrew phrasings for "show me my reminders"
  if (
    /(?:מה|איזה|אילו|כמה)\s+(?:ה)?תזכורות\s+(?:שלי|שיש\s+לי|יש\s+לי)/.test(text) ||
    /(?:תגיד|אמור)\s+לי.*תזכורות/.test(text) ||
    /(?:תראה|תראי|הראה|הראי|תציג|הצג|תקרא|קרא|תפתח|פתח)\s+(?:לי\s+)?(?:את\s+)?(?:ה)?תזכורות/.test(text) ||
    /יש\s+לי\s+תזכורות/.test(text) ||
    /רשימת\s+(?:ה)?תזכורות/.test(text) ||
    /^(?:ה)?תזכורות(?:\s+שלי)?$/.test(text.trim())
  ) {
    return buildReminderIntent('__LIST__', null);
  }

  // SET_REMINDER — 5 pattern families (A-E)
  const POLITE = '(?:(?:בבקשה|אפשר|תוכל|תוכלי)\\s+)?';
  const REMIND_VERBS = '(?:תזכיר|תזכירי|הזכר|הזכירי|להזכיר)';
  const SET_VERBS = '(?:שים|שימי|תקבע|תקבעי|תעשה|תעשי|רשום|רשמי)';
  const DONT_FORGET_A = 'אל\\s+(?:תתן|תתני)\\s+לי\\s+לשכוח';
  const DONT_FORGET_B = 'אל\\s+(?:תשכח|תשכחי)\\s+להזכיר\\s+לי';
  const ALERT_VERBS = '(?:תתריע|תתריעי|תיידע|תיידעי)';
  const TIME_ANCHOR = '((?:בעוד|לעוד|מחר|מחרתיים|בשעה|ב-?\\d|ביום|בבוקר|בצהריים|בערב|בלילה|עוד).+?)';

  let rm: RegExpMatchArray | null;

  // Pattern A: REMIND_VERB לי [time] [ל/ש + text]
  rm = text.match(new RegExp(POLITE + REMIND_VERBS + '\\s+לי\\s+' + TIME_ANCHOR + '\\s+(?:ל|ש)(.+)', 'i'));
  if (rm) return buildReminderIntent(rm[2], rm[1]);

  // Pattern B: REMIND_VERB לי [text] [time]
  rm = text.match(new RegExp(POLITE + REMIND_VERBS + '\\s+לי\\s+(.+?)\\s+' + TIME_ANCHOR + '$', 'i'));
  if (rm) return buildReminderIntent(rm[1], rm[2]);

  // Pattern C: SET_VERB לי תזכורת [time?] [ל/ש + text]
  rm = text.match(new RegExp(POLITE + SET_VERBS + '\\s+לי\\s+תזכורת\\s+' + TIME_ANCHOR + '\\s+(?:ל|ש)(.+)', 'i'));
  if (rm) return buildReminderIntent(rm[2], rm[1]);

  // Pattern C (no time): "רשום לי תזכורת לקנות מתנה"
  rm = text.match(new RegExp(POLITE + SET_VERBS + '\\s+לי\\s+תזכורת\\s+(.+)', 'i'));
  if (rm) return buildReminderIntent(rm[1], null);

  // Pattern D (time-first): "אל תתן לי לשכוח בעוד שעה להוציא כביסה"
  rm = text.match(new RegExp('(?:' + DONT_FORGET_A + '|' + DONT_FORGET_B + ')\\s+' + TIME_ANCHOR + '\\s+(?:ל|ש)(.+)', 'i'));
  if (rm) return buildReminderIntent(rm[2], rm[1]);

  // Pattern D (text-first): "אל תתן לי לשכוח לקנות חלב בערב"
  rm = text.match(new RegExp('(?:' + DONT_FORGET_A + '|' + DONT_FORGET_B + ')\\s+(.+?)\\s+' + TIME_ANCHOR + '$', 'i'));
  if (rm) return buildReminderIntent(rm[1], rm[2]);

  // Pattern D (no time): "אל תתן לי לשכוח לקנות חלב"
  rm = text.match(new RegExp('(?:' + DONT_FORGET_A + '|' + DONT_FORGET_B + ')\\s+(.+)', 'i'));
  if (rm) return buildReminderIntent(rm[1], null);

  // Pattern E: ALERT_VERB [לי|אותי] [time?] [ש/ל/על + text]
  rm = text.match(new RegExp(POLITE + ALERT_VERBS + '\\s+(?:לי|אותי)\\s+' + TIME_ANCHOR + '\\s+(?:ש|ל|על\\s+)(.+)', 'i'));
  if (rm) return buildReminderIntent(rm[2], rm[1]);

  // Pattern E (no time): "תתריע לי שצריך לצאת"
  rm = text.match(new RegExp(POLITE + ALERT_VERBS + '\\s+(?:לי|אותי)\\s+(?:ש|ל|על\\s+)(.+)', 'i'));
  if (rm) return buildReminderIntent(rm[1], null);

  // ── 1. SEND_WHATSAPP — checked before SEND_SMS so "הודעה" verbs are claimed here first
  const WA_VERBS =
    '(?:תשלח|תשלחי|שלח|שלחי|לשלוח|תרשום|תרשמי|תכתוב|תכתבי|תגיד|תגידי|תודיע|תודיעי|תעביר|תעבירי)';
  const WA_PLATFORM_INNER = '(?:וואטסאפ|ווצאפ|ווטסאפ|whatsapp)';
  const WA_PLATFORM = `(?:ב|ה)?${WA_PLATFORM_INNER}`;

  // Pattern A: prefix? + verb + optional(noun + platform | noun) + ל + contact + message
  // prefix: אפשר, בבקשה, תוכל, תוכלי
  // noun: הודעת (construct state) or הודעה (absolute), optionally followed by platform keyword
  const sendWaPatternA = new RegExp(
    `(?:(?:אפשר|בבקשה|תוכל|תוכלי)\\s+)?${WA_VERBS}\\s+` +
    `(?:(?:(?:הודעת|הודעה)\\s+)?${WA_PLATFORM}\\s+|הודעה\\s+)?` +
    `(?:ל|אל)([^?!.\\n]+?)\\s+(.+)`,
    'i',
  );
  // Pattern B: "לשלוח + optional noun + platform + ל..." form
  const sendWaPatternB = new RegExp(
    `לשלוח\\s+(?:(?:הודעת|הודעה)\\s+)?${WA_PLATFORM}\\s+(?:ל|אל)([^?!.\\n]+?)\\s+(.+)`,
    'i',
  );
  // Pattern C: implicit messaging verbs — never used for SMS/calls
  // min 2 chars for contact to avoid capturing single-letter pronouns (לו/לה)
  const sendWaPatternC = new RegExp(
    `(?:תרשום|תרשמי|תכתוב|תכתבי|תגיד|תגידי|תודיע|תודיעי|תעביר|תעבירי)\\s+ל([^?!.\\n]{2,}?)\\s+(.+)`,
  );

  const sendWaMatch =
    sendWaPatternA.exec(text) ||
    sendWaPatternB.exec(text) ||
    sendWaPatternC.exec(text);

  if (sendWaMatch) {
    const rawMessage = sendWaMatch[2]
      .replace(/\s+(?:ב|ה)?(?:וואטסאפ|ווצאפ|ווטסאפ|whatsapp)\s*$/i, '')    // strip platform keyword from end
      .trim();
    return {
      intent: 'SEND_WHATSAPP',
      contact: sendWaMatch[1].trim(),
      message: rawMessage,
      appName: null,
      destination: null,
      navApp: null,
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    };
  }

  // 2. SEND_SMS — explicit "שלח הודעה ל..." (unambiguous SMS)
  const sendSmsMatch = text.match(/שלח\s+הודעה\s+ל(.+?)\s+(.+)/);
  if (sendSmsMatch) {
    return {
      intent: 'SEND_SMS',
      contact: sendSmsMatch[1].trim(),
      message: sendSmsMatch[2].trim(),
      appName: null,
      destination: null,
      navApp: null,
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    };
  }

  // 3. MAKE_CALL
  const callMatch = text.match(
    /(?:תתקשר|תתקשרי|תקשר|תקשרי|התקשר|התקשרי|תחייג|תחייגי|חייג|חייגי|להתקשר|לחייג|תוכל\s+(?:לחייג|להתקשר|לקשר))\s+(?:אל\s+|ל)([^\?!.]+)/,
  );
  if (callMatch) {
    return {
      intent: 'MAKE_CALL',
      contact: callMatch[1].trim().replace(/[\?!.]+$/, ''),
      message: null,
      appName: null,
      destination: null,
      navApp: null,
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    };
  }

  // 4. READ_WHATSAPP
  if (/קרא.*(?:וואטסאפ|ווטסאפ)/.test(text)) {
    return {
      intent: 'READ_WHATSAPP',
      contact: null,
      message: null,
      appName: null,
      destination: null,
      navApp: null,
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    };
  }

  // 5. READ_SMS — supports "תקרא/תקריא/תראה/תראי לי X הודעות"
  if (/(?:תקרא|תקראי|קרא|קראי|תקריא|תקריאי|הקריא|הקריאי|תראה|תראי|הצג|הציגי|הראה|הראי).*הודע|הודע(?:ה|ות).*(?:שלי|שקיבלתי|האחרונ)/.test(text)) {
    return {
      intent: 'READ_SMS',
      contact: null,
      message: null,
      appName: null,
      destination: null,
      navApp: null,
      reminderText: null,
      reminderTime: null,
      count: smsCount(text),
      source: 'regex',
    };
  }

  // 6. READ_NOTIFICATIONS
  if (/התראות/.test(text)) {
    return {
      intent: 'READ_NOTIFICATIONS',
      contact: null,
      message: null,
      appName: null,
      destination: null,
      navApp: null,
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    };
  }

  // ── 7. NAVIGATE ────────────────────────────────────────────────────────
  // Checked BEFORE OPEN_APP because they share verbs (תפתח, תדליק, קח אותי).
  // "תפתח וויז לתל אביב" → NAVIGATE; "תפתח וויז" (no dest) → falls to OPEN_APP.

  const NAV_APP_KW = '(?:וויז|ווייז|ויז|וויס|waze|גוגל\\s*מפות|google\\s*maps|ניווט|מפות)';
  const NAV_POLITE_SUFFIX = '(?:\\s+בבקשה)?';

  // Reuse POLITE from SET_REMINDER section (already defined above)

  // Direct verbs shared with OPEN_APP (reused below in OPEN_APP too)
  const NAV_OPEN_DIRECT =
    '(?:תפתח|תפתחי|פתח|פתחי|לפתוח' +
    '|תפעיל|תפעילי|הפעל|הפעילי|להפעיל' +
    '|תריץ|תריצי|הרץ|הריצי|להריץ' +
    '|תעלה|תעלי|העלה|להעלות' +
    '|תדליק|תדליקי|הדלק|הדליקי|להדליק)';

  // --- Group 6: Nav-app + destination (resolves OPEN_APP conflict) ---
  const nav6_waze_verb = new RegExp(
    '(?:תוויז|תווייז|תוויזי)(?:\\s+לי)?' + NAV_POLITE_SUFFIX + '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav6_waze_verb_home = new RegExp(
    '(?:תוויז|תווייז|תוויזי)(?:\\s+לי)?' + NAV_POLITE_SUFFIX + '\\s+(הביתה)', 'i');
  const nav6_open_app = new RegExp(
    NAV_OPEN_DIRECT + '(?:\\s+לי)?\\s+(?:את\\s+)?(?:ה)?' + NAV_APP_KW +
    NAV_POLITE_SUFFIX + '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav6_open_app_home = new RegExp(
    NAV_OPEN_DIRECT + '(?:\\s+לי)?\\s+(?:את\\s+)?(?:ה)?' + NAV_APP_KW +
    NAV_POLITE_SUFFIX + '\\s+(הביתה)', 'i');
  const nav6_put = new RegExp(
    '(?:שים|שימי|תשים|תשימי)(?:\\s+לי)?\\s+' + NAV_APP_KW +
    NAV_POLITE_SUFFIX + '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav6_put_home = new RegExp(
    '(?:שים|שימי|תשים|תשימי)(?:\\s+לי)?\\s+' + NAV_APP_KW +
    NAV_POLITE_SUFFIX + '\\s+(הביתה)', 'i');
  const nav6_start = new RegExp(
    '(?:התחל|התחילי|תתחיל|תתחילי|הפעל|הפעילי|תפעיל|תפעילי|תדליק|תדליקי)\\s+ניווט' +
    NAV_POLITE_SUFFIX + '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav6_start_home = new RegExp(
    '(?:התחל|התחילי|תתחיל|תתחילי|הפעל|הפעילי|תפעיל|תפעילי|תדליק|תדליקי)\\s+ניווט' +
    NAV_POLITE_SUFFIX + '\\s+(הביתה)', 'i');

  // --- Group 4: "Show me the way/route to" ---
  const nav4 = new RegExp(
    '(?:תראה|תראי|הראה|הראי)\\s+לי\\s+את\\s+(?:הדרך|המסלול)' +
    NAV_POLITE_SUFFIX + '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav4_home = new RegExp(
    '(?:תראה|תראי|הראה|הראי)\\s+לי\\s+את\\s+(?:הדרך|המסלול)' +
    NAV_POLITE_SUFFIX + '\\s+(הביתה)', 'i');

  // --- Group 3: "How to get to" ---
  const nav3 = new RegExp(
    'איך\\s+(?:מגיעים|להגיע|אפשר\\s+להגיע|אני\\s+(?:מגיע|מגיעה))' +
    '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav3_home = new RegExp(
    'איך\\s+(?:מגיעים|להגיע|אפשר\\s+להגיע|אני\\s+(?:מגיע|מגיעה))' +
    '\\s+(הביתה)', 'i');

  // --- Group 1: Direct navigate verbs ---
  const NAV_DIRECT = '(?:תנווט|נווט|תנווטי|נווטי|לנווט)';
  const nav1 = new RegExp(
    POLITE + NAV_DIRECT + NAV_POLITE_SUFFIX +
    '(?:\\s+אותי)?\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav1_home = new RegExp(
    POLITE + NAV_DIRECT + NAV_POLITE_SUFFIX +
    '(?:\\s+אותי)?\\s+(הביתה)', 'i');

  // --- Group 5: Drive/go to ---
  const NAV_DRIVE = '(?:סע|סעי|תיסע|תיסעי|לנסוע|נסע)';
  const nav5 = new RegExp(
    POLITE + NAV_DRIVE + NAV_POLITE_SUFFIX + '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav5_home = new RegExp(
    POLITE + NAV_DRIVE + NAV_POLITE_SUFFIX + '\\s+(הביתה)', 'i');

  // --- Group 2: "Take me to" / "Bring me" / "Lead me" ---
  // NOTE: excludes תעביר/תעבירי — those stay in OPEN_APP Pattern D only
  const NAV_TAKE = '(?:קח|קחי|תיקח|תיקחי|תביא|תביאי|הבא|הביאי|תוביל|תובילי|הוביל|תנחה|תנחי|הנחה)';
  const nav2 = new RegExp(
    POLITE + NAV_TAKE + '\\s+אותי' + NAV_POLITE_SUFFIX +
    '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav2_home = new RegExp(
    POLITE + NAV_TAKE + '\\s+אותי' + NAV_POLITE_SUFFIX + '\\s+(הביתה)', 'i');

  // --- Group 7: "I want/need to get to" ---
  const nav7 = new RegExp(
    'אני\\s+(?:רוצה|צריך|צריכה)\\s+(?:להגיע|לנסוע|לנווט)' +
    '\\s+(?:ל|אל\\s+)(.+)', 'i');
  const nav7_home = new RegExp(
    'אני\\s+(?:רוצה|צריך|צריכה)\\s+(?:להגיע|לנסוע|לנווט)\\s+(הביתה)', 'i');

  // --- Group 8: Keyword-only + destination ---
  const nav8_kw_home = new RegExp(NAV_APP_KW + '\\s+(הביתה)', 'i');
  const nav8_kw = new RegExp(
    '(?:מסלול|כיוונים|הכוונה|ניווט|וויז|ווייז|ויז)\\s+(?:ל|אל\\s+)(.+)', 'i');

  // Match in order: most specific first
  const navMatch =
    // Group 6: nav-app + destination (always NAVIGATE)
    nav6_waze_verb.exec(text) || nav6_waze_verb_home.exec(text) ||
    nav6_open_app.exec(text) || nav6_open_app_home.exec(text) ||
    nav6_put.exec(text) || nav6_put_home.exec(text) ||
    nav6_start.exec(text) || nav6_start_home.exec(text) ||
    // Group 4: "show me the way"
    nav4.exec(text) || nav4_home.exec(text) ||
    // Group 3: "how to get to"
    nav3.exec(text) || nav3_home.exec(text) ||
    // Group 1: direct navigate verbs
    nav1.exec(text) || nav1_home.exec(text) ||
    // Group 5: drive/go
    nav5.exec(text) || nav5_home.exec(text) ||
    // Group 2: "take me to" (broad — has guard below)
    nav2.exec(text) || nav2_home.exec(text) ||
    // Group 7: want/need
    nav7.exec(text) || nav7_home.exec(text) ||
    // Group 8: keyword + destination (broadest, last)
    nav8_kw_home.exec(text) || nav8_kw.exec(text);

  if (navMatch) {
    const destination = cleanDestination(navMatch[1]);

    if (destination.length > 0) {
      // Guard for Group 2: if destination is ONLY a nav-app name → fall through to OPEN_APP
      const NAV_APP_ONLY = /^(?:וויז|ווייז|ויז|וויס|waze|גוגל\s*מפות|google\s*maps)$/i;
      const matchedNav2 = nav2.exec(text);
      const matchedNav2Home = nav2_home.exec(text);
      const isGroup2 = (matchedNav2 && matchedNav2[0] === navMatch[0]) ||
                        (matchedNav2Home && matchedNav2Home[0] === navMatch[0]);

      if (!(isGroup2 && NAV_APP_ONLY.test(destination))) {
        return {
          intent: 'NAVIGATE',
          contact: null,
          message: null,
          appName: null,
          destination,
          navApp: extractNavApp(text),
          reminderText: null,
          reminderTime: null,
          count: null,
          source: 'regex',
        };
      }
    }
  }

  // 8. OPEN_APP ─────────────────────────────────────────────────────────
  // NOTE: WhatsApp verbs (תרשום/תכתוב/תגיד/תודיע/תעביר alone) are EXCLUDED
  // to avoid conflicts with SEND_WHATSAPP (position 1).

  // Direct verbs: open, activate, run, bring up, turn on
  const OPEN_DIRECT =
    '(?:תפתח|תפתחי|פתח|פתחי|לפתוח' +
    '|תפעיל|תפעילי|הפעל|הפעילי|להפעיל' +
    '|תריץ|תריצי|הרץ|הריצי|להריץ' +
    '|תעלה|תעלי|העלה|להעלות' +
    '|תדליק|תדליקי|הדלק|הדליקי|להדליק)';

  // Lamed-prefix verbs: enter, switch to
  const OPEN_LAMED =
    '(?:תיכנס|תיכנסי|היכנס|היכנסי|להיכנס' +
    '|תעבור|תעברי|עבור|עברי|לעבור)';

  const OA_POLITE = '(?:(?:בבקשה|אפשר|תוכל|תוכלי)\\s+)?';
  const OA_PARTICLES = '(?:\\s+לי)?(?:\\s+את)?(?:\\s+ה)?';
  const APP_NOUN = '(?:אפליקציית\\s+|אפליקציה\\s+(?:של\\s+)?|יישום\\s+|תוכנת\\s+)?';

  // Pattern A: direct verbs + optional particles + app name
  const openA = new RegExp(
    OA_POLITE + OPEN_DIRECT + OA_PARTICLES + '\\s+' + APP_NOUN + '(.+)', 'i',
  );

  // Pattern B: lamed-prefix verbs + ל/אל + app name
  const openB = new RegExp(
    OA_POLITE + OPEN_LAMED + '(?:\\s+לי)?\\s+(?:ל|אל\\s+)' + APP_NOUN + '(.+)', 'i',
  );

  // Pattern C: "show me" — תראה/תראי + לי + את + app (guard: not הודע)
  const openC = new RegExp(
    OA_POLITE + '(?:תראה|תראי)\\s+לי\\s+את\\s+(?:ה)?' + APP_NOUN + '((?!הודע).+)', 'i',
  );

  // Pattern D: "take me to" — requires אותי to avoid SEND_WHATSAPP conflict
  const openD = new RegExp(
    OA_POLITE + '(?:תיקח|קח|קחי|תיקחי|תעביר|תעבירי)\\s+אותי\\s+(?:ל|אל\\s+)' + APP_NOUN + '(.+)', 'i',
  );

  // Pattern E: polite + infinitive (direct) + particles + app
  const OPEN_INF = '(?:לפתוח|להפעיל|להריץ|להעלות|להדליק)';
  const openE = new RegExp(
    '(?:אפשר|תוכל|תוכלי)\\s+' + OPEN_INF + OA_PARTICLES + '\\s+' + APP_NOUN + '(.+)', 'i',
  );

  // Pattern F: polite + infinitive (lamed) + ל + app
  const OPEN_INF_L = '(?:להיכנס|לעבור)';
  const openF = new RegExp(
    '(?:אפשר|תוכל|תוכלי)\\s+' + OPEN_INF_L + '(?:\\s+לי)?\\s+(?:ל|אל\\s+)' + APP_NOUN + '(.+)', 'i',
  );

  const openAppMatch =
    openA.exec(text) || openB.exec(text) || openC.exec(text) ||
    openD.exec(text) || openE.exec(text) || openF.exec(text);

  if (openAppMatch) {
    return {
      intent: 'OPEN_APP',
      contact: null,
      message: null,
      appName: cleanAppName(openAppMatch[1]),
      destination: null,
      navApp: null,
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    };
  }

  return UNKNOWN_INTENT;
}

function buildReminderIntent(rawText: string, rawTime: string | null): ParsedIntent {
  // Strip leading ל/ש only when they are conjunctions, not part of a verb
  let text = rawText.trim();
  if (/^[לש]\s/.test(text)) {
    text = text.slice(2);
  } else if (/^[לש](?=[א-ת])/.test(text) && !/^(?:לא|של|שלי)/.test(text)) {
    // Keep infinitive-ל (לקנות, להתקשר) — only strip bare conjunction ש
    if (text.startsWith('ש')) {
      text = text.slice(1);
    }
  }

  return {
    intent: 'SET_REMINDER',
    contact: null,
    message: null,
    appName: null,
    destination: null,
    navApp: null,
    reminderText: text.trim(),
    reminderTime: rawTime?.trim() ?? null,
    count: null,
    source: 'regex',
  };
}

async function parseIntentWithGemini(text: string, apiKey: string): Promise<ParsedIntent> {
  console.log('[Gemini SDK] Starting intent parse for text length:', text.length);

  // 1. Initialize the SDK
  const genAI = new GoogleGenerativeAI(apiKey);

  // 2. Setup the model with generation configuration
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
      responseMimeType: 'application/json', // Forces JSON output
    },
  });

  try {
    // 3. Generate content
    const result = await model.generateContent(INTENT_PARSER_PROMPT + text);
    const response = await result.response;
    const rawText = response.text();

    if (!rawText) {
      throw new Error('Empty response from Gemini SDK');
    }

    // 4. Parse the JSON result
    const parsed = JSON.parse(rawText) as ParsedIntent;
    console.log('[Gemini SDK] Successfully parsed intent:', parsed.intent);

    if (!KNOWN_INTENTS.includes(parsed.intent)) {
      throw new Error(`Unknown intent returned: ${parsed.intent}`);
    }

    return { ...parsed, source: 'gemini' };

  } catch (error: any) {
    // SDK errors usually contain more specific info (like 429 for rate limits)
    console.error('[Gemini SDK] Error:', error.message || error);
    throw error;
  }
}

export async function parseIntent(text: string, apiKey: string): Promise<ParsedIntent> {
  // Try regex first (fast and doesn't use API quota)
  const regexResult = parseIntentWithRegex(text);

  // If regex found something other than UNKNOWN, return it
  if (regexResult.intent !== 'UNKNOWN') {
    console.log('[parseIntent] Regex matched:', regexResult.intent);
    return regexResult;
  }

  // If regex returned UNKNOWN and we have an API key, try Gemini
  if (apiKey) {
    try {
      console.log('[parseIntent] Regex returned UNKNOWN, trying Gemini');
      return await parseIntentWithGemini(text, apiKey);
    } catch (error) {
      console.log('[parseIntent] Gemini failed, falling back to regex UNKNOWN:', error);
      return regexResult;
    }
  }

  // No API key and regex couldn't parse it
  console.log('[parseIntent] No API key, returning regex UNKNOWN');
  return regexResult;
}
