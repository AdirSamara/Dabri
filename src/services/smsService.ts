import { PermissionsAndroid, Platform } from 'react-native';
import SmsBridge from '../native/SmsBridge';
import { registerHandler } from './actionDispatcher';
import { resolveContactWithAlignment } from './contactResolver';
import { ParsedIntent } from '../types';
import type { ActionResult } from './actionDispatcher';

async function requestReadSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestSendSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.SEND_SMS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function handleReadSms(intent: ParsedIntent): Promise<ActionResult> {
  if (!SmsBridge) {
    return { success: false, message: 'מודול ה-SMS אינו זמין במכשיר זה' };
  }

  const granted = await requestReadSmsPermission();
  if (!granted) {
    return { success: false, message: 'אין הרשאה לקרוא הודעות' };
  }

  try {
    const fetchCount = Math.min(intent.count ?? 5, 5);
    const messages = await SmsBridge.readInbox(fetchCount);

    if (messages.length === 0) {
      return { success: true, message: 'אין הודעות חדשות' };
    }

    const smsData = messages.map((m: any) => ({
      address: m.address,
      body: m.body,
      date: m.date ?? Date.now(),
    }));

    // Build TTS: read messages aloud with ordinal labels (no phone numbers)
    const ORDINALS = ['ראשונה', 'שנייה', 'שלישית', 'רביעית', 'חמישית'];
    const MAX_TTS_BODY = 80;

    if (fetchCount === 1) {
      const body = messages[0].body.length > MAX_TTS_BODY
        ? messages[0].body.slice(0, MAX_TTS_BODY) + '...'
        : messages[0].body;
      return {
        success: true,
        message: `ההודעה האחרונה: ${body}`,
        smsMessages: smsData,
      };
    }

    const readings = messages.map((m: any, i: number) => {
      const body = m.body.length > MAX_TTS_BODY
        ? m.body.slice(0, MAX_TTS_BODY) + '...'
        : m.body;
      return `הודעה ${ORDINALS[i] ?? (i + 1)}: ${body}`;
    });

    return {
      success: true,
      message: `יש לך ${messages.length} הודעות. ${readings.join('. ')}`,
      smsMessages: smsData,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
    return { success: false, message: `שגיאה בקריאת הודעות: ${msg}` };
  }
}

async function handleSendSms(intent: ParsedIntent): Promise<ActionResult> {
  if (!SmsBridge) {
    return { success: false, message: 'מודול ה-SMS אינו זמין במכשיר זה' };
  }

  if (!intent.contact) {
    return { success: false, message: 'לא צוין איש קשר לשליחה' };
  }
  if (!intent.message) {
    return { success: false, message: 'לא צוין תוכן ההודעה' };
  }

  const { contact, correctedMessage, allCandidates } = await resolveContactWithAlignment(
    intent.contact,
    intent.message,
  );

  if (allCandidates.length > 1) {
    return {
      success: false,
      message: allCandidates.map(c => c.displayName).join(', '),
      disambiguation: { candidates: allCandidates, intent, correctedMessage },
    };
  }

  if (!contact) {
    return { success: false, message: `לא מצאתי איש קשר בשם ${intent.contact}` };
  }

  const finalMessage = correctedMessage || intent.message;
  if (!finalMessage.trim()) {
    return { success: false, message: 'לא צוין תוכן ההודעה' };
  }

  const granted = await requestSendSmsPermission();
  if (!granted) {
    return { success: false, message: 'אין הרשאה לשלוח הודעות' };
  }

  try {
    await SmsBridge.sendSms(contact.phoneNumber, finalMessage);
    return { success: true, message: `הודעה נשלחה ל${contact.displayName}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
    return { success: false, message: `שגיאה בשליחת הודעה: ${msg}` };
  }
}

export function registerSmsHandlers(): void {
  registerHandler('READ_SMS', handleReadSms);
  registerHandler('SEND_SMS', handleSendSms);
}
