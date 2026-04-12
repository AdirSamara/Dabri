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
import { Reminder } from '../types';
import { useTheme } from '../utils/theme';

interface ReminderEditModalProps {
  visible: boolean;
  reminder: Reminder | null;
  formatTime: (date: Date) => string;
  onSave: (id: string, newText: string) => void;
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

  // Sync text when reminder changes
  React.useEffect(() => {
    if (reminder) {
      setEditText(reminder.text);
    }
  }, [reminder]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        },
        card: {
          backgroundColor: theme.surface,
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
        },
        title: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 16,
        },
        label: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 6,
        },
        textInput: {
          backgroundColor: theme.background,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: 12,
          fontSize: 16,
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 16,
          minHeight: 48,
        },
        timeRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: 20,
          gap: 8,
        },
        timeIcon: {
          fontSize: 16,
        },
        timeText: {
          fontSize: 15,
          color: theme.textSecondary,
          fontWeight: '500',
        },
        buttonsRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 10,
        },
        button: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
        },
        saveButton: {
          backgroundColor: theme.primary,
        },
        saveButtonText: {
          fontSize: 15,
          fontWeight: '700',
          color: '#FFFFFF',
        },
        cancelButton: {
          backgroundColor: theme.surfaceVariant,
        },
        cancelButtonText: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.textSecondary,
        },
        deleteButton: {
          backgroundColor: theme.error + '18',
        },
        deleteButtonText: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.error,
        },
      }),
    [theme],
  );

  if (!reminder) return <></>;

  const timeStr = formatTime(new Date(reminder.triggerTime));
  const hasChanges = editText.trim() !== reminder.text;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.card}>
              <Text style={styles.title}>עריכת תזכורת</Text>

              <Text style={styles.label}>תוכן התזכורת</Text>
              <TextInput
                style={styles.textInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
              />

              <Text style={styles.label}>זמן</Text>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{timeStr}</Text>
              </View>

              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={() => onDelete(reminder.id)}
                  activeOpacity={0.7}>
                  <Text style={styles.deleteButtonText}>מחק</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  activeOpacity={0.7}>
                  <Text style={styles.cancelButtonText}>ביטול</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.saveButton,
                    !hasChanges && { opacity: 0.4 },
                  ]}
                  onPress={() => {
                    if (editText.trim()) {
                      onSave(reminder.id, editText.trim());
                    }
                  }}
                  disabled={!hasChanges || !editText.trim()}
                  activeOpacity={0.7}>
                  <Text style={styles.saveButtonText}>שמור</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
