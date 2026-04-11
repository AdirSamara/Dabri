import { NativeModules } from 'react-native';

interface AccessibilityBridgeInterface {
  getRecentWhatsAppMessages(): Promise<{ sender: string; text: string; timestamp: number }[]>;
  sendWhatsAppMessage(contact: string, text: string): Promise<void>;
  isServiceEnabled(): Promise<boolean>;
  openAccessibilitySettings(): Promise<void>;
}

const AccessibilityBridge: AccessibilityBridgeInterface | null =
  NativeModules.AccessibilityBridge ?? null;

export default AccessibilityBridge;
