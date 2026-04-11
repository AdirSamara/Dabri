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

  // 1. SEND_SMS
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

  // 2. SEND_WHATSAPP
  const sendWaMatch = text.match(/שלח\s+(?:וואטסאפ|ווטסאפ|whatsapp)\s+ל(.+?)\s+(.+)/i);
  if (sendWaMatch) {
    return {
      intent: 'SEND_WHATSAPP',
      contact: sendWaMatch[1].trim(),
      message: sendWaMatch[2].trim(),
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

  // 8. SET_REMINDER
  const reminderMatch = text.match(/תזכיר\s+לי\s+(.+?)\s+(ל.+|ש.+)/);
  if (reminderMatch) {
    return {
      intent: 'SET_REMINDER',
      contact: null,
      message: null,
      appName: null,
      reminderText: reminderMatch[1].trim(),
      reminderTime: reminderMatch[2].trim(),
      count: null,
      source: 'regex',
    };
  }

  return UNKNOWN_INTENT;
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
