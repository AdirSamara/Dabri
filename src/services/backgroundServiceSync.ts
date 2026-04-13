import { useDabriStore } from '../store';
import DabriServiceBridge from '../native/DabriServiceBridge';

function getServiceSettings(): Record<string, any> {
  const state = useDabriStore.getState();
  return {
    geminiApiKey: state.geminiApiKey,
    ttsSpeed: state.ttsSpeed,
    preferredNavApp: state.preferredNavApp,
    homeAddress: state.homeAddress,
    workAddress: state.workAddress,
    silenceTimeout: state.silenceTimeout,
    wakeWordSensitivity: state.wakeWordSensitivity,
    isDarkMode: state.isDarkMode,
    autoStartOnBoot: state.autoStartOnBoot,
    showOnLockScreen: state.showOnLockScreen,
    contactAliases: JSON.stringify(state.contactAliases),
  };
}

export function setupServiceSettingsSync(): () => void {
  const bridge = DabriServiceBridge;
  if (!bridge) return () => {};

  // Wait for store rehydration before initial sync
  const doInitialSync = () => {
    try {
      bridge.syncSettings(getServiceSettings());
    } catch (e) {
      console.log('[ServiceSync] Initial sync failed:', e);
    }
  };

  // Check if already hydrated
  if (useDabriStore.persist.hasHydrated()) {
    doInitialSync();
  } else {
    useDabriStore.persist.onFinishHydration(doInitialSync);
  }

  // Subscribe to store changes
  const relevantKeys = [
    'geminiApiKey', 'ttsSpeed', 'preferredNavApp',
    'homeAddress', 'workAddress', 'silenceTimeout',
    'wakeWordSensitivity', 'isDarkMode', 'autoStartOnBoot',
    'showOnLockScreen', 'contactAliases',
  ] as const;

  const unsubscribe = useDabriStore.subscribe(
    (state, prevState) => {
      const changed = relevantKeys.some(
        (key) => (state as any)[key] !== (prevState as any)[key]
      );

      if (changed) {
        try {
          bridge.syncSettings(getServiceSettings());
        } catch (e) {
          console.log('[ServiceSync] Sync failed:', e);
        }
      }
    }
  );

  return unsubscribe;
}
