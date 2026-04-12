import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Reminder } from '../types';
import { useTheme } from '../utils/theme';

interface ReminderEditModalProps {
  visible: boolean;
  reminder: Reminder | null;
  formatTime: (date: Date) => string;
  onSave: (id: string, newText: string, newTriggerTime?: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ReminderEditModal({
  visible,
  reminder,
  formatTime,
  onSave,
  onDelete,
  onClose,
}: ReminderEditModalProps): React.JSX.Element {
  const theme = useTheme();
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Sync state when reminder changes
  React.useEffect(() => {
    if (reminder) {
      setEditText(reminder.text);
      setEditDate(new Date(reminder.triggerTime));
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [reminder]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        },
        sheet: {
          width: '100%',
          backgroundColor: theme.overlayCard,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 40 : 28,
          paddingHorizontal: 24,
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.border,
          alignSelf: 'center',
          marginBottom: 20,
        },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 24,
        },
        label: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 8,
        },
        textInput: {
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 17,
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 20,
          minHeight: 56,
        },
        dateTimeRow: {
          flexDirection: 'row',
          gap: 10,
          marginBottom: 28,
        },
        dateTimeButton: {
          flex: 1,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 14,
          gap: 8,
        },
        dateTimeIcon: {
          fontSize: 16,
        },
        dateTimeText: {
          fontSize: 15,
          color: theme.text,
          fontWeight: '500',
        },
        primaryButton: {
          width: '100%',
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: 'center',
          backgroundColor: theme.primary,
          marginBottom: 10,
        },
        primaryButtonDisabled: {
          opacity: 0.4,
        },
        primaryButtonText: {
          fontSize: 17,
          fontWeight: '700',
          color: '#FFFFFF',
        },
        secondaryRow: {
          flexDirection: 'row',
          gap: 10,
        },
        secondaryButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: 'center',
        },
        cancelButton: {
          backgroundColor: theme.surfaceVariant,
        },
        cancelButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.textSecondary,
        },
        deleteButton: {
          backgroundColor: theme.error + '18',
        },
        deleteButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.error,
        },
      }),
    [theme],
  );

  if (!reminder) return <></>;

  const hasChanges =
    editText.trim() !== reminder.text ||
    editDate.getTime() !== reminder.triggerTime;

  // Format date as dd/mm/yy
  const dd = editDate.getDate().toString().padStart(2, '0');
  const mo = (editDate.getMonth() + 1).toString().padStart(2, '0');
  const yy = editDate.getFullYear().toString().slice(-2);
  const dateStr = `${dd}/${mo}/${yy}`;

  // Format time as HH:MM
  const hh = editDate.getHours().toString().padStart(2, '0');
  const mm = editDate.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  const handleDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) {
      const updated = new Date(editDate);
      updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setEditDate(updated);
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(false);
    if (selected) {
      const updated = new Date(editDate);
      updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setEditDate(updated);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.title}>עריכת תזכורת</Text>

            <Text style={styles.label}>תוכן התזכורת</Text>
            <TextInput
              style={styles.textInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />

            <Text style={styles.label}>תאריך ושעה</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}>
                <Text style={styles.dateTimeIcon}>🕐</Text>
                <Text style={styles.dateTimeText}>{timeStr}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}>
                <Text style={styles.dateTimeIcon}>📅</Text>
                <Text style={styles.dateTimeText}>{dateStr}</Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={editDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={handleDateChange}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={editDate}
                mode="time"
                display="default"
                is24Hour={true}
                onChange={handleTimeChange}
              />
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                !hasChanges && styles.primaryButtonDisabled,
              ]}
              onPress={() => {
                if (editText.trim()) {
                  const newTime = editDate.getTime() !== reminder.triggerTime
                    ? editDate.getTime()
                    : undefined;
                  onSave(reminder.id, editText.trim(), newTime);
                }
              }}
              disabled={!hasChanges || !editText.trim()}
              activeOpacity={0.7}>
              <Text style={styles.primaryButtonText}>שמור</Text>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.deleteButton]}
                onPress={() => onDelete(reminder.id)}
                activeOpacity={0.7}>
                <Text style={styles.deleteButtonText}>מחק</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, styles.cancelButton]}
                onPress={onClose}
                activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
