import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  VoiceStatus,
  ConversationEntry,
  NotificationItem,
  Reminder,
  PendingDisambiguation,
} from '../types';
import { MAX_CONVERSATION_LOG, MAX_NOTIFICATIONS_BUFFER } from '../utils/constants';

interface DabriState {
  // Voice
  voiceStatus: VoiceStatus;
  lastTranscript: string;

  // Conversation log (session-only, not persisted)
  conversations: ConversationEntry[];

  // Notifications buffer (from native module, not persisted)
  recentNotifications: NotificationItem[];

  // Reminders (persisted)
  reminders: Reminder[];

  // Disambiguation (session-only)
  pendingDisambiguation: PendingDisambiguation | null;

  // Settings (persisted)
  geminiApiKey: string;
  ttsSpeed: number;
  isDarkMode: boolean;
  silenceTimeout: number; // ms after last speech to auto-stop (1000, 1500, 2000)
  contactAliases: Record<string, string>;

  // Actions
  setVoiceStatus: (status: VoiceStatus) => void;
  setLastTranscript: (transcript: string) => void;
  addConversation: (entry: ConversationEntry) => void;
  updateConversation: (id: string, updates: Partial<ConversationEntry>) => void;
  setRecentNotifications: (notifications: NotificationItem[]) => void;
  addNotification: (notification: NotificationItem) => void;
  addReminder: (reminder: Reminder) => void;
  removeReminder: (id: string) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  completeReminder: (id: string) => void;
  snoozeReminder: (id: string, minutes: number) => void;
  setPendingDisambiguation: (data: PendingDisambiguation | null) => void;
  setGeminiApiKey: (key: string) => void;
  setTtsSpeed: (speed: number) => void;
  setDarkMode: (dark: boolean) => void;
  setSilenceTimeout: (ms: number) => void;
  setContactAlias: (name: string, alias: string) => void;
  removeContactAlias: (name: string) => void;
}

export const useDabriStore = create<DabriState>()(
  persist(
    (set) => ({
      // Initial state
      voiceStatus: 'idle',
      lastTranscript: '',
      conversations: [],
      recentNotifications: [],
      reminders: [],
      pendingDisambiguation: null,
      geminiApiKey: '',
      ttsSpeed: 0.6,
      isDarkMode: false,
      silenceTimeout: 1000,
      contactAliases: {},

      // Actions
      setVoiceStatus: (status) => set({ voiceStatus: status }),

      setLastTranscript: (transcript) => set({ lastTranscript: transcript }),

      addConversation: (entry) =>
        set((state) => ({
          conversations: [entry, ...state.conversations].slice(0, MAX_CONVERSATION_LOG),
        })),

      updateConversation: (id, updates) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),

      setRecentNotifications: (notifications) =>
        set({ recentNotifications: notifications }),

      addNotification: (notification) =>
        set((state) => ({
          recentNotifications: [notification, ...state.recentNotifications].slice(
            0,
            MAX_NOTIFICATIONS_BUFFER,
          ),
        })),

      addReminder: (reminder) =>
        set((state) => ({ reminders: [...state.reminders, reminder] })),

      removeReminder: (id) =>
        set((state) => ({
          reminders: state.reminders.filter((r) => r.id !== id),
        })),

      updateReminder: (id, updates) =>
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, ...updates } : r,
          ),
        })),

      completeReminder: (id) =>
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, completed: true } : r,
          ),
        })),

      snoozeReminder: (id, minutes) =>
        set((state) => {
          const snoozeTime = Date.now() + minutes * 60 * 1000;
          return {
            reminders: state.reminders.map((r) =>
              r.id === id
                ? { ...r, triggerTime: snoozeTime, snoozedUntil: snoozeTime }
                : r,
            ),
          };
        }),

      setPendingDisambiguation: (data) => set({ pendingDisambiguation: data }),

      setGeminiApiKey: (key) => set({ geminiApiKey: key }),

      setTtsSpeed: (speed) => set({ ttsSpeed: speed }),

      setDarkMode: (dark) => set({ isDarkMode: dark }),

      setSilenceTimeout: (ms) => set({ silenceTimeout: ms }),

      setContactAlias: (name, alias) =>
        set((state) => ({
          contactAliases: { ...state.contactAliases, [name]: alias },
        })),

      removeContactAlias: (name) =>
        set((state) => {
          const { [name]: _removed, ...rest } = state.contactAliases;
          return { contactAliases: rest };
        }),
    }),
    {
      name: 'dabri-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        reminders: state.reminders,
        geminiApiKey: state.geminiApiKey,
        ttsSpeed: state.ttsSpeed,
        isDarkMode: state.isDarkMode,
        silenceTimeout: state.silenceTimeout,
        contactAliases: state.contactAliases,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.log('[Store] Rehydration error:', error);
        } else if (state) {
          console.log('[Store] Rehydrated - geminiApiKey:', state.geminiApiKey ? 'present' : 'empty');
        }
      },
    },
  ),
);
