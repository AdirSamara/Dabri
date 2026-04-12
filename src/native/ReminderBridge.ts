import { NativeModules } from 'react-native';

interface ReminderPermissions {
  canScheduleExact: boolean;
  canPostNotifications: boolean;
}

interface ReminderModuleInterface {
  createNotificationChannel(): Promise<boolean>;
  checkPermissions(): Promise<ReminderPermissions>;
  requestExactAlarmPermission(): Promise<boolean>;
  requestNotificationPermission(): Promise<boolean>;
  scheduleReminder(
    id: string,
    text: string,
    triggerTimeMs: number,
  ): Promise<boolean>;
  cancelReminder(id: string): Promise<boolean>;
  snoozeReminder(
    id: string,
    text: string,
    snoozeMinutes: number,
  ): Promise<boolean>;
}

const ReminderBridge: ReminderModuleInterface | null =
  NativeModules.ReminderModule ?? null;

export default ReminderBridge;
