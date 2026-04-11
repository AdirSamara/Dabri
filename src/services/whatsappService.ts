import { registerHandler } from './actionDispatcher';
import type { ActionResult } from './actionDispatcher';

async function handleReadWhatsApp(): Promise<ActionResult> {
  return {
    success: false,
    message: 'קריאת וואטסאפ עדיין לא זמינה - תהיה זמינה בגרסה הבאה',
  };
}

async function handleSendWhatsApp(): Promise<ActionResult> {
  return {
    success: false,
    message: 'שליחת וואטסאפ עדיין לא זמינה - תהיה זמינה בגרסה הבאה',
  };
}

export function registerWhatsAppHandlers(): void {
  registerHandler('READ_WHATSAPP', handleReadWhatsApp);
  registerHandler('SEND_WHATSAPP', handleSendWhatsApp);
}
