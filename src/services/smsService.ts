import { PermissionsAndroid, Platform } from 'react-native';
import SmsBridge from '../native/SmsBridge';
import { registerHandler } from './actionDispatcher';
import { resolveContact } from './contactResolver';
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

async function handleReadSms(_intent: ParsedIntent): Promise<ActionResult> {
  if (!SmsBridge) {
    return { success: false, message: 'מודול ה-SMS אינו זמין במכשיר זה' };
  }

  const granted = await requestReadSmsPermission();
  if (!granted) {
    return { success: false, message: 'אין הרשאה לקרוא הודעות' };
  }

  try {
    const messages = await SmsBridge.readInbox(5);

    if (messages.length === 0) {
      return { success: true, message: 'אין הודעות חדשות' };
    }

    const MAX_BODY_CHARS = 120;
    const MAX_TOTAL_CHARS = 400;

    let total = 0;
    const parts: string[] = [];
    for (const m of messages) {
      const body = m.body.length > MAX_BODY_CHARS
        ? m.body.slice(0, MAX_BODY_CHARS) + '...'
        : m.body;
      const part = `מ-${m.address}: ${body}`;
      if (total + part.length > MAX_TOTAL_CHARS) {
        break;
      }
      parts.push(part);
      total += part.length;
    }

    const summary = parts.join('. ');
    return {
      success: true,
      message: `יש ${messages.length} הודעות. ${summary}`,
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

  const contact = await resolveContact(intent.contact);
  if (!contact) {
    return { success: false, message: `לא מצאתי איש קשר בשם ${intent.contact}` };
  }

  const granted = await requestSendSmsPermission();
  if (!granted) {
    return { success: false, message: 'אין הרשאה לשלוח הודעות' };
  }

  try {
    await SmsBridge.sendSms(contact.phoneNumber, intent.message);
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
