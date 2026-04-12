import { registerSmsHandlers } from './smsService';
import { registerCallHandlers } from './callService';
import { registerNotificationHandlers, setupNotificationListener } from './notificationService';
import { registerWhatsAppHandlers } from './whatsappService';
import { registerAppLauncherHandlers } from './appLauncherService';
import { registerReminderHandlers, initReminderChannel } from './reminderService';

export function initializeServices(): void {
  registerSmsHandlers();
  registerCallHandlers();
  registerNotificationHandlers();
  registerWhatsAppHandlers();
  registerAppLauncherHandlers();
  registerReminderHandlers();
  setupNotificationListener();

  // Initialize reminder notification channel
  initReminderChannel();
}
