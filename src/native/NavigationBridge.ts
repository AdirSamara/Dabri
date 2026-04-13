import { NativeModules } from 'react-native';

interface NavigationBridgeInterface {
  isAppInstalled(packageName: string): Promise<boolean>;
  navigateWithWaze(destination: string): Promise<string>;
  navigateWithWazeFavorite(favorite: string): Promise<string>;
  navigateWithGoogleMaps(destination: string): Promise<string>;
  navigateWithGeo(destination: string): Promise<string>;
}

const NavigationBridge: NavigationBridgeInterface | null =
  NativeModules.NavigationBridge ?? null;

export default NavigationBridge;
