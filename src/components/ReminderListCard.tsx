import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Reminder } from '../types';
import { useTheme } from '../utils/theme';

interface ReminderListCardProps {
  reminders: Reminder[];
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  formatTime: (date: Date) => string;
}

function ReminderItem({
  reminder,
  onDelete,
  onEdit,
  formatTime,
}: {
  reminder: Reminder;
  onDelete: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  formatTime: (date: Date) => string;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.background,
          borderRadius: 12,
          padding: 12,
          marginTop: 8,
          borderWidth: 1,
          borderColor: theme.border ?? '#E0E0E0',
        },
        reminderText: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 4,
        },
        timeText: {
          fontSize: 13,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 8,
        },
        actionsRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 8,
        },
        actionButton: {
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 8,
        },
        deleteButton: {
          backgroundColor: theme.error + '18',
        },
        editButton: {
          backgroundColor: theme.primary + '18',
        },
        deleteButtonText: {
          fontSize: 13,
          color: theme.error,
          fontWeight: '600',
        },
        editButtonText: {
          fontSize: 13,
          color: theme.primary,
          fontWeight: '600',
        },
      }),
    [theme],
  );

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
      <Text style={styles.reminderText}>{reminder.text}</Text>
      <Text style={styles.timeText}>
        {formatTime(new Date(reminder.triggerTime))}
      </Text>
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
    </View>
  );
}

export function ReminderListCard({
  reminders,
  onDelete,
  onEdit,
  formatTime,
}: ReminderListCardProps): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginTop: 4,
        },
        header: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 4,
        },
        emptyText: {
          fontSize: 14,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginTop: 4,
        },
      }),
    [theme],
  );

  // Show up to 5 reminders, sorted by trigger time
  const active = reminders
    .filter((r) => !r.completed && r.triggerTime > Date.now())
    .sort((a, b) => a.triggerTime - b.triggerTime)
    .slice(0, 5);

  if (active.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>אין תזכורות פעילות</Text>
      </View>
    );
  }

  const countText =
    active.length === 1
      ? 'תזכורת אחת פעילה:'
      : `${active.length} תזכורות פעילות:`;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{countText}</Text>
      {active.map((reminder) => (
        <ReminderItem
          key={reminder.id}
          reminder={reminder}
          onDelete={onDelete}
          onEdit={onEdit}
          formatTime={formatTime}
        />
      ))}
    </View>
  );
}
