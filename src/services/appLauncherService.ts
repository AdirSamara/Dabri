import { registerHandler } from './actionDispatcher';
import type { ActionResult } from './actionDispatcher';
import type { ParsedIntent, Contact } from '../types';
import { normalizeHebrew } from '../utils/hebrewUtils';
import { resolveAppName, getCategoryKey, AppMatchTier } from './appNameResolver';
import AppLauncherBridge from '../native/AppLauncherBridge';

async function handleOpenApp(intent: ParsedIntent): Promise<ActionResult> {
  if (!AppLauncherBridge) {
    return { success: false, message: 'מודול פתיחת אפליקציות אינו זמין' };
  }

  const appName = intent.appName;
  if (!appName) {
    return { success: false, message: 'לא הבנתי איזו אפליקציה לפתוח' };
  }

  const result = await resolveAppName(appName);

  // No match at all
  if (result.matches.length === 0) {
    return { success: false, message: `לא מצאתי אפליקציה בשם ${appName}` };
  }

  const best = result.matches[0];

  // Handle generic categories (camera, settings, browser, etc.)
  const categoryKey = getCategoryKey(best.packageName);
  if (categoryKey) {
    try {
      await AppLauncherBridge.launchByCategory(categoryKey);
      return { success: true, message: `פותח ${appName}` };
    } catch {
      return { success: false, message: `לא הצלחתי לפתוח ${appName}` };
    }
  }

  // Single match — launch directly
  if (result.matches.length === 1) {
    try {
      await AppLauncherBridge.launchApp(best.packageName);
      return { success: true, message: `פותח ${best.label}` };
    } catch {
      return { success: false, message: `${appName} לא מותקנת במכשיר` };
    }
  }

  // Multiple matches — disambiguation
  const candidates: Contact[] = result.matches.map((app) => ({
    recordID: app.packageName,
    displayName: app.label,
    phoneNumber: app.packageName,
  }));

  return {
    success: false,
    message: candidates.map((c) => c.displayName).join(', '),
    disambiguation: {
      candidates,
      intent,
      correctedMessage: '',
    },
  };
}

export function registerAppLauncherHandlers(): void {
  registerHandler('OPEN_APP', handleOpenApp);
}
