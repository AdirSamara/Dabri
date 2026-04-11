import { NativeModules, NativeEventEmitter } from 'react-native';
import { registerHandler } from './actionDispatcher';
import { useDabriStore } from '../store';
import { NotificationItem, ParsedIntent } from '../types';
import NotificationBridge from '../native/NotificationBridge';
import type { ActionResult } from './actionDispatcher';

function isNativeModuleAvailable(): boolean {
  return !!NativeModules.NotificationBridge;
}

export function setupNotificationListener(): void {
  if (!isNativeModuleAvailable()) {
    return;
  }

  const emitter = new NativeEventEmitter(NativeModules.NotificationBridge);
  emitter.addListener('onNotification', (notification: NotificationItem) => {
    useDabriStore.getState().addNotification(notification);
  });
}

async function handleReadNotifications(_intent: ParsedIntent): Promise<ActionResult> {
  if (!isNativeModuleAvailable() || !NotificationBridge) {
    return {
      success: false,
      message: 'מודול ההתראות אינו זמין. יש להתקין את הגרסה המלאה.',
    };
  }

  const enabled = await NotificationBridge.isListenerEnabled();
  if (!enabled) {
    await NotificationBridge.openNotificationListenerSettings();
    return {
      success: false,
      message: 'אנא הפעל את הרשאת ההתראות עבור דברי בהגדרות',
    };
  }

  const notifications = await NotificationBridge.getRecentNotifications(null);
  if (!notifications || notifications.length === 0) {
    return { success: true, message: 'אין התראות אחרונות' };
  }

  const top5 = notifications.slice(0, 5);
  const summary = top5.map((n) => `${n.title}: ${n.text}`).join('. ');
  return {
    success: true,
    message: `יש ${notifications.length} התראות. ${summary}`,
  };
}

export function registerNotificationHandlers(): void {
  registerHandler('READ_NOTIFICATIONS', handleReadNotifications);
}
