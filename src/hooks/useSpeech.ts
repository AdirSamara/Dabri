import { useEffect, useCallback } from 'react';
import { NativeModules } from 'react-native';
import { useDabriStore } from '../store';
import { LOCALE_HEBREW, TTS_PITCH } from '../utils/constants';

// Lazy-import TTS only when native module is confirmed present.
// This prevents react-native-tts from calling NativeModules.TextToSpeech.xxx
// during module initialisation when the native side isn't registered yet.
const isTtsAvailable = !!NativeModules.TextToSpeech;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Tts = isTtsAvailable ? (require('react-native-tts').default as typeof import('react-native-tts').default) : null;

let ttsInitialized = false;

async function initTts(): Promise<void> {
  if (!Tts || ttsInitialized) {
    return;
  }
  ttsInitialized = true;

  try {
    await Tts.setDefaultLanguage(LOCALE_HEBREW);
  } catch {
    await Tts.setDefaultLanguage('en-US').catch(() => {});
  }

  await Tts.setDefaultPitch(TTS_PITCH).catch(() => {});
}

interface UseSpeechReturn {
  speak: (text: string) => void;
  stopSpeaking: () => void;
}

export function useSpeech(): UseSpeechReturn | null {
  const { ttsSpeed, setVoiceStatus } = useDabriStore();

  // One-time setup: language, pitch, and event listeners
  useEffect(() => {
    initTts();

    if (!Tts) {
      return;
    }

    const handleFinish = () => setVoiceStatus('idle');
    const handleCancel = () => setVoiceStatus('idle');

    const subFinish = Tts.addEventListener('tts-finish', handleFinish) as any;
    const subCancel = Tts.addEventListener('tts-cancel', handleCancel) as any;

    return () => {
      subFinish?.remove?.();
      subCancel?.remove?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply rate change immediately whenever the user updates it in settings
  useEffect(() => {
    if (!Tts) {
      return;
    }
    Tts.setDefaultRate(ttsSpeed).catch(() => {});
  }, [ttsSpeed]);

  const speak = useCallback(
    (text: string) => {
      if (!Tts) {
        return;
      }
      try {
        // Set status synchronously so mic button responds immediately
        setVoiceStatus('speaking');
        Tts.stop();
        Tts.speak(text);
      } catch (e) {
        console.log('[useSpeech] speak error:', e);
        setVoiceStatus('idle');
      }
    },
    [setVoiceStatus],
  );

  const stopSpeaking = useCallback(() => {
    if (!Tts) {
      return;
    }
    try {
      Tts.stop();
      setVoiceStatus('idle');
    } catch (e) {
      console.log('[useSpeech] stopSpeaking error:', e);
      setVoiceStatus('idle');
    }
  }, [setVoiceStatus]);

  if (!Tts) {
    return null;
  }

  return { speak, stopSpeaking };
}
