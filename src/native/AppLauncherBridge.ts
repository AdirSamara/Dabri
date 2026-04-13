import { NativeModules } from 'react-native';

interface AppLauncherBridgeInterface {
  getInstalledApps(): Promise<{ packageName: string; label: string }[]>;
  launchApp(packageName: string): Promise<void>;
  launchByCategory(category: string): Promise<void>;
}

const AppLauncherBridge: AppLauncherBridgeInterface | null =
  NativeModules.AppLauncherBridge ?? null;

export default AppLauncherBridge;
