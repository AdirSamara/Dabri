import React, { useState, useMemo } from 'react';
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
import { useTheme } from '../utils/theme';

async function validateGeminiKey(apiKey: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('model', GEMINI_MODEL);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'health check' }] }],
      generationConfig: { maxOutputTokens: 1 },
    });

    return { ok: true, status: 200 };

  } catch (e: any) {
    const status = e.status || e.response?.status;
    const errorMessage = e.message || String(e);

    if (status === 429) {
      console.warn('[Gemini SDK] Key is valid but rate limited (429).');
      return { ok: true, status: 429 };
    }

    console.error('[Gemini SDK] Validation failed:', errorMessage);
    return { ok: false, status: status, error: errorMessage };
  }
}

export function ApiKeySettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 20 },
    description: {
      fontSize: 13,
      color: theme.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'right',
      lineHeight: 20,
      marginBottom: 16,
    },
    apiKeyInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 13,
      fontFamily: 'monospace',
      color: theme.text,
      backgroundColor: theme.surface,
      textAlign: 'left',
    },
    saveButton: {
      backgroundColor: '#2196F3',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    saveButtonDisabled: { backgroundColor: '#90CAF9' },
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
      borderTopColor: theme.border,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
      marginBottom: 8,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 15, fontWeight: '600', writingDirection: 'rtl' },
    keyPreview: {
      fontSize: 12,
      color: theme.textTertiary,
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
    deleteButtonText: { fontSize: 14, fontWeight: '600', color: '#F44336' },
  }), [theme]);

  const { geminiApiKey, setGeminiApiKey } = useDabriStore();
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

        <TextInput
            style={styles.apiKeyInput}
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder="הזן מפתח API..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={false}
            placeholderTextColor={theme.textTertiary}
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

                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                  <Text style={styles.deleteButtonText}>מחק מפתח</Text>
                </TouchableOpacity>
              </>
          ) : null}
        </View>
      </ScrollView>
  );
}
