import { PermissionsAndroid, Platform, NativeModules } from 'react-native';
import { registerHandler } from './actionDispatcher';
import { resolveContact } from './contactResolver';
import { ParsedIntent } from '../types';
import type { ActionResult } from './actionDispatcher';

async function requestCallPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CALL_PHONE,
    {
      title: 'הרשאה לביצוע שיחות',
      message: 'דברי צריכה הרשאה לביצוע שיחות טלפון.',
      buttonPositive: 'אישור',
      buttonNegative: 'ביטול',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function handleMakeCall(intent: ParsedIntent): Promise<ActionResult> {
  if (!intent.contact) {
    return { success: false, message: 'לא צוין איש קשר לחיוג' };
  }

  const contact = await resolveContact(intent.contact);
  if (!contact) {
    return { success: false, message: `לא מצאתי איש קשר בשם ${intent.contact}` };
  }

  const granted = await requestCallPermission();
  if (!granted) {
    return { success: false, message: 'אין הרשאה לביצוע שיחות' };
  }

  const PhoneModule = NativeModules.PhoneModule;
  if (!PhoneModule) {
    return { success: false, message: 'מודול הטלפון אינו זמין' };
  }

  await PhoneModule.directCall(contact.phoneNumber);
  return { success: true, message: `מתקשר ל${contact.displayName}` };
}

export function registerCallHandlers(): void {
  registerHandler('MAKE_CALL', handleMakeCall);
}
