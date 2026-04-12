import React, { useMemo } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { ConversationEntry, Intent, Reminder } from '../types';
import { useTheme } from '../utils/theme';
import { ReminderListCard } from './ReminderListCard';

interface ConversationLogProps {
  conversations: ConversationEntry[];
  onEntryPress?: (entry: ConversationEntry) => void;
  reminders?: Reminder[];
  onDeleteReminder?: (id: string) => void;
  onEditReminder?: (reminder: Reminder) => void;
  formatReminderTime?: (date: Date) => string;
}

const INTENT_LABELS: Record<Intent, string> = {
  SEND_SMS: 'שליחת הודעה',
  READ_SMS: 'קריאת הודעות',
  MAKE_CALL: 'שיחה',
  SEND_WHATSAPP: 'שליחת וואטסאפ',
  READ_WHATSAPP: 'קריאת וואטסאפ',
  READ_NOTIFICATIONS: 'קריאת התראות',
  SET_REMINDER: 'הגדרת תזכורת',
  OPEN_APP: 'פתיחת אפליקציה',
  UNKNOWN: 'לא ידוע',
};

const STATUS_COLORS = {
  success: '#4CAF50',
  error: '#F44336',
  pending: '#FF9800',
};

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) { return 'עכשיו'; }
  if (minutes === 1) { return 'לפני דקה'; }
  if (minutes < 60) { return `לפני ${minutes} דקות`; }
  return 'היום';
}

interface ConversationItemProps {
  item: ConversationEntry;
  onPress?: () => void;
  reminders?: Reminder[];
  onDeleteReminder?: (id: string) => void;
  onEditReminder?: (reminder: Reminder) => void;
  formatReminderTime?: (date: Date) => string;
}

function ConversationItem({ item, onPress, reminders, onDeleteReminder, onEditReminder, formatReminderTime }: ConversationItemProps): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    item: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginVertical: 6,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    timeText: {
      fontSize: 11,
      color: theme.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'right',
      marginBottom: 6,
    },
    userText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      writingDirection: 'rtl',
      textAlign: 'right',
      marginBottom: 4,
    },
    intentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 6,
      gap: 6,
    },
    intentLabel: {
      fontSize: 12,
      color: '#2196F3',
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    geminiSource: {
      backgroundColor: theme.geminiBadgeBackground,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    geminiSourceText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.geminiBadgeText,
    },
    resultRow: { flexDirection: 'row', alignItems: 'flex-start' },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 4,
      marginLeft: 8,
    },
    resultText: {
      flex: 1,
      fontSize: 14,
      color: theme.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    tapHint: {
      fontSize: 11,
      color: '#2196F3',
      writingDirection: 'rtl',
      textAlign: 'right',
      marginTop: 6,
    },
  }), [theme]);

  const dotColor = STATUS_COLORS[item.status];
  const isReminderSuccess =
    item.parsedIntent?.intent === 'SET_REMINDER' &&
    item.status === 'success' &&
    item.parsedIntent.reminderText !== '__LIST__' &&
    item.parsedIntent.reminderText !== null;

  const isReminderList =
    item.parsedIntent?.intent === 'SET_REMINDER' &&
    item.status === 'success' &&
    (item.parsedIntent.reminderText === '__LIST__' || item.parsedIntent.reminderText === null);

  const content = (
    <View style={styles.item}>
      <Text style={styles.timeText}>{getRelativeTime(item.timestamp)}</Text>
      <Text style={styles.userText}>{item.userText}</Text>

      {item.parsedIntent && item.parsedIntent.intent !== 'UNKNOWN' && (
        <View style={styles.intentRow}>
          <Text style={styles.intentLabel}>
            {isReminderList ? 'רשימת תזכורות' : INTENT_LABELS[item.parsedIntent.intent]}
          </Text>
          {item.parsedIntent.source === 'gemini' && (
            <View style={styles.geminiSource}>
              <Text style={styles.geminiSourceText}>✨ AI</Text>
            </View>
          )}
        </View>
      )}

      {isReminderList && reminders && onDeleteReminder && onEditReminder && formatReminderTime ? (
        <ReminderListCard
          reminders={reminders}
          onDelete={onDeleteReminder}
          onEdit={onEditReminder}
          formatTime={formatReminderTime}
        />
      ) : item.result.length > 0 ? (
        <View style={styles.resultRow}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.resultText}>{item.result}</Text>
        </View>
      ) : null}

      {isReminderSuccess && onPress && (
        <Text style={styles.tapHint}>{'לחץ לפרטים ‹'}</Text>
      )}
    </View>
  );

  if (isReminderSuccess && onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export function ConversationLog({ conversations, onEntryPress, reminders, onDeleteReminder, onEditReminder, formatReminderTime }: ConversationLogProps): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 16,
      color: theme.textTertiary,
      writingDirection: 'rtl',
      textAlign: 'center',
      lineHeight: 24,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      paddingBottom: 8,
    },
  }), [theme]);

  if (conversations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {'אמור משהו כמו "שלח הודעה לאמא שאני בדרך"'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ConversationItem
          item={item}
          onPress={onEntryPress ? () => onEntryPress(item) : undefined}
          reminders={reminders}
          onDeleteReminder={onDeleteReminder}
          onEditReminder={onEditReminder}
          formatReminderTime={formatReminderTime}
        />
      )}
      inverted
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}
