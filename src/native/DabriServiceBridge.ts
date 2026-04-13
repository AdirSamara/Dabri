import { NativeModules } from 'react-native';

export interface ServicePermissionStatus {
  microphone: boolean;
  overlay: boolean;
  notifications: boolean;
}

interface DabriServiceBridgeInterface {
  startService(): Promise<boolean>;
  stopService(): Promise<boolean>;
  isServiceRunning(): Promise<boolean>;
  checkServicePermissions(): Promise<ServicePermissionStatus>;
  requestOverlayPermission(): Promise<boolean>;
  requestNotificationPermission(): Promise<boolean>;
  syncSettings(settings: Record<string, any>): Promise<boolean>;
}

const DabriServiceBridge: DabriServiceBridgeInterface | null =
  NativeModules.DabriServiceModule ?? null;

export default DabriServiceBridge;
