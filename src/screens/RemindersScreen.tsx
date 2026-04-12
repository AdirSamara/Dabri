import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useDabriStore } from '../store';
import { cancelReminderById, formatHebrewTimeDescription } from '../services/reminderService';
import { ReminderEditModal } from '../components/ReminderEditModal';
import { useTheme } from '../utils/theme';
import type { Reminder } from '../types';
import ReminderBridge from '../native/ReminderBridge';

function ReminderRow({
  reminder,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  onEdit: (r: Reminder) => void;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginVertical: 6,
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        topRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        },
        textContainer: {
          flex: 1,
          marginLeft: 12,
        },
        reminderText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 4,
        },
        timeText: {
          fontSize: 14,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
        },
        completedText: {
          opacity: 0.5,
          textDecorationLine: 'line-through',
        },
        actionsRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 10,
        },
        actionButton: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 10,
        },
        editButton: {
          backgroundColor: theme.primary + '18',
        },
        editButtonText: {
          fontSize: 14,
          color: theme.primary,
          fontWeight: '600',
        },
        deleteButton: {
          backgroundColor: theme.error + '18',
        },
        deleteButtonText: {
          fontSize: 14,
          color: theme.error,
          fontWeight: '600',
        },
        statusBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
        },
        activeBadge: {
          backgroundColor: theme.success + '20',
        },
        activeBadgeText: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.success,
        },
        expiredBadge: {
          backgroundColor: theme.textTertiary + '30',
        },
        expiredBadgeText: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.textTertiary,
        },
      }),
    [theme],
  );

  const isActive = !reminder.completed && reminder.triggerTime > Date.now();
  const timeStr = formatHebrewTimeDescription(new Date(reminder.triggerTime));

  const handleDelete = () => {
    Alert.alert('מחיקת תזכורת', `למחוק את התזכורת "${reminder.text}"?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => onDelete(reminder.id),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View
          style={[
            styles.statusBadge,
            isActive ? styles.activeBadge : styles.expiredBadge,
          ]}>
          <Text
            style={isActive ? styles.activeBadgeText : styles.expiredBadgeText}>
            {isActive ? 'פעיל' : 'הושלם'}
          </Text>
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.reminderText,
              !isActive && styles.completedText,
            ]}>
            {reminder.text}
          </Text>
          <Text style={styles.timeText}>{timeStr}</Text>
        </View>
      </View>

      {isActive && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => onEdit(reminder)}
            activeOpacity={0.7}>
            <Text style={styles.editButtonText}>ערוך</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
            activeOpacity={0.7}>
            <Text style={styles.deleteButtonText}>מחק</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function RemindersScreen(): React.JSX.Element {
  const theme = useTheme();
  const reminders = useDabriStore((s) => s.reminders);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.background,
        },
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
          paddingVertical: 8,
          paddingBottom: 24,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
        },
        countText: {
          fontSize: 14,
          color: theme.textSecondary,
          writingDirection: 'rtl',
        },
        clearButton: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: theme.error + '18',
        },
        clearButtonText: {
          fontSize: 13,
          color: theme.error,
          fontWeight: '600',
        },
      }),
    [theme],
  );

  // Sort: active first (by time), then completed
  const sorted = useMemo(() => {
    const now = Date.now();
    const active = reminders
      .filter((r) => !r.completed && r.triggerTime > now)
      .sort((a, b) => a.triggerTime - b.triggerTime);
    const completed = reminders
      .filter((r) => r.completed || r.triggerTime <= now)
      .sort((a, b) => b.triggerTime - a.triggerTime);
    return [...active, ...completed];
  }, [reminders]);

  const activeCount = sorted.filter(
    (r) => !r.completed && r.triggerTime > Date.now(),
  ).length;

  const handleDelete = useCallback((id: string) => {
    cancelReminderById(id);
  }, []);

  const handleEdit = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
  }, []);

  const handleSave = useCallback(
    async (id: string, newText: string, newTriggerTime?: number) => {
      const updates: Partial<Reminder> = { text: newText };
      if (newTriggerTime) {
        updates.triggerTime = newTriggerTime;
        if (ReminderBridge) {
          try {
            await ReminderBridge.cancelReminder(id);
            await ReminderBridge.scheduleReminder(id, newText, newTriggerTime);
          } catch (e) {
            console.log('[RemindersScreen] Failed to reschedule:', e);
          }
        }
      }
      useDabriStore.getState().updateReminder(id, updates);
      setEditingReminder(null);
    },
    [],
  );

  const handleClearCompleted = useCallback(() => {
    const now = Date.now();
    const completedIds = reminders
      .filter((r) => r.completed || r.triggerTime <= now)
      .map((r) => r.id);

    if (completedIds.length === 0) return;

    Alert.alert(
      'ניקוי תזכורות',
      `למחוק ${completedIds.length} תזכורות שהושלמו?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            for (const id of completedIds) {
              useDabriStore.getState().removeReminder(id);
            }
          },
        },
      ],
    );
  }, [reminders]);

  if (sorted.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyText}>
          {'אין תזכורות עדיין.\nאמור "תזכיר לי..." כדי ליצור תזכורת.'}
        </Text>
      </View>
    );
  }

  const completedCount = sorted.length - activeCount;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {completedCount > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearCompleted}
            activeOpacity={0.7}>
            <Text style={styles.clearButtonText}>
              נקה הושלמו ({completedCount})
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.countText}>
          {activeCount === 0
            ? 'אין תזכורות פעילות'
            : activeCount === 1
            ? 'תזכורת אחת פעילה'
            : `${activeCount} תזכורות פעילות`}
        </Text>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReminderRow
            reminder={item}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <ReminderEditModal
        visible={editingReminder !== null}
        reminder={editingReminder}
        formatTime={formatHebrewTimeDescription}
        onSave={handleSave}
        onDelete={(id) => {
          handleDelete(id);
          setEditingReminder(null);
        }}
        onClose={() => setEditingReminder(null)}
      />
    </View>
  );
}
