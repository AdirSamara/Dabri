import { registerHandler } from './actionDispatcher';
import type { ActionResult } from './actionDispatcher';
import type { ParsedIntent, Reminder } from '../types';
import { useDabriStore } from '../store';
import { generateId } from '../utils/hebrewUtils';
import { parseHebrewTime } from './hebrewTimeParser';
import ReminderBridge from '../native/ReminderBridge';

async function ensurePermissions(): Promise<ActionResult | null> {
  if (!ReminderBridge) {
    return {
      success: false,
      message: 'מודול התזכורות לא זמין במכשיר זה',
    };
  }

  // Create notification channel (idempotent)
  await ReminderBridge.createNotificationChannel();

  // Check permissions
  const perms = await ReminderBridge.checkPermissions();

  // Request notification permission if needed (API 33+)
  if (!perms.canPostNotifications) {
    await ReminderBridge.requestNotificationPermission();
    // Re-check after request
    const updated = await ReminderBridge.checkPermissions();
    if (!updated.canPostNotifications) {
      return {
        success: false,
        message: 'אין הרשאה להצגת התראות. אנא אשר את ההרשאה בהגדרות.',
      };
    }
  }

  // Request exact alarm permission if needed (API 31+)
  if (!perms.canScheduleExact) {
    await ReminderBridge.requestExactAlarmPermission();
    // Note: this opens Settings, user has to toggle manually.
    // We proceed anyway — the native module falls back to inexact alarms.
  }

  return null; // All good
}

async function handleSetReminder(intent: ParsedIntent): Promise<ActionResult> {
  // Handle list-reminders sub-intent
  if (intent.reminderText === '__LIST__' || (!intent.reminderText && !intent.reminderTime)) {
    return handleListReminders();
  }

  const { reminderText, reminderTime } = intent;

  if (!reminderText) {
    return { success: false, message: 'לא הבנתי מה להזכיר לך' };
  }

  if (!reminderTime) {
    return { success: false, message: 'לא הבנתי מתי להזכיר לך. אפשר לנסות "בעוד X דקות" או "מחר בשעה..."' };
  }

  // Parse Hebrew time expression → Date
  const triggerDate = parseHebrewTime(reminderTime);
  if (!triggerDate) {
    return {
      success: false,
      message: `לא הצלחתי להבין את הזמן "${reminderTime}". אפשר לנסות "בעוד X דקות" או "מחר בשעה..."`,
    };
  }

  // Validate not in the past
  if (triggerDate.getTime() <= Date.now()) {
    return {
      success: false,
      message: 'הזמן שצוין כבר עבר. אנא ציין זמן עתידי.',
    };
  }

  // Check/request permissions
  const permError = await ensurePermissions();
  if (permError) return permError;

  // Generate unique ID
  const id = generateId();
  const triggerTime = triggerDate.getTime();

  // Schedule via native module
  try {
    await ReminderBridge!.scheduleReminder(id, reminderText, triggerTime);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'שגיאה לא ידועה';
    return { success: false, message: `שגיאה בתזמון התזכורת: ${msg}` };
  }

  // Store in Zustand
  const reminder: Reminder = {
    id,
    text: reminderText,
    triggerTime,
    createdAt: Date.now(),
    notificationId: id,
    completed: false,
    snoozedUntil: null,
  };
  useDabriStore.getState().addReminder(reminder);

  // Generate Hebrew confirmation
  const timeDescription = formatHebrewTimeDescription(triggerDate);
  return {
    success: true,
    message: `בסדר, אזכיר לך ${reminderText} ${timeDescription}`,
  };
}

function handleListReminders(): ActionResult {
  const { reminders } = useDabriStore.getState();
  const now = Date.now();
  const active = reminders.filter((r) => !r.completed && r.triggerTime > now);

  if (active.length === 0) {
    return { success: true, message: 'אין לך תזכורות פעילות' };
  }

  // Sort by trigger time
  active.sort((a, b) => a.triggerTime - b.triggerTime);

  // Limit to 5 for TTS
  const toRead = active.slice(0, 5);
  const descriptions = toRead.map((r) => {
    const timeDesc = formatHebrewTimeDescription(new Date(r.triggerTime));
    return `${r.text} ${timeDesc}`;
  });

  const prefix =
    active.length === 1
      ? 'יש לך תזכורת אחת'
      : `יש לך ${active.length} תזכורות פעילות`;

  return {
    success: true,
    message: `${prefix}: ${descriptions.join('. ')}`,
  };
}

function formatHebrewTimeDescription(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return 'עכשיו';

  if (diffMin < 60) {
    return diffMin === 1 ? 'בעוד דקה' : `בעוד ${diffMin} דקות`;
  }

  const diffHours = Math.floor(diffMin / 60);
  const remainingMin = diffMin % 60;

  if (diffHours < 24) {
    if (remainingMin === 0) {
      if (diffHours === 1) return 'בעוד שעה';
      if (diffHours === 2) return 'בעוד שעתיים';
      return `בעוד ${diffHours} שעות`;
    }
    return `בעוד ${diffHours} שעות ו-${remainingMin} דקות`;
  }

  // Format as absolute time for further-out reminders
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return `היום בשעה ${hours}:${minutes}`;
  if (isTomorrow) return `מחר בשעה ${hours}:${minutes}`;

  return `ב-${date.toLocaleDateString('he-IL')} בשעה ${hours}:${minutes}`;
}

/**
 * Initialize the notification channel at app startup.
 */
export async function initReminderChannel(): Promise<void> {
  try {
    await ReminderBridge?.createNotificationChannel();
  } catch (e) {
    console.log('[Reminder] Failed to create notification channel:', e);
  }
}

export function registerReminderHandlers(): void {
  registerHandler('SET_REMINDER', handleSetReminder);
}
