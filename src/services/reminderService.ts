import { registerHandler } from './actionDispatcher';
import type { ActionResult } from './actionDispatcher';

async function handleSetReminder(): Promise<ActionResult> {
  return {
    success: false,
    message: 'הגדרת תזכורות עדיין לא זמינה - תהיה זמינה בגרסה הבאה',
  };
}

export function registerReminderHandlers(): void {
  registerHandler('SET_REMINDER', handleSetReminder);
}
