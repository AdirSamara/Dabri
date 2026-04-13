import { registerSmsHandlers } from './smsService';
import { registerCallHandlers } from './callService';
import { registerNotificationHandlers, setupNotificationListener } from './notificationService';
import { registerWhatsAppHandlers } from './whatsappService';
import { registerAppLauncherHandlers } from './appLauncherService';
import { registerNavigationHandlers } from './navigationService';
import { loadInstalledApps } from './appNameResolver';
import { registerReminderHandlers, initReminderChannel } from './reminderService';
import { setupServiceSettingsSync } from './backgroundServiceSync';

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

  // Sync settings to native background service SharedPreferences
  setupServiceSettingsSync();
}
