import { NativeModules } from 'react-native';

interface AssistantBridgeInterface {
  isDefaultAssistant(): Promise<boolean>;
  wasLaunchedFromAssist(): Promise<boolean>;
}

const AssistantBridge: AssistantBridgeInterface | null =
  NativeModules.AssistantModule
    ? {
        isDefaultAssistant: () =>
          NativeModules.AssistantModule.isDefaultAssistant(),
        wasLaunchedFromAssist: () =>
          NativeModules.AssistantModule.wasLaunchedFromAssist(),
      }
    : null;

export default AssistantBridge;
