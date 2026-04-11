export interface STTProvider {
  start(locale: string): Promise<void>;
  stop(): Promise<void>;
  destroy(): void;
  onResult(callback: (text: string) => void): void;
  onPartialResult(callback: (text: string) => void): void;
  onError(callback: (error: Error) => void): void;
  onStart(callback: () => void): void;
  onEnd(callback: () => void): void;
  isAvailable(): Promise<boolean>;
}
