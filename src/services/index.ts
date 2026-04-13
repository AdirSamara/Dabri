import { registerSmsHandlers } from './smsService';
import { registerCallHandlers } from './callService';
import { registerNotificationHandlers, setupNotificationListener } from './notificationService';
import { registerWhatsAppHandlers } from './whatsappService';
import { registerAppLauncherHandlers } from './appLauncherService';
import { registerNavigationHandlers } from './navigationService';
import { loadInstalledApps } from './appNameResolver';
import { registerReminderHandlers, initReminderChannel } from './reminderService';
import { setupBackgroundServiceListener } from './backgroundServiceListener';

export function initializeServices(): void {
  registerSmsHandlers();
  registerCallHandlers();
  registerNotificationHandlers();
  registerWhatsAppHandlers();
  registerAppLauncherHandlers();
  registerNavigationHandlers();
  registerReminderHandlers();
  setupNotificationListener();

  // Initialize reminder notification channel
  initReminderChannel();

  // Pre-warm installed apps cache (fire and forget)
  loadInstalledApps();

  // Listen for background service state changes
  setupBackgroundServiceListener();

}
