import { NativeModules, NativeEventEmitter } from 'react-native';
import { useDabriStore } from '../store';
import { BackgroundServiceState } from '../types';
import { parseIntent } from './intentParser';
import { dispatchAction } from './actionDispatcher';
import BackgroundServiceBridge from '../native/BackgroundServiceBridge';
import { generateId } from '../utils/hebrewUtils';

// Timeout for command processing — if Gemini or action takes longer,
// discard the result to prevent stale commands from executing later.
const COMMAND_TIMEOUT_MS = 12000;

// Track the latest command to discard stale ones
let commandSequence = 0;

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
      useDabriStore.getState().setLastTranscript(event.text);

      if (!event.isFinal || !event.text) return;

      // Each command gets a sequence number — if a newer command arrives
      // before this one finishes, this one is discarded.
      const mySequence = ++commandSequence;

      const isStale = () => mySequence !== commandSequence;

      try {
        const geminiApiKey = useDabriStore.getState().geminiApiKey;

        // Race between parseIntent and a timeout
        const parsedIntent = await withTimeout(
          parseIntent(event.text, geminiApiKey),
          COMMAND_TIMEOUT_MS,
        );

        if (isStale()) return; // A newer command superseded this one

        if (parsedIntent.intent === 'UNKNOWN') {
          await BackgroundServiceBridge?.notifyCommandResult(
            false,
            'לא הבנתי, אפשר לנסות שוב?',
          );
          logConversation(event.text, parsedIntent, 'לא הבנתי, אפשר לנסות שוב?', false);
          return;
        }

        if (isStale()) return;

        const actionResult = await withTimeout(
          dispatchAction(parsedIntent),
          COMMAND_TIMEOUT_MS,
        );

        if (isStale()) return;

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
      } catch (e: any) {
        if (isStale()) return;

        const message = e?.message === 'TIMEOUT'
          ? 'הפקודה לקחה יותר מדי זמן'
          : 'שגיאה בעיבוד הפקודה';

        console.log('[BackgroundServiceListener] Pipeline error:', e);
        try {
          await BackgroundServiceBridge?.notifyCommandResult(false, message);
        } catch (_) {
          // Service may have stopped — safe to ignore
        }
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
