import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Alert,
} from 'react-native';
import { useDabriStore } from '../store';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useSpeech } from '../hooks/useSpeech';
import { parseIntent } from '../services/intentParser';
import { dispatchAction } from '../services/actionDispatcher';
import { cancelReminderById, formatHebrewTimeDescription } from '../services/reminderService';
import { MicButton } from '../components/MicButton';
import { VoiceOverlay } from '../components/VoiceOverlay';
import { ConversationLog } from '../components/ConversationLog';
import { ReminderEditModal } from '../components/ReminderEditModal';
import { SmsViewerModal } from '../components/SmsViewerModal';
import { generateId, normalizeHebrew } from '../utils/hebrewUtils';
import { ConversationEntry, Reminder, Contact, SmsMessage } from '../types';
import AssistantBridge from '../native/AssistantBridge';
import { useTheme } from '../utils/theme';
import { AppIcon } from '../components/AppIcon';

// ── Disambiguation helpers ──────────────────────────────────────────
const OPTION_LABELS = ['אחת', 'שתיים', 'שלוש'];

const NUMBER_WORDS: Record<string, number> = {
  'אחת': 0, 'אחד': 0, '1': 0, 'ראשון': 0, 'ראשונה': 0,
  'אפשרות אחת': 0, 'אפשרות אחד': 0, 'אפשרות 1': 0,
  'שתיים': 1, 'שניים': 1, 'שני': 1, '2': 1, 'שנייה': 1,
  'אפשרות שתיים': 1, 'אפשרות שניים': 1, 'אפשרות 2': 1,
  'שלוש': 2, 'שלושה': 2, '3': 2, 'שלישי': 2, 'שלישית': 2,
  'אפשרות שלוש': 2, 'אפשרות שלושה': 2, 'אפשרות 3': 2,
};

function matchDisambiguationChoice(text: string, candidates: Contact[]): Contact | null {
  const normalized = normalizeHebrew(text);
  // Check number words (including "אפשרות X" forms)
  const idx = NUMBER_WORDS[normalized];
  if (idx !== undefined && idx < candidates.length) {
    return candidates[idx];
  }
  // Try matching by name
  for (const c of candidates) {
    if (normalizeHebrew(c.displayName).includes(normalized) && normalized.length >= 2) {
      return c;
    }
  }
  return null;
}

function buildDisambiguationMessage(candidates: Contact[]): string {
  const count = candidates.length === 2 ? 'שני' : 'שלושה';
  const options = candidates.map((c, i) => `${OPTION_LABELS[i]}: ${c.displayName}`).join('. ');
  return `מצאתי ${count} אנשי קשר. ${options}. בחר אפשרות.`;
}

export function HomeScreen(): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 10,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      color: theme.text,
    },
    mainContent: { flex: 1 },
    conversationContainer: { flex: 1 },
    micTopSection: { padding: 20, alignItems: 'center' },
    divider: { height: 1, backgroundColor: theme.border, width: '100%' },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    greeting: { fontSize: 32, marginTop: 16, marginBottom: 20, color: theme.text },
    chips: { flexDirection: 'row', gap: 10, marginTop: 20 },
    chip: {
      backgroundColor: theme.chipBackground,
      borderRadius: 50,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    chipText: { fontSize: 14, color: theme.text },
  }), [theme]);

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

        // ── Handle pending disambiguation ──
        const pending = useDabriStore.getState().pendingDisambiguation;
        if (pending) {
          const selected = matchDisambiguationChoice(text, pending.candidates);
          if (selected) {
            useDabriStore.getState().setPendingDisambiguation(null);
            const resolvedIntent = { ...pending.intent, contact: selected.displayName };
            const result = await dispatchAction(resolvedIntent);
            updateConversation(pending.conversationId, {
              result: result.message,
              status: result.success ? 'success' : 'error',
            });
            speak(result.message);
            return;
          }
          // Didn't match a choice — clear disambiguation and process as new command
          useDabriStore.getState().setPendingDisambiguation(null);
        }

        // ── Normal flow ──
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

        // ── Disambiguation needed? ──
        if (actionResult.disambiguation) {
          const { candidates, intent: originalIntent, correctedMessage } = actionResult.disambiguation;
          useDabriStore.getState().setPendingDisambiguation({
            conversationId: id,
            intent: originalIntent,
            candidates,
            correctedMessage,
          });
          const ttsMsg = buildDisambiguationMessage(candidates);
          updateConversation(id, { result: ttsMsg, status: 'pending' });
          speak(ttsMsg);
          return;
        }

        updateConversation(id, {
          result: actionResult.message,
          status: actionResult.success ? 'success' : 'error',
          ...(actionResult.smsMessages ? { smsMessages: actionResult.smsMessages } : {}),
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

  const reminders = useDabriStore((s) => s.reminders);
  const [smsViewerMessages, setSmsViewerMessages] = useState<SmsMessage[]>([]);
  const [smsViewerVisible, setSmsViewerVisible] = useState(false);

  const handleEntryPress = useCallback(
    (entry: ConversationEntry) => {
      // SMS viewer
      if (
        entry.parsedIntent?.intent === 'READ_SMS' &&
        entry.smsMessages &&
        entry.smsMessages.length > 0
      ) {
        setSmsViewerMessages(entry.smsMessages);
        setSmsViewerVisible(true);
        return;
      }

      // Reminder details
      if (entry.parsedIntent?.intent !== 'SET_REMINDER') return;

      const reminderText = entry.parsedIntent.reminderText;
      if (!reminderText || reminderText === '__LIST__') return;

      const reminder = reminders.find(
        (r) => r.text === reminderText && !r.completed,
      );

      if (!reminder) {
        Alert.alert('תזכורת', 'התזכורת כבר בוצעה או בוטלה.');
        return;
      }

      const timeDesc = formatHebrewTimeDescription(new Date(reminder.triggerTime));

      Alert.alert(
        'תזכורת',
        `${reminder.text}\n${timeDesc}`,
        [
          { text: 'סגור', style: 'cancel' },
          {
            text: 'בטל תזכורת',
            style: 'destructive',
            onPress: () => cancelReminderById(reminder.id),
          },
        ],
      );
    },
    [reminders],
  );

  const handleDisambiguate = useCallback(
    async (contact: Contact) => {
      stopListening(); // Stop STT that auto-listen started
      const pending = useDabriStore.getState().pendingDisambiguation;
      if (!pending) { return; }
      useDabriStore.getState().setPendingDisambiguation(null);
      const resolvedIntent = { ...pending.intent, contact: contact.displayName };
      const result = await dispatchAction(resolvedIntent);
      updateConversation(pending.conversationId, {
        result: result.message,
        status: result.success ? 'success' : 'error',
      });
      speak(result.message);
    },
    [updateConversation, speak, stopListening],
  );

  const pendingDisambiguation = useDabriStore((s) => s.pendingDisambiguation);

  // Auto-start listening after disambiguation TTS finishes
  useEffect(() => {
    if (pendingDisambiguation && voiceStatus === 'idle') {
      setIsOverlayVisible(true);
      startListening();
    }
  }, [pendingDisambiguation, voiceStatus, startListening]);

  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const handleDeleteReminder = useCallback((id: string) => {
    cancelReminderById(id);
    setEditingReminder(null);
  }, []);

  const handleEditReminder = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
  }, []);

  const handleSaveReminder = useCallback(async (id: string, newText: string, newTriggerTime?: number) => {
    const updates: Partial<import('../types').Reminder> = { text: newText };
    if (newTriggerTime) {
      updates.triggerTime = newTriggerTime;
      // Reschedule native alarm with new time
      const ReminderBridge = require('../native/ReminderBridge').default;
      if (ReminderBridge) {
        try {
          await ReminderBridge.cancelReminder(id);
          await ReminderBridge.scheduleReminder(id, newText, newTriggerTime);
        } catch (e) {
          console.log('[HomeScreen] Failed to reschedule reminder:', e);
        }
      }
    }
    useDabriStore.getState().updateReminder(id, updates);
    setEditingReminder(null);
  }, []);

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
          <AppIcon size={36} />
        </View>

        <View style={styles.mainContent}>
          {hasConversations ? (
              <>
                {!isOverlayVisible && (
                    <View style={styles.micTopSection}>
                      <MicButton status={voiceStatus} onPress={handleMicPress} />
                      <View style={styles.divider} />
                    </View>
                )}

                <View style={styles.conversationContainer}>
                  <ConversationLog
                    conversations={conversations}
                    onEntryPress={handleEntryPress}
                    reminders={reminders}
                    onDeleteReminder={handleDeleteReminder}
                    onEditReminder={handleEditReminder}
                    formatReminderTime={formatHebrewTimeDescription}
                    pendingDisambiguation={pendingDisambiguation}
                    onDisambiguate={handleDisambiguate}
                  />
                </View>
              </>
          ) : (
              <View style={styles.emptyState}>
                <AppIcon size={80} />
                <Text style={styles.greeting}>שלום!</Text>

                <MicButton status={voiceStatus} onPress={handleMicPress} />

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

        <ReminderEditModal
          visible={editingReminder !== null}
          reminder={editingReminder}
          formatTime={formatHebrewTimeDescription}
          onSave={handleSaveReminder}
          onDelete={handleDeleteReminder}
          onClose={() => setEditingReminder(null)}
        />

        <SmsViewerModal
          visible={smsViewerVisible}
          messages={smsViewerMessages}
          onClose={() => setSmsViewerVisible(false)}
          onReadAloud={(text) => speak(text)}
        />
      </SafeAreaView>
  );
}
