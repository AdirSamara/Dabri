import React, { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
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
import { GEMINI_MODEL } from '../utils/constants';
import { useDabriStore } from '../store';

async function validateGeminiKey(apiKey: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    // 1. Initialize SDK
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('model', GEMINI_MODEL);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // 2. Perform a minimal "health check" call
    // We use a tiny maxOutputTokens to save quota/time
    await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'health check' }] }],
      generationConfig: { maxOutputTokens: 1 },
    });

    // If we reach here, the request succeeded (HTTP 200)
    return { ok: true, status: 200 };

  } catch (e: any) {
    // The SDK error object usually contains the status code
    const status = e.status || e.response?.status;
    const errorMessage = e.message || String(e);

    // Logic: If the key is recognized but limited (429), it's still "ok" (valid)
    if (status === 429) {
      console.warn('[Gemini SDK] Key is valid but rate limited (429).');
      return { ok: true, status: 429 };
    }

    // Common invalid key errors are 400 (Bad Request) or 403 (Forbidden)
    console.error('[Gemini SDK] Validation failed:', errorMessage);

    return {
      ok: false,
      status: status,
      error: errorMessage
    };
  }
}

export function ApiKeySettingsScreen(): React.JSX.Element {
  const { geminiApiKey, setGeminiApiKey } = useDabriStore();

  // Initialize with empty — user must enter key to save
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [validating, setValidating] = useState(false);

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();

    if (!trimmed) {
      ToastAndroid.show('הזן מפתח קודם', ToastAndroid.SHORT);
      return;
    }

    setValidating(true);
    const result = await validateGeminiKey(trimmed);
    setValidating(false);

    if (result.ok) {
      console.log('[ApiKeySettingsScreen] Saving API key to store');
      setGeminiApiKey(trimmed);

      // Clear the input field after saving
      setApiKeyInput('');

      ToastAndroid.show('המפתח נשמר ✓', ToastAndroid.SHORT);
    } else if (result.error) {
      ToastAndroid.show(`שגיאת רשת: ${result.error.slice(0, 40)}`, ToastAndroid.LONG);
    } else {
      ToastAndroid.show(`מפתח לא תקין (${result.status})`, ToastAndroid.LONG);
    }
  };

  const handleDelete = () => {
    setGeminiApiKey('');
    ToastAndroid.show('המפתח נמחק', ToastAndroid.SHORT);
  };

  return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          {'כדי להשתמש בניתוח פקודות מתקדם, הזן מפתח API מ-aistudio.google.com.\nללא מפתח, האפליקציה תשתמש בזיהוי בסיסי.'}
        </Text>

        {/* Input תמיד ריק */}
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
            style={[
              styles.saveButton,
              (validating || !apiKeyInput.trim()) && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveApiKey}
            disabled={validating || !apiKeyInput.trim()}
        >
          {validating ? (
              <ActivityIndicator color="#fff" size="small" />
          ) : (
              <Text style={styles.saveButtonText}>שמור מפתח</Text>
          )}
        </TouchableOpacity>

        {/* Status */}
        <View style={styles.statusSection}>
          <View style={styles.statusRow}>
            <View
                style={[
                  styles.statusDot,
                  { backgroundColor: geminiApiKey ? '#4CAF50' : '#F44336' },
                ]}
            />
            <Text
                style={[
                  styles.statusText,
                  { color: geminiApiKey ? '#4CAF50' : '#F44336' },
                ]}
            >
              {geminiApiKey ? 'מפתח פעיל' : 'לא הוגדר מפתח'}
            </Text>
          </View>

          {geminiApiKey ? (
              <>
                <Text style={styles.keyPreview}>
                  {geminiApiKey.slice(0, 8)}
                  {'•'.repeat(Math.min(geminiApiKey.length - 8, 20))}
                </Text>

                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDelete}
                >
                  <Text style={styles.deleteButtonText}>מחק מפתח</Text>
                </TouchableOpacity>
              </>
          ) : null}
        </View>
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    padding: 20,
  },

  description: {
    fontSize: 13,
    color: '#666666',
    writingDirection: 'rtl',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 16,
  },

  apiKeyInput: {
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#1A1A1A',
    backgroundColor: '#F8F9FA',
    textAlign: 'left',
  },

  saveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 14,
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

  statusSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 8,
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
    marginTop: 4,
    letterSpacing: 1,
  },

  deleteButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F44336',
    alignItems: 'center',
  },

  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
  },
});