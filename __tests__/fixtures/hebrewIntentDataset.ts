import { Intent } from '../../src/types';

export interface IntentTestCase {
  input: string;
  expectedIntent: Intent;
  expectedContact?: string | null;
  expectedMessage?: string | null;
  expectedAppName?: string | null;
  expectedReminderText?: string | null;
  expectedReminderTime?: string | null;
  expectedCount?: number | null;
  description: string;
}

export const hebrewIntentDataset: IntentTestCase[] = [
  // ── LIST_REMINDERS ──
  {
    input: 'מה התזכורות שלי',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: '__LIST__',
    description: 'LIST_REMINDERS — "what are my reminders"',
  },
  {
    input: 'הראה לי את התזכורות',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: '__LIST__',
    description: 'LIST_REMINDERS — "show me the reminders"',
  },
  {
    input: 'תזכורות',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: '__LIST__',
    description: 'LIST_REMINDERS — bare "reminders"',
  },

  // ── SET_REMINDER (Pattern A) ──
  {
    input: 'תזכיר לי בעוד 5 דקות לקנות חלב',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'קנות חלב',
    expectedReminderTime: 'בעוד 5 דקות',
    description: 'SET_REMINDER A — Pattern A consumes ל boundary, text="קנות חלב"',
  },
  {
    input: 'תזכיר לי בעוד שעה שצריך לצאת',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'צריך לצאת',
    expectedReminderTime: 'בעוד שעה',
    description: 'SET_REMINDER A — ש boundary stripped by buildReminderIntent',
  },

  // ── SET_REMINDER (Pattern B) ──
  {
    input: 'תזכיר לי לקנות מתנה בעוד שעתיים',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'לקנות מתנה',
    expectedReminderTime: 'בעוד שעתיים',
    description: 'SET_REMINDER B — text first, time last',
  },

  // ── SET_REMINDER (Pattern C) ──
  {
    input: 'רשום לי תזכורת בעוד 10 דקות לצאת מהבית',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'צאת מהבית',
    expectedReminderTime: 'בעוד 10 דקות',
    description: 'SET_REMINDER C — Pattern C consumes ל boundary',
  },
  {
    input: 'רשום לי תזכורת לקנות מתנה ליום הולדת של אמא',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'לקנות מתנה ליום הולדת של אמא',
    expectedReminderTime: null,
    description: 'SET_REMINDER C (no time) — reminder text only',
  },

  // ── SET_REMINDER (Pattern D) ──
  {
    input: 'אל תתן לי לשכוח בעוד שעה להוציא כביסה',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'הוציא כביסה',
    expectedReminderTime: 'בעוד שעה',
    description: 'SET_REMINDER D time-first — ל boundary consumed',
  },
  {
    input: 'אל תתן לי לשכוח לקנות חלב בערב',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'לקנות חלב בערב',
    expectedReminderTime: null,
    description: 'SET_REMINDER D — "בערב" not anchored, falls to no-time pattern',
  },
  {
    input: 'אל תתן לי לשכוח לקנות חלב',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'לקנות חלב',
    expectedReminderTime: null,
    description: 'SET_REMINDER D (no time) — "don\'t let me forget"',
  },

  // ── SET_REMINDER (Pattern E) ──
  {
    input: 'תתריע לי בעוד 10 דקות שצריך לצאת',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'צריך לצאת',
    expectedReminderTime: 'בעוד 10 דקות',
    description: 'SET_REMINDER E — "alert me" with numeric time',
  },
  {
    input: 'תתריע לי שצריך לצאת',
    expectedIntent: 'SET_REMINDER',
    expectedReminderText: 'צריך לצאת',
    expectedReminderTime: null,
    description: 'SET_REMINDER E (no time) — "alert me that"',
  },

  // ── SET_REMINDER wins over other intents ──
  {
    input: 'תזכיר לי בעוד שעה לשלוח הודעה לאמא',
    expectedIntent: 'SET_REMINDER',
    description: 'SET_REMINDER priority — contains "send message" but is a reminder',
  },
  {
    input: 'תזכיר לי מחר בשעה 8 להתקשר לדוד',
    expectedIntent: 'SET_REMINDER',
    description: 'SET_REMINDER priority — contains "call" but is a reminder',
  },

  // ── SEND_WHATSAPP (Pattern A) ──
  {
    input: 'תשלח בוואטסאפ לאבא שאני בדרך',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'אבא',
    expectedMessage: 'שאני בדרך',
    description: 'SEND_WHATSAPP A — verb + platform + contact + message (ש kept)',
  },
  {
    input: 'תשלח הודעה לאמא שאני מאחר',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'אמא',
    expectedMessage: 'שאני מאחר',
    description: 'SEND_WHATSAPP A — "send message" routes to WA (ש kept)',
  },
  {
    input: 'שלח הודעת ווצאפ לבנימין מה קורה',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'בנימין',
    expectedMessage: 'מה קורה',
    description: 'SEND_WHATSAPP A — alternate spelling ווצאפ',
  },
  {
    input: 'תשלח הודעת ווטסאפ לדני שלום',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'דני',
    expectedMessage: 'שלום',
    description: 'SEND_WHATSAPP A — alternate spelling ווטסאפ',
  },
  {
    input: 'אפשר לשלוח הודעה לגיל בוקר טוב',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'גיל',
    expectedMessage: 'בוקר טוב',
    description: 'SEND_WHATSAPP A — polite prefix "אפשר"',
  },

  // ── SEND_WHATSAPP (Pattern B) ──
  {
    input: 'לשלוח בוואטסאפ לדוד שלום',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'דוד',
    expectedMessage: 'שלום',
    description: 'SEND_WHATSAPP B — infinitive form',
  },

  // ── SEND_WHATSAPP (Pattern C — implicit verbs) ──
  {
    input: 'תרשום לבנימין מה קורה',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'בנימין',
    expectedMessage: 'מה קורה',
    description: 'SEND_WHATSAPP C — "write to" implicit verb',
  },
  {
    input: 'תגיד לאבא שאני בדרך הביתה',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'אבא',
    expectedMessage: 'שאני בדרך הביתה',
    description: 'SEND_WHATSAPP C — "tell" implicit verb (ש prefix kept by regex)',
  },

  // ── SEND_WHATSAPP — platform keyword stripping ──
  {
    input: 'תשלח לדני שלום בוואטסאפ',
    expectedIntent: 'SEND_WHATSAPP',
    expectedContact: 'דני',
    expectedMessage: 'שלום',
    description: 'SEND_WHATSAPP — strips trailing platform keyword from message',
  },

  // ── SEND_SMS ──
  {
    input: 'שלח הודעה לאמא אני בדרך',
    expectedIntent: 'SEND_WHATSAPP',
    description: 'Note: "שלח הודעה ל" routes to SEND_WHATSAPP (documented behavior)',
  },

  // ── MAKE_CALL ──
  {
    input: 'תתקשר לאבא',
    expectedIntent: 'MAKE_CALL',
    expectedContact: 'אבא',
    description: 'MAKE_CALL — תתקשר ל',
  },
  {
    input: 'תחייג לדוד יוסי',
    expectedIntent: 'MAKE_CALL',
    expectedContact: 'דוד יוסי',
    description: 'MAKE_CALL — תחייג ל',
  },
  {
    input: 'חייגי לאמא',
    expectedIntent: 'MAKE_CALL',
    expectedContact: 'אמא',
    description: 'MAKE_CALL — feminine חייגי',
  },
  {
    input: 'להתקשר לגיל',
    expectedIntent: 'MAKE_CALL',
    expectedContact: 'גיל',
    description: 'MAKE_CALL — infinitive form',
  },
  {
    input: 'תתקשר אל דני',
    expectedIntent: 'MAKE_CALL',
    expectedContact: 'דני',
    description: 'MAKE_CALL — אל preposition',
  },
  {
    input: 'תתקשר לאבא!',
    expectedIntent: 'MAKE_CALL',
    expectedContact: 'אבא',
    description: 'MAKE_CALL — strips punctuation',
  },
  {
    input: 'תוכל לחייג לאמא',
    expectedIntent: 'MAKE_CALL',
    expectedContact: 'אמא',
    description: 'MAKE_CALL — polite "can you call"',
  },

  // ── READ_SMS ──
  {
    input: 'תקרא לי את ההודעות',
    expectedIntent: 'READ_SMS',
    expectedCount: 5,
    description: 'READ_SMS — plural "messages" → count=5',
  },
  {
    input: 'תקרא את ההודעה האחרונה שלי',
    expectedIntent: 'READ_SMS',
    expectedCount: 1,
    description: 'READ_SMS — singular "last message" → count=1',
  },
  {
    input: 'תקריא לי את ההודעות',
    expectedIntent: 'READ_SMS',
    expectedCount: 5,
    description: 'READ_SMS — new verb תקריא',
  },
  {
    input: 'הקריא לי הודעות',
    expectedIntent: 'READ_SMS',
    expectedCount: 5,
    description: 'READ_SMS — new verb הקריא',
  },
  {
    input: 'הראה לי 3 הודעות',
    expectedIntent: 'READ_SMS',
    expectedCount: 3,
    description: 'READ_SMS — digit count "3 messages"',
  },
  {
    input: 'ההודעות שלי',
    expectedIntent: 'READ_SMS',
    expectedCount: 5,
    description: 'READ_SMS — "my messages"',
  },

  // ── READ_WHATSAPP ──
  {
    input: 'תקרא לי הודעות וואטסאפ',
    expectedIntent: 'READ_WHATSAPP',
    description: 'READ_WHATSAPP — basic',
  },

  // ── READ_NOTIFICATIONS ──
  {
    input: 'מה ההתראות שלי',
    expectedIntent: 'READ_NOTIFICATIONS',
    description: 'READ_NOTIFICATIONS — "what are my notifications"',
  },

  // ── OPEN_APP ──
  {
    input: 'תפתח וויז',
    expectedIntent: 'OPEN_APP',
    expectedAppName: 'וויז',
    description: 'OPEN_APP — open Waze',
  },
  {
    input: 'תפתח מצלמה',
    expectedIntent: 'OPEN_APP',
    expectedAppName: 'מצלמה',
    description: 'OPEN_APP — open Camera',
  },

  // ── UNKNOWN ──
  {
    input: 'מה מזג האוויר היום',
    expectedIntent: 'UNKNOWN',
    description: 'UNKNOWN — unrecognized input',
  },
  {
    input: '',
    expectedIntent: 'UNKNOWN',
    description: 'UNKNOWN — empty string',
  },
  {
    input: 'שלום',
    expectedIntent: 'UNKNOWN',
    description: 'UNKNOWN — greeting only',
  },
];
