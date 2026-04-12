import { renderHook, act } from '@testing-library/react-native';
import { useVoiceRecognition } from '../../src/hooks/useVoiceRecognition';

const mockStart = jest.fn().mockResolvedValue(undefined);
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockDestroy = jest.fn();

jest.mock('../../src/services/stt/androidSTT', () => {
  return {
    AndroidSTT: jest.fn().mockImplementation(() => ({
      start: mockStart,
      stop: mockStop,
      destroy: mockDestroy,
      onStart: jest.fn(),
      onPartialResult: jest.fn(),
      onResult: jest.fn(),
      onError: jest.fn(),
      onEnd: jest.fn(),
    })),
  };
});

jest.mock('../../src/store', () => ({
  useDabriStore: Object.assign(
    jest.fn(() => ({
      setVoiceStatus: jest.fn(),
      setLastTranscript: jest.fn(),
      silenceTimeout: 1000,
    })),
    {
      getState: jest.fn(() => ({ silenceTimeout: 1000, voiceStatus: 'idle' })),
      setState: jest.fn(),
    },
  ),
}));

describe('useVoiceRecognition', () => {
  const mockOnResult = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns startListening and stopListening functions', () => {
    const { result } = renderHook(() =>
      useVoiceRecognition({ onResult: mockOnResult }),
    );
    expect(typeof result.current.startListening).toBe('function');
    expect(typeof result.current.stopListening).toBe('function');
  });

  it('startListening calls stt.start with he-IL', async () => {
    const { result } = renderHook(() =>
      useVoiceRecognition({ onResult: mockOnResult }),
    );

    await act(async () => {
      await result.current.startListening();
    });

    expect(mockStart).toHaveBeenCalledWith('he-IL');
  });

  it('stopListening calls stt.stop', async () => {
    const { result } = renderHook(() =>
      useVoiceRecognition({ onResult: mockOnResult }),
    );

    await act(async () => {
      await result.current.stopListening();
    });

    expect(mockStop).toHaveBeenCalled();
  });
});
