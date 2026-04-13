import { NativeModules } from 'react-native';
import { BackgroundServiceState } from '../types';

export interface PermissionStatus {
  overlayGranted: boolean;
  notificationsGranted: boolean;
  microphoneGranted: boolean;
}

interface BackgroundServiceModuleInterface {
  startService(): Promise<boolean>;
  stopService(): Promise<boolean>;
  pauseService(): Promise<boolean>;
  resumeService(): Promise<boolean>;
  isServiceRunning(): Promise<boolean>;
  getServiceState(): Promise<BackgroundServiceState>;
  checkOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  checkAllPermissions(): Promise<PermissionStatus>;
  notifyCommandResult(success: boolean, message: string): Promise<boolean>;
  setWakeWordConfig(enabled: boolean, phrase: string): Promise<boolean>;
  getWakeWordConfig(): Promise<{ enabled: boolean; phrase: string }>;
  pauseWakeWord(): Promise<boolean>;
  resumeWakeWord(): Promise<boolean>;
}

const BackgroundServiceBridge: BackgroundServiceModuleInterface | null =
  NativeModules.BackgroundServiceModule ?? null;

export default BackgroundServiceBridge;
