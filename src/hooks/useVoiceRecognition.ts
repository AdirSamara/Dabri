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

export function useVoiceRecognition({
  onResult,
}: UseVoiceRecognitionProps): UseVoiceRecognitionReturn {
  const sttRef = useRef<AndroidSTT | null>(null);
  const { setVoiceStatus, setLastTranscript } = useDabriStore();

  useEffect(() => {
    const stt = new AndroidSTT();
    sttRef.current = stt;

    stt.onStart(() => {
      setVoiceStatus('listening');
    });

    stt.onPartialResult((text) => {
      setLastTranscript(text);
    });

    stt.onResult((text) => {
      setLastTranscript(text);
      setVoiceStatus('processing');
      onResult(text);
    });

    stt.onError(() => {
      setVoiceStatus('idle');
    });

    stt.onEnd(() => {
      // Only reset to idle if still listening (not yet processing)
      useDabriStore.setState((state) => {
        if (state.voiceStatus === 'listening') {
          return { voiceStatus: 'idle' };
        }
        return state;
      });
    });

    return () => {
      stt.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(async () => {
    setLastTranscript('');
    try {
      await sttRef.current?.start(LOCALE_HEBREW);
    } catch (e) {
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
      onResult('\u200B' + hebrewMessage); // zero-width space prefix flags it as an error
    }
  }, [setLastTranscript, setVoiceStatus, onResult]);

  const stopListening = useCallback(async () => {
    await sttRef.current?.stop();
  }, []);

  return { startListening, stopListening };
}
