import { useRef, useEffect, useCallback } from 'react';
import { AndroidSTT } from '../services/stt/androidSTT';
import { useDabriStore } from '../store';
import { LOCALE_HEBREW } from '../utils/constants';

interface UseVoiceRecognitionProps {
  onResult: (text: string) => void;
}

interface UseVoiceRecognitionReturn {
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
}

// Maximum time the mic stays open (hard cap)
const MAX_LISTENING_MS = 8000;
// After the last partial result, wait this long before auto-stopping
const SILENCE_AFTER_SPEECH_MS = 2000;

export function useVoiceRecognition({
  onResult,
}: UseVoiceRecognitionProps): UseVoiceRecognitionReturn {
  const sttRef = useRef<AndroidSTT | null>(null);
  // Keep a ref to always call the latest onResult, even if it changes after mount
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReceivedSpeech = useRef(false);

  const { setVoiceStatus, setLastTranscript } = useDabriStore();

  const clearTimers = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const autoStop = useCallback(async () => {
    clearTimers();
    // Voice.stop() tells the recognizer to finalize — it will emit
    // onSpeechResults with whatever was captured so far
    await sttRef.current?.stop();
  }, [clearTimers]);

  useEffect(() => {
    const stt = new AndroidSTT();
    sttRef.current = stt;

    stt.onStart(() => {
      setVoiceStatus('listening');
      hasReceivedSpeech.current = false;
    });

    stt.onPartialResult((text) => {
      setLastTranscript(text);
      hasReceivedSpeech.current = true;

      // Reset silence timer on every partial result
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        autoStop();
      }, SILENCE_AFTER_SPEECH_MS);
    });

    stt.onResult((text) => {
      clearTimers();
      setLastTranscript(text);
      setVoiceStatus('processing');
      onResultRef.current(text);
    });

    stt.onError(() => {
      clearTimers();
      setVoiceStatus('idle');
    });

    stt.onEnd(() => {
      clearTimers();
      // Only reset to idle if still listening (not yet processing)
      useDabriStore.setState((state) => {
        if (state.voiceStatus === 'listening') {
          return { voiceStatus: 'idle' };
        }
        return state;
      });
    });

    return () => {
      clearTimers();
      stt.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(async () => {
    setLastTranscript('');
    clearTimers();
    hasReceivedSpeech.current = false;

    // Hard cap: stop listening after MAX_LISTENING_MS no matter what
    maxTimerRef.current = setTimeout(() => {
      autoStop();
    }, MAX_LISTENING_MS);

    try {
      await sttRef.current?.start(LOCALE_HEBREW);
    } catch (e) {
      clearTimers();
      setVoiceStatus('idle');
      const raw = e instanceof Error ? e.message : '';
      const isLangError =
        raw.toLowerCase().includes('language') ||
        raw.toLowerCase().includes('not supported');
      const isModuleError = raw.includes('מודול');

      let hebrewMessage: string;
      if (isModuleError) {
        hebrewMessage =
          'מודול זיהוי הקול אינו זמין. יש לבנות מחדש את האפליקציה.';
      } else if (isLangError) {
        hebrewMessage =
          'שפת העברית אינה מותקנת לזיהוי קול. ' +
          'אנא הוסף עברית בהגדרות הטלפון תחת שפה וקלט.';
      } else {
        hebrewMessage = 'שגיאה בזיהוי קול. אנא נסה שוב.';
      }

      setLastTranscript(hebrewMessage);
      // Short-circuit directly to the spoken response — skip intent parsing
      onResultRef.current('\u200B' + hebrewMessage); // zero-width space prefix flags it as an error
    }
  }, [setLastTranscript, setVoiceStatus, clearTimers, autoStop]);

  const stopListening = useCallback(async () => {
    clearTimers();
    await sttRef.current?.stop();
  }, [clearTimers]);

  return { startListening, stopListening };
}
