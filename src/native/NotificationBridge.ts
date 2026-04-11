import { NativeModules } from 'react-native';
import { NotificationItem } from '../types';

interface NotificationBridgeInterface {
  getRecentNotifications(packageFilter: string | null): Promise<NotificationItem[]>;
  isListenerEnabled(): Promise<boolean>;
  openNotificationListenerSettings(): Promise<void>;
}

const NotificationBridge: NotificationBridgeInterface | null =
  NativeModules.NotificationBridge ?? null;

export default NotificationBridge;
