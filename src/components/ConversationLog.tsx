import React from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { ConversationEntry, Intent } from '../types';

interface ConversationLogProps {
  conversations: ConversationEntry[];
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

function ConversationItem({ item }: { item: ConversationEntry }): React.JSX.Element {
  const dotColor = STATUS_COLORS[item.status];

  return (
    <View style={styles.item}>
      {/* User text */}
      <Text style={styles.userText}>{item.userText}</Text>

      {/* Intent label + source badge */}
      {item.parsedIntent && item.parsedIntent.intent !== 'UNKNOWN' && (
        <View style={styles.intentRow}>
          <Text style={styles.intentLabel}>
            {INTENT_LABELS[item.parsedIntent.intent]}
          </Text>
          <Text style={[
            styles.sourceBadge,
            item.parsedIntent.source === 'gemini' ? styles.sourceBadgeGemini : styles.sourceBadgeRegex,
          ]}>
            {item.parsedIntent.source === 'gemini' ? 'AI' : '~'}
          </Text>
        </View>
      )}

      {/* Result row */}
      {item.result.length > 0 && (
        <View style={styles.resultRow}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.resultText}>{item.result}</Text>
        </View>
      )}
    </View>
  );
}

export function ConversationLog({ conversations }: ConversationLogProps): React.JSX.Element {
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
      renderItem={({ item }) => <ConversationItem item={item} />}
      inverted
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#aaa',
    writingDirection: 'rtl',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  item: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  userText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
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
  sourceBadge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sourceBadgeGemini: {
    color: '#7C4DFF',
    backgroundColor: '#EDE7F6',
  },
  sourceBadgeRegex: {
    color: '#999',
    backgroundColor: '#F0F0F0',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
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
    color: '#444',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});
