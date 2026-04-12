import { Linking } from 'react-native';
import { registerHandler } from './actionDispatcher';
import { resolveContactWithAlignment } from './contactResolver';
import { ParsedIntent } from '../types';
import type { ActionResult } from './actionDispatcher';

function formatPhoneForWhatsApp(raw: string): string {
  // Strip spaces, dashes, parentheses, plus sign
  let digits = raw.replace(/[\s\-().+]/g, '');
  // Israeli local format: 0XXXXXXXXX → 972XXXXXXXXX
  if (digits.startsWith('0')) {
    digits = '972' + digits.slice(1);
  }
  return digits;
}

async function handleSendWhatsApp(intent: ParsedIntent): Promise<ActionResult> {
  if (!intent.contact) {
    return { success: false, message: 'לא צוין איש קשר לשליחה' };
  }
  if (!intent.message) {
    return { success: false, message: 'לא צוין תוכן ההודעה' };
  }

  const { contact, correctedMessage } = await resolveContactWithAlignment(
    intent.contact,
    intent.message,
  );
  if (!contact) {
    return { success: false, message: `לא מצאתי איש קשר בשם ${intent.contact}` };
  }

  const finalMessage = correctedMessage || intent.message;
  if (!finalMessage.trim()) {
    return { success: false, message: 'לא צוין תוכן ההודעה' };
  }

  const phone = formatPhoneForWhatsApp(contact.phoneNumber);
  const encodedMessage = encodeURIComponent(finalMessage);
  const url = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;

  try {
    // Try to open WhatsApp directly. canOpenURL is unreliable on older Android versions,
    // so we attempt to open and catch the error if it fails
    console.log('[whatsappService] Opening WhatsApp URL:', url.replace(/text=.+/, 'text=***'));
    await Linking.openURL(url);
    return {
      success: true,
      message: `הודעה מוכנה לשליחה ל${contact.displayName} - לחץ שלח בוואטסאפ`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
    console.log('[whatsappService] Error opening WhatsApp:', msg);
    // If it fails, it means WhatsApp is not installed
    if (msg.includes('No Activity found') || msg.includes('ActivityNotFoundException')) {
      return { success: false, message: 'וואטסאפ אינו מותקן במכשיר זה' };
    }
    return { success: false, message: `שגיאה בפתיחת וואטסאפ: ${msg}` };
  }
}

async function handleReadWhatsApp(): Promise<ActionResult> {
  return {
    success: false,
    message: 'קריאת וואטסאפ עדיין לא זמינה - תהיה זמינה בגרסה הבאה',
  };
}

export function registerWhatsAppHandlers(): void {
  registerHandler('SEND_WHATSAPP', handleSendWhatsApp);
  registerHandler('READ_WHATSAPP', handleReadWhatsApp);
}
