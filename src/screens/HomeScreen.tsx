import React, { useCallback, useEffect, useRef } from 'react';
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
import { StatusIndicator } from '../components/StatusIndicator';
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

  const { speak, stopSpeaking } = useSpeech();

  const handleVoiceResult = useCallback(
    async (text: string) => {
      // Zero-width space prefix signals a pre-translated error from the STT layer
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

      // Parse intent
      const parsedIntent = await parseIntent(text, geminiApiKey);
      updateConversation(id, { parsedIntent });

      if (parsedIntent.intent === 'UNKNOWN') {
        const reply = 'לא הבנתי, אפשר לנסות שוב?';
        updateConversation(id, {
          result: reply,
          status: 'error',
        });
        speak(reply);
        return;
      }

      // Dispatch action
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
      startListening();
    }
    // Ignore press during 'processing'
  }, [voiceStatus, startListening, stopListening, stopSpeaking]);

  // Auto-listen when launched as default assistant (on mount + on foreground)
  const didCheckAssist = useRef(false);

  useEffect(() => {
    const checkAndListen = async () => {
      if (!AssistantBridge || voiceStatus !== 'idle') {
        return;
      }
      const launched = await AssistantBridge.wasLaunchedFromAssist();
      if (launched) {
        setTimeout(() => startListening(), 500);
      }
    };

    // Check on mount
    if (!didCheckAssist.current) {
      didCheckAssist.current = true;
      checkAndListen();
    }

    // Check when app comes back to foreground (handles singleTask re-launch)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAndListen();
      }
    });

    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>דברי</Text>
        <Text style={styles.subtitle}>העוזרת הקולית שלך</Text>
      </View>

      {/* Conversation log */}
      <View style={styles.conversationContainer}>
        <ConversationLog conversations={conversations} />
      </View>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        <StatusIndicator status={voiceStatus} transcript={lastTranscript} />

        {/* Stop button — visible only while speaking */}
        {voiceStatus === 'speaking' && (
          <TouchableOpacity style={styles.stopButton} onPress={stopSpeaking}>
            <View style={styles.stopIcon} />
          </TouchableOpacity>
        )}

        <View style={styles.micWrapper}>
          <MicButton status={voiceStatus} onPress={handleMicPress} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  conversationContainer: {
    flex: 1,
  },
  bottomSection: {
    paddingBottom: 24,
    paddingTop: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  micWrapper: {
    marginTop: 12,
  },
  stopButton: {
    marginTop: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  stopIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#555',
  },
});
