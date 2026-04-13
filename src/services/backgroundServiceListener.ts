import { NativeModules, NativeEventEmitter } from 'react-native';
import { useDabriStore } from '../store';
import { BackgroundServiceState } from '../types';
import { parseIntent } from './intentParser';
import { dispatchAction } from './actionDispatcher';
import BackgroundServiceBridge from '../native/BackgroundServiceBridge';
import { generateId } from '../utils/hebrewUtils';

export function setupBackgroundServiceListener(): void {
  if (!NativeModules.BackgroundServiceModule) {
    return;
  }

  const emitter = new NativeEventEmitter(NativeModules.BackgroundServiceModule);

  emitter.addListener(
    'backgroundServiceStateChanged',
    (event: { state: string }) => {
      const state = event.state as BackgroundServiceState;
      useDabriStore.getState().setBackgroundServiceState(state);

      if (state === 'stopped') {
        useDabriStore.getState().setBackgroundServiceEnabled(false);
      } else if (state === 'running') {
        useDabriStore.getState().setBackgroundServiceEnabled(true);
      }
    },
  );

  emitter.addListener(
    'backgroundServiceTranscript',
    async (event: { text: string; isFinal: boolean }) => {
      // Update transcript in store (so HomeScreen shows it when opened)
      useDabriStore.getState().setLastTranscript(event.text);

      if (!event.isFinal || !event.text) return;

      // Run the same voice pipeline as HomeScreen
      try {
        const geminiApiKey = useDabriStore.getState().geminiApiKey;
        const parsedIntent = await parseIntent(event.text, geminiApiKey);

        if (parsedIntent.intent === 'UNKNOWN') {
          await BackgroundServiceBridge?.notifyCommandResult(
            false,
            'לא הבנתי, אפשר לנסות שוב?',
          );
          logConversation(event.text, parsedIntent, 'לא הבנתי, אפשר לנסות שוב?', false);
          return;
        }

        const actionResult = await dispatchAction(parsedIntent);

        await BackgroundServiceBridge?.notifyCommandResult(
          actionResult.success,
          actionResult.message,
        );

        logConversation(
          event.text,
          parsedIntent,
          actionResult.message,
          actionResult.success,
        );
      } catch (e) {
        console.log('[BackgroundServiceListener] Pipeline error:', e);
        await BackgroundServiceBridge?.notifyCommandResult(
          false,
          'שגיאה בעיבוד הפקודה',
        );
      }
    },
  );
}

function logConversation(
  userText: string,
  parsedIntent: any,
  result: string,
  success: boolean,
): void {
  const id = generateId();
  useDabriStore.getState().addConversation({
    id,
    userText,
    parsedIntent,
    result,
    status: success ? 'success' : 'error',
    timestamp: Date.now(),
  });
}
