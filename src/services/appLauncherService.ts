import { registerHandler } from './actionDispatcher';
import type { ActionResult } from './actionDispatcher';

async function handleOpenApp(): Promise<ActionResult> {
  return {
    success: false,
    message: 'פתיחת אפליקציות עדיין לא זמינה - תהיה זמינה בגרסה הבאה',
  };
}

export function registerAppLauncherHandlers(): void {
  registerHandler('OPEN_APP', handleOpenApp);
}
