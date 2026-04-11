import { NativeModules } from 'react-native';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import { STTProvider } from './types';

function assertVoiceAvailable(): void {
  if (!NativeModules.Voice) {
    throw new Error(
      'מודול זיהוי הקול אינו זמין. נסה לבנות מחדש את האפליקציה (npx react-native run-android).',
    );
  }
}

export class AndroidSTT implements STTProvider {
  private resultCallback: ((text: string) => void) | null = null;
  private partialResultCallback: ((text: string) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private startCallback: (() => void) | null = null;
  private endCallback: (() => void) | null = null;

  constructor() {
    // Only wire handlers if the native module is present
    if (!NativeModules.Voice) {
      return;
    }
    Voice.onSpeechResults = this.handleResults;
    Voice.onSpeechPartialResults = this.handlePartialResults;
    Voice.onSpeechError = this.handleError;
    Voice.onSpeechStart = this.handleStart;
    Voice.onSpeechEnd = this.handleEnd;
  }

  private handleResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0];
    if (text && this.resultCallback) {
      this.resultCallback(text);
    }
  };

  private handlePartialResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0];
    if (text && this.partialResultCallback) {
      this.partialResultCallback(text);
    }
  };

  private handleError = (e: SpeechErrorEvent) => {
    const message = e.error?.message ?? 'Unknown STT error';
    if (this.errorCallback) {
      this.errorCallback(new Error(message));
    }
  };

  private handleStart = () => {
    if (this.startCallback) {
      this.startCallback();
    }
  };

  private handleEnd = () => {
    if (this.endCallback) {
      this.endCallback();
    }
  };

  onResult(callback: (text: string) => void): void {
    this.resultCallback = callback;
  }

  onPartialResult(callback: (text: string) => void): void {
    this.partialResultCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  onStart(callback: () => void): void {
    this.startCallback = callback;
  }

  onEnd(callback: () => void): void {
    this.endCallback = callback;
  }

  async start(locale: string): Promise<void> {
    assertVoiceAvailable();
    await Voice.start(locale);
  }

  async stop(): Promise<void> {
    if (!NativeModules.Voice) {
      return;
    }
    await Voice.stop();
  }

  destroy(): void {
    if (!NativeModules.Voice) {
      return;
    }
    Voice.destroy().then(() => {
      Voice.removeAllListeners();
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!NativeModules.Voice) {
      return false;
    }
    try {
      const result = await Voice.isAvailable();
      return !!result;
    } catch {
      return false;
    }
  }
}
