import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from 'react-native';
import { useDabriStore } from '../store';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useSpeech } from '../hooks/useSpeech';
import { parseIntent } from '../services/intentParser';
import { dispatchAction } from '../services/actionDispatcher';
import { MicButton } from '../components/MicButton';
import { VoiceOverlay } from '../components/VoiceOverlay';
import { ConversationLog } from '../components/ConversationLog';
import { generateId } from '../utils/hebrewUtils';
import { ConversationEntry } from '../types';
import AssistantBridge from '../native/AssistantBridge';

export function HomeScreen(): React.JSX.Element {
  const {
    voiceStatus,
    lastTranscript,
    conversations,
    geminiApiKey,
    addConversation,
    updateConversation,
  } = useDabriStore();

  const speechResult = useSpeech();

  const speak = useCallback(
      (text: string) => {
        try {
          speechResult?.speak?.(text);
        } catch (e) {
          console.log('[HomeScreen] speak error:', e);
        }
      },
      [speechResult],
  );

  const stopSpeaking = useCallback(() => {
    try {
      speechResult?.stopSpeaking?.();
    } catch (e) {
      console.log('[HomeScreen] stopSpeaking error:', e);
    }
  }, [speechResult]);

  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  const handleVoiceResult = useCallback(
      async (text: string) => {
        if (text.startsWith('\u200B')) {
          const errorMessage = text.slice(1);
          const id = generateId();
          addConversation({
            id,
            userText: '⚠️',
            parsedIntent: null,
            result: errorMessage,
            status: 'error',
            timestamp: Date.now(),
          });
          speak(errorMessage);
          return;
        }

        const id = generateId();

        const pendingEntry: ConversationEntry = {
          id,
          userText: text,
          parsedIntent: null,
          result: '',
          status: 'pending',
          timestamp: Date.now(),
        };
        addConversation(pendingEntry);

        console.log('[HomeScreen] parseIntent - geminiApiKey:', geminiApiKey ? 'present' : 'missing');
        const parsedIntent = await parseIntent(text, geminiApiKey);
        updateConversation(id, { parsedIntent });

        if (parsedIntent.intent === 'UNKNOWN') {
          const reply = 'לא הבנתי, אפשר לנסות שוב?';
          updateConversation(id, { result: reply, status: 'error' });
          speak(reply);
          return;
        }

        const actionResult = await dispatchAction(parsedIntent);
        updateConversation(id, {
          result: actionResult.message,
          status: actionResult.success ? 'success' : 'error',
        });
        speak(actionResult.message);
      },
      [geminiApiKey, addConversation, updateConversation, speak],
  );

  const { startListening, stopListening } = useVoiceRecognition({
    onResult: handleVoiceResult,
  });

  const handleMicPress = useCallback(() => {
    if (voiceStatus === 'listening') {
      stopListening();
    } else if (voiceStatus === 'speaking') {
      stopSpeaking();
    } else if (voiceStatus === 'idle') {
      setIsOverlayVisible(true);
      startListening();
    }
  }, [voiceStatus, startListening, stopListening, stopSpeaking]);

  const handleOverlayClose = useCallback(() => {
    stopListening();
    stopSpeaking();
    setIsOverlayVisible(false);
  }, [stopListening]);

  const didCheckAssist = useRef(false);

  useEffect(() => {
    const checkAndListen = async () => {
      if (!AssistantBridge || voiceStatus !== 'idle') return;
      const launched = await AssistantBridge.wasLaunchedFromAssist();
      if (launched) {
        setTimeout(() => {
          setIsOverlayVisible(true);
          startListening();
        }, 500);
      }
    };

    if (!didCheckAssist.current) {
      didCheckAssist.current = true;
      checkAndListen();
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAndListen();
      }
    });

    return () => subscription.remove();
  }, []);

  const hasConversations = conversations.length > 0;

  return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>דברי</Text>
        </View>

        <View style={styles.mainContent}>
          {hasConversations ? (
              <>
                {!isOverlayVisible && (
                    <View style={styles.micTopSection}>
                      <MicButton status={voiceStatus} onPress={handleMicPress} />

                      {/* ✅ NEW STOP BUTTON */}
                      {voiceStatus === 'speaking' && (
                          <TouchableOpacity
                              style={styles.stopButton}
                              onPress={stopSpeaking}
                          >
                            <Text style={styles.stopText}>עצור ⏹️</Text>
                          </TouchableOpacity>
                      )}

                      <View style={styles.divider} />
                    </View>
                )}

                <View style={styles.conversationContainer}>
                  <ConversationLog conversations={conversations} />
                </View>
              </>
          ) : (
              <View style={styles.emptyState}>
                <Text style={styles.greeting}>שלום!</Text>

                <MicButton status={voiceStatus} onPress={handleMicPress} />

                {/* ✅ גם ב-empty */}
                {voiceStatus === 'speaking' && (
                    <TouchableOpacity
                        style={styles.stopButton}
                        onPress={stopSpeaking}
                    >
                      <Text style={styles.stopText}>עצור ⏹️</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.chips}>
                  <TouchableOpacity style={styles.chip} onPress={handleMicPress}>
                    <Text style={styles.chipText}>שלח הודעה</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.chip} onPress={handleMicPress}>
                    <Text style={styles.chipText}>תתקשר ל...</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.chip} onPress={handleMicPress}>
                    <Text style={styles.chipText}>תקרא הודעות</Text>
                  </TouchableOpacity>
                </View>
              </View>
          )}
        </View>

        <VoiceOverlay
            visible={isOverlayVisible}
            onClose={handleOverlayClose}
            voiceStatus={voiceStatus}
            transcript={lastTranscript}
            onMicPress={handleMicPress}
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  stopButton: {
    marginTop: 12,
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  stopText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  mainContent: { flex: 1 },
  conversationContainer: { flex: 1 },
  micTopSection: { padding: 20, alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#F0F0F0', width: '100%' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { fontSize: 32, marginBottom: 20 },

  chips: { flexDirection: 'row', gap: 10, marginTop: 20 },
  chip: {
    backgroundColor: '#F8F9FA',
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  chipText: { fontSize: 14 },
});