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
  'OPEN_APP',
  'UNKNOWN',
];

const UNKNOWN_INTENT: ParsedIntent = {
  intent: 'UNKNOWN',
  contact: null,
  message: null,
  appName: null,
  reminderText: null,
  reminderTime: null,
  count: null,
  source: 'regex',
};

// Detects "הודעה האחרונה" / "הודעה אחרונה" (singular last) vs plural
function smsCount(text: string): number {
  return /הודע[הת]\s+(?:ה)?אחרונה/.test(text) ? 1 : 5;
}

function parseIntentWithRegex(text: string): ParsedIntent {
  console.log('[intentParser] Using REGEX parser for:', text);

  // ── 0. SET_REMINDER — checked FIRST so reminder content containing action
  //    keywords (לחייג, לשלוח, לפתוח etc.) is not hijacked by later patterns ──

  // LIST_REMINDERS — "מה התזכורות שלי"
  if (/(?:מה\s+)?(?:ה)?תזכורות\s+(?:שלי|שיש\s+לי)|(?:תגיד|אמור)\s+לי.*תזכורות/.test(text)) {
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
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    };
  }

  // 5. READ_SMS — count=1 for singular "הודעה האחרונה", else 5
  // Note: \b does not work with Hebrew (non-ASCII) — use plain alternation
  if (/(?:תקרא|קרא|תראה|הצג).*הודע|הודע(?:ה|ות).*שלי/.test(text)) {
    return {
      intent: 'READ_SMS',
      contact: null,
      message: null,
      appName: null,
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
      reminderText: null,
      reminderTime: null,
      count: null,
      source: 'regex',
    };
  }

  // 7. OPEN_APP
  const openAppMatch = text.match(/תפתח\s+(.+)/);
  if (openAppMatch) {
    return {
      intent: 'OPEN_APP',
      contact: null,
      message: null,
      appName: openAppMatch[1].trim(),
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
