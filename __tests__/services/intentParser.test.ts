import { parseIntent } from '../../src/services/intentParser';
import { hebrewIntentDataset } from '../fixtures/hebrewIntentDataset';

// Force regex-only path by passing empty API key
const parse = (text: string) => parseIntent(text, '');

describe('intentParser — regex path', () => {
  // ── Dataset-driven tests ──
  describe('Hebrew intent dataset', () => {
    for (const tc of hebrewIntentDataset) {
      it(tc.description, async () => {
        const result = await parse(tc.input);
        expect(result.intent).toBe(tc.expectedIntent);
        expect(result.source).toBe('regex');

        if (tc.expectedContact !== undefined) {
          expect(result.contact).toBe(tc.expectedContact);
        }
        if (tc.expectedMessage !== undefined) {
          expect(result.message).toBe(tc.expectedMessage);
        }
        if (tc.expectedAppName !== undefined) {
          expect(result.appName).toBe(tc.expectedAppName);
        }
        if (tc.expectedReminderText !== undefined) {
          expect(result.reminderText).toBe(tc.expectedReminderText);
        }
        if (tc.expectedReminderTime !== undefined) {
          expect(result.reminderTime).toBe(tc.expectedReminderTime);
        }
        if (tc.expectedCount !== undefined) {
          expect(result.count).toBe(tc.expectedCount);
        }
      });
    }
  });

  // ── Intent priority tests ──
  describe('intent priority order', () => {
    it('LIST_REMINDERS is checked first', async () => {
      const result = await parse('תזכורות');
      expect(result.intent).toBe('SET_REMINDER');
      expect(result.reminderText).toBe('__LIST__');
    });

    it('SET_REMINDER is checked before SEND_WHATSAPP', async () => {
      const result = await parse('תזכיר לי בעוד שעה לשלוח הודעה לדני');
      expect(result.intent).toBe('SET_REMINDER');
    });

    it('SET_REMINDER is checked before MAKE_CALL', async () => {
      const result = await parse('תזכיר לי מחר בבוקר להתקשר לדוד');
      expect(result.intent).toBe('SET_REMINDER');
    });

    it('SEND_WHATSAPP is checked before SEND_SMS', async () => {
      // "שלח הודעה ל" matches WA pattern A before SMS pattern
      const result = await parse('תשלח הודעה לאמא שלום');
      expect(result.intent).toBe('SEND_WHATSAPP');
    });
  });

  // ── SET_REMINDER specifics ──
  describe('SET_REMINDER', () => {
    it('strips leading ש conjunction from reminder text', async () => {
      const result = await parse('תזכיר לי בעוד שעה שצריך לצאת');
      expect(result.intent).toBe('SET_REMINDER');
      expect(result.reminderText).toBe('צריך לצאת');
    });

    it('Pattern A captures text after ל prefix', async () => {
      const result = await parse('תזכיר לי בעוד שעה לקנות חלב');
      expect(result.intent).toBe('SET_REMINDER');
      // Pattern A regex: ל/ש + text — ל is consumed by the regex group boundary
      expect(result.reminderText).toBe('קנות חלב');
    });

    it('polite prefix "בבקשה"', async () => {
      const result = await parse('בבקשה תזכיר לי בעוד חצי שעה לצאת');
      expect(result.intent).toBe('SET_REMINDER');
    });

    it('feminine form תזכירי', async () => {
      const result = await parse('תזכירי לי בעוד שעה לקנות לחם');
      expect(result.intent).toBe('SET_REMINDER');
    });

    it('Pattern C no-time: "רשום לי תזכורת לקחת תרופה"', async () => {
      const result = await parse('רשום לי תזכורת לקחת תרופה');
      expect(result.intent).toBe('SET_REMINDER');
      expect(result.reminderText).toBe('לקחת תרופה');
      expect(result.reminderTime).toBeNull();
    });
  });

  // ── LIST_REMINDERS variations ──
  describe('LIST_REMINDERS variations', () => {
    const listPhrases = [
      'מה התזכורות שלי',
      'איזה תזכורות יש לי',
      'תראה לי את התזכורות',
      'הצג תזכורות',
      'יש לי תזכורות',
      'רשימת התזכורות',
      'התזכורות שלי',
    ];

    for (const phrase of listPhrases) {
      it(`recognizes "${phrase}" as list query`, async () => {
        const result = await parse(phrase);
        expect(result.intent).toBe('SET_REMINDER');
        expect(result.reminderText).toBe('__LIST__');
      });
    }
  });

  // ── SEND_WHATSAPP specifics ──
  describe('SEND_WHATSAPP', () => {
    it('strips trailing WhatsApp platform keyword from message', async () => {
      const result = await parse('תשלח לדני שלום בוואטסאפ');
      expect(result.intent).toBe('SEND_WHATSAPP');
      expect(result.message).toBe('שלום');
    });

    it('works with all WhatsApp spellings', async () => {
      for (const spelling of ['וואטסאפ', 'ווצאפ', 'ווטסאפ']) {
        const result = await parse(`תשלח ב${spelling} לדני שלום`);
        expect(result.intent).toBe('SEND_WHATSAPP');
      }
    });

    it('implicit verb תכתוב with multi-word contact', async () => {
      const result = await parse('תכתוב לדני שלום');
      expect(result.intent).toBe('SEND_WHATSAPP');
      expect(result.contact).toBe('דני');
      expect(result.message).toBe('שלום');
    });
  });

  // ── MAKE_CALL specifics ──
  describe('MAKE_CALL', () => {
    it('all verb forms recognized', async () => {
      const verbs = ['תתקשר', 'תחייג', 'חייג', 'להתקשר', 'לחייג'];
      for (const verb of verbs) {
        const result = await parse(`${verb} לדני`);
        expect(result.intent).toBe('MAKE_CALL');
        expect(result.contact).toBe('דני');
      }
    });

    it('strips trailing punctuation from contact', async () => {
      const result = await parse('תתקשר לדני!');
      expect(result.contact).toBe('דני');
    });
  });

  // ── READ_SMS / smsCount ──
  describe('READ_SMS count', () => {
    it('singular "הודעה האחרונה" → count=1', async () => {
      const result = await parse('תקרא את ההודעה האחרונה');
      expect(result.count).toBe(1);
    });

    it('plural "הודעות" → count=5 (default)', async () => {
      const result = await parse('תקרא לי את ההודעות');
      expect(result.count).toBe(5);
    });

    it('digit count "3 הודעות" → count=3', async () => {
      const result = await parse('הראה לי 3 הודעות');
      expect(result.count).toBe(3);
    });

    it('Hebrew number "שלוש הודעות" → count=3', async () => {
      const result = await parse('תקרא שלוש הודעות');
      expect(result.count).toBe(3);
    });

    it('caps at 5 when digit count exceeds', async () => {
      const result = await parse('הראה לי 20 הודעות');
      expect(result.count).toBe(5);
    });
  });

  // ── UNKNOWN ──
  describe('UNKNOWN', () => {
    it('returns UNKNOWN for unrecognized input', async () => {
      const result = await parse('מה מזג האוויר');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.source).toBe('regex');
    });

    it('returns UNKNOWN for empty string', async () => {
      const result = await parse('');
      expect(result.intent).toBe('UNKNOWN');
    });
  });

  // ── Orchestrator logic ──
  describe('orchestrator: regex vs gemini', () => {
    it('regex success skips Gemini', async () => {
      const result = await parseIntent('תתקשר לאבא', 'fake-key');
      expect(result.intent).toBe('MAKE_CALL');
      expect(result.source).toBe('regex');
    });

    it('no API key returns regex UNKNOWN', async () => {
      const result = await parseIntent('blah blah', '');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.source).toBe('regex');
    });
  });
});
