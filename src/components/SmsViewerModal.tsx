import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SmsMessage } from '../types';
import { useTheme } from '../utils/theme';

interface SmsViewerModalProps {
  visible: boolean;
  messages: SmsMessage[];
  onClose: () => void;
  onReadAloud: (text: string) => void;
}

export function SmsViewerModal({
  visible,
  messages,
  onClose,
  onReadAloud,
}: SmsViewerModalProps): React.JSX.Element {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index when messages change
  React.useEffect(() => {
    setCurrentIndex(0);
  }, [messages]);

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
          maxHeight: '80%',
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.border,
          alignSelf: 'center',
          marginBottom: 16,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        },
        title: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.text,
          writingDirection: 'rtl',
        },
        counter: {
          fontSize: 14,
          color: theme.textSecondary,
          fontWeight: '500',
        },
        messageCard: {
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          minHeight: 120,
        },
        senderRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        },
        senderIcon: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        senderIconText: {
          fontSize: 16,
          color: theme.primary,
          fontWeight: '700',
        },
        senderName: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
        },
        messageBody: {
          fontSize: 16,
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          lineHeight: 24,
        },
        dateText: {
          fontSize: 12,
          color: theme.textTertiary,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginTop: 12,
        },
        readButton: {
          backgroundColor: theme.primary,
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: 'center',
          marginBottom: 12,
        },
        readButtonText: {
          fontSize: 17,
          fontWeight: '700',
          color: '#FFFFFF',
        },
        navRow: {
          flexDirection: 'row',
          gap: 10,
        },
        navButton: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 14,
          alignItems: 'center',
          backgroundColor: theme.surfaceVariant,
        },
        navButtonDisabled: {
          opacity: 0.3,
        },
        navButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.text,
        },
        closeButton: {
          paddingVertical: 12,
          borderRadius: 14,
          alignItems: 'center',
          backgroundColor: theme.surfaceVariant,
          marginTop: 10,
        },
        closeButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.textSecondary,
        },
      }),
    [theme],
  );

  if (messages.length === 0) return <></>;

  const msg = messages[currentIndex] ?? messages[0];
  const initial = msg.address.replace(/[^א-תa-zA-Z]/g, '')[0]?.toUpperCase() ?? '#';

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const mo = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${dd}/${mo} ${hh}:${mm}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.counter}>
              {currentIndex + 1} / {messages.length}
            </Text>
            <Text style={styles.title}>הודעות</Text>
          </View>

          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            <View style={styles.messageCard}>
              <View style={styles.senderRow}>
                <View style={styles.senderIcon}>
                  <Text style={styles.senderIconText}>{initial}</Text>
                </View>
                <Text style={styles.senderName}>{msg.address}</Text>
              </View>
              <Text style={styles.messageBody}>{msg.body}</Text>
              {msg.date > 0 && (
                <Text style={styles.dateText}>{formatDate(msg.date)}</Text>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.readButton}
            onPress={() => onReadAloud(`מ-${msg.address}: ${msg.body}`)}
            activeOpacity={0.7}>
            <Text style={styles.readButtonText}>הקרא בקול</Text>
          </TouchableOpacity>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={[
                styles.navButton,
                currentIndex >= messages.length - 1 && styles.navButtonDisabled,
              ]}
              onPress={() => setCurrentIndex((i) => Math.min(i + 1, messages.length - 1))}
              disabled={currentIndex >= messages.length - 1}
              activeOpacity={0.7}>
              <Text style={styles.navButtonText}>{'הקודם >'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navButton,
                currentIndex <= 0 && styles.navButtonDisabled,
              ]}
              onPress={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
              disabled={currentIndex <= 0}
              activeOpacity={0.7}>
              <Text style={styles.navButtonText}>{'< הבא'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>סגור</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
