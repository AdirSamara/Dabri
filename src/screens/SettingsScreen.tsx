import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ToastAndroid,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { GEMINI_API_URL, GEMINI_MODEL } from '../utils/constants';
import { useDabriStore } from '../store';

async function validateGeminiKey(apiKey: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    console.log('[validateGeminiKey] Testing URL:', `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=***`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'say ok' }] }],
        generationConfig: { maxOutputTokens: 4 },
      }),
    });
    const body = await response.text();
    console.log('[validateGeminiKey] Status:', response.status);
    console.log('[validateGeminiKey] Body:', body.slice(0, 300));
    // 429 = rate limited — key is valid but quota exceeded
    const keyRecognized = response.ok || response.status === 429;
    return { ok: keyRecognized, status: response.status };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.log('[validateGeminiKey] Network error:', error);
    return { ok: false, error };
  }
}

const TTS_SPEEDS = [0.7, 0.8, 0.9, 1.0, 1.1];

export function SettingsScreen(): React.JSX.Element {
  const { geminiApiKey, setGeminiApiKey, ttsSpeed, setTtsSpeed } = useDabriStore();
  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey);
  const [validating, setValidating] = useState(false);

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setGeminiApiKey('');
      ToastAndroid.show('המפתח נמחק', ToastAndroid.SHORT);
      return;
    }
    setValidating(true);
    const result = await validateGeminiKey(trimmed);
    setValidating(false);
    if (result.ok) {
      setGeminiApiKey(trimmed);
      ToastAndroid.show('המפתח תקין ונשמר ✓', ToastAndroid.SHORT);
    } else if (result.error) {
      ToastAndroid.show(`שגיאת רשת: ${result.error.slice(0, 40)}`, ToastAndroid.LONG);
    } else {
      ToastAndroid.show(`מפתח לא תקין (${result.status}), נסה שוב`, ToastAndroid.LONG);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* API Key Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>מפתח Gemini API</Text>
        <Text style={styles.description}>
          {
            'כדי להשתמש בניתוח פקודות מתקדם, הזן מפתח API מ-aistudio.google.com.\nללא מפתח, האפליקציה תשתמש בזיהוי בסיסי.'
          }
        </Text>
        <TextInput
          style={styles.apiKeyInput}
          value={apiKeyInput}
          onChangeText={setApiKeyInput}
          placeholder="הזן מפתח API..."
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={false}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity
          style={[styles.saveButton, validating && styles.saveButtonDisabled]}
          onPress={handleSaveApiKey}
          disabled={validating}
        >
          {validating
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveButtonText}>שמור מפתח</Text>
          }
        </TouchableOpacity>
      </View>

      {/* TTS Speed Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>מהירות דיבור</Text>
        <View style={styles.speedRow}>
          {TTS_SPEEDS.map((speed) => (
            <TouchableOpacity
              key={speed}
              style={[
                styles.speedButton,
                ttsSpeed === speed && styles.speedButtonActive,
              ]}
              onPress={() => setTtsSpeed(speed)}
            >
              <Text
                style={[
                  styles.speedButtonText,
                  ttsSpeed === speed && styles.speedButtonTextActive,
                ]}
              >
                {speed.toFixed(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Key status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>סטטוס מפתח</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: geminiApiKey ? '#4CAF50' : '#F44336' }]} />
          <Text style={[styles.statusText, { color: geminiApiKey ? '#4CAF50' : '#F44336' }]}>
            {geminiApiKey ? 'מפתח פעיל' : 'לא הוגדר מפתח'}
          </Text>
        </View>
        {geminiApiKey ? (
          <>
            <Text style={styles.keyPreview}>
              {geminiApiKey.slice(0, 8)}{'•'.repeat(Math.min(geminiApiKey.length - 8, 20))}
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                setGeminiApiKey('');
                setApiKeyInput('');
                ToastAndroid.show('המפתח נמחק', ToastAndroid.SHORT);
              }}
            >
              <Text style={styles.deleteButtonText}>מחק מפתח</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>אודות</Text>
        <Text style={styles.aboutText}>דברי - העוזרת הקולית שלך</Text>
        <Text style={styles.aboutVersion}>גרסה 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingVertical: 16,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#666',
    writingDirection: 'rtl',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 12,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#333',
    backgroundColor: '#fafafa',
    textAlign: 'left',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  speedButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  speedButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  speedButtonText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  speedButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  keyPreview: {
    fontSize: 12,
    color: '#aaa',
    fontFamily: 'monospace',
    textAlign: 'right',
    marginTop: 6,
    letterSpacing: 1,
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
  },
  aboutText: {
    fontSize: 15,
    color: '#333',
    writingDirection: 'rtl',
    textAlign: 'right',
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 13,
    color: '#888',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});
