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
        timeRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginBottom: 28,
          gap: 10,
        },
        timeIcon: {
          fontSize: 18,
        },
        timeText: {
          fontSize: 16,
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

  const timeStr = formatTime(new Date(reminder.triggerTime));
  const hasChanges = editText.trim() !== reminder.text;

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

            <Text style={styles.label}>זמן</Text>
            <View style={styles.timeRow}>
              <Text style={styles.timeIcon}>🕐</Text>
              <Text style={styles.timeText}>{timeStr}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                !hasChanges && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (editText.trim()) {
                  onSave(reminder.id, editText.trim());
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
