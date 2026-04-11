import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  NativeModules,
} from 'react-native';
import { useDabriStore } from '../store';

// Access TTS directly
const Tts = NativeModules.TextToSpeech
    ? (require('react-native-tts').default as typeof import('react-native-tts').default)
    : null;

// ✅ Only 3 options (with IDs)
const SPEED_OPTIONS = [
  { id: 'slow', label: 'לאט 🐢', value: 0.5 },
  { id: 'normal', label: 'רגיל 🙂', value: 0.6 },
  { id: 'fast', label: 'מהר ⚡', value: 0.8 },
];

const SAMPLE_TEXT = 'שלום! זוהי בדיקת מהירות הדיבור שלך';

export function VoiceSpeedSettingsScreen(): React.JSX.Element {
  const { ttsSpeed, setTtsSpeed } = useDabriStore();

  // ✅ Fix old persisted values
  useEffect(() => {
    const validValues = SPEED_OPTIONS.map((s) => s.value);

    if (!validValues.includes(ttsSpeed)) {
      setTtsSpeed(0.5); // default = slow
    }
  }, []);

  // ✅ Find current option by value
  const currentOption =
      SPEED_OPTIONS.find((s) => s.value === ttsSpeed) ?? SPEED_OPTIONS[0];

  const handleTry = () => {
    if (!Tts) return;
    try {
      Tts.stop();
      Tts.setDefaultRate(ttsSpeed);
      Tts.speak(SAMPLE_TEXT);
    } catch (e) {
      console.log('[VoiceSpeedSettingsScreen] handleTry error:', e);
    }
  };

  const handleSelect = (option: (typeof SPEED_OPTIONS)[number]) => {
    setTtsSpeed(option.value);

    // 🔥 instant preview
    if (Tts) {
      try {
        Tts.stop();
        Tts.setDefaultRate(option.value);
        Tts.speak(SAMPLE_TEXT);
      } catch (e) {
        console.log('[VoiceSpeedSettingsScreen] preview error:', e);
      }
    }
  };

  return (
      <View style={styles.container}>
        <Text style={styles.label}>מהירות דיבור</Text>

        {/* Current */}
        <View style={styles.currentSpeedBox}>
          <Text style={styles.currentSpeedValue}>{currentOption.label}</Text>
          <Text style={styles.currentSpeedLabel}>מהירות נוכחית</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsRow}>
          {SPEED_OPTIONS.map((option) => {
            const isActive = currentOption.id === option.id;

            return (
                <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionButton,
                      isActive && styles.optionButtonActive,
                    ]}
                    onPress={() => handleSelect(option)}
                    activeOpacity={0.8}
                >
                  <Text
                      style={[
                        styles.optionText,
                        isActive && styles.optionTextActive,
                      ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
            );
          })}
        </View>

        {/* Try */}
        <TouchableOpacity style={styles.tryButton} onPress={handleTry}>
          <Text style={styles.tryButtonText}>🔊 נסה את המהירות</Text>
        </TouchableOpacity>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },

  label: {
    fontSize: 18,
    color: '#1A1A1A',
    fontWeight: '700',
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: 20,
  },

  currentSpeedBox: {
    backgroundColor: '#EDE7F6',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 32,
  },

  currentSpeedValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7C4DFF',
    marginBottom: 6,
  },

  currentSpeedLabel: {
    fontSize: 13,
    color: '#7C4DFF',
    fontWeight: '500',
    writingDirection: 'rtl',
  },

  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 32,
  },

  optionButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },

  optionButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },

  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    writingDirection: 'rtl',
  },

  optionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  tryButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  tryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    writingDirection: 'rtl',
  },
});