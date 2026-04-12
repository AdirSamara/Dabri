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

function formatDate(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const mo = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

function getInitial(address: string): string {
  return address.replace(/[^א-תa-zA-Z]/g, '')[0]?.toUpperCase() ?? '#';
}

export function SmsViewerModal({
  visible,
  messages,
  onClose,
  onReadAloud,
}: SmsViewerModalProps): React.JSX.Element {
  const theme = useTheme();
  // null = list view, number = detail view index
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  React.useEffect(() => {
    if (visible) setSelectedIndex(null);
  }, [visible]);

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
          paddingHorizontal: 20,
          maxHeight: '85%',
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.border,
          alignSelf: 'center',
          marginBottom: 16,
        },
        // ── Header ──
        headerRow: {
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        },
        title: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.text,
        },
        counter: {
          fontSize: 14,
          color: theme.textSecondary,
          fontWeight: '500',
        },
        // ── List view ──
        listRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderRadius: 14,
          padding: 12,
          marginBottom: 8,
          gap: 10,
        },
        listAvatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        listAvatarText: {
          fontSize: 16,
          color: theme.primary,
          fontWeight: '700',
        },
        listContent: {
          flex: 1,
        },
        listSender: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          marginBottom: 2,
        },
        listPreview: {
          fontSize: 13,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
          numberOfLines: 1,
        },
        listDate: {
          fontSize: 11,
          color: theme.textTertiary,
          marginTop: 2,
          textAlign: 'right',
        },
        listActions: {
          alignItems: 'center',
          gap: 6,
        },
        expandButton: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.surfaceVariant,
          alignItems: 'center',
          justifyContent: 'center',
        },
        expandButtonText: {
          fontSize: 14,
          color: theme.textSecondary,
        },
        readSmallButton: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        readSmallButtonText: {
          fontSize: 16,
        },
        // ── Detail view ──
        detailCard: {
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
        },
        detailSenderRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          marginBottom: 14,
          gap: 10,
        },
        detailAvatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        detailAvatarText: {
          fontSize: 18,
          color: theme.primary,
          fontWeight: '700',
        },
        detailSender: {
          fontSize: 17,
          fontWeight: '700',
          color: theme.text,
          writingDirection: 'rtl',
        },
        detailDate: {
          fontSize: 12,
          color: theme.textTertiary,
          writingDirection: 'rtl',
        },
        detailBody: {
          fontSize: 16,
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          lineHeight: 26,
        },
        // ── Buttons ──
        primaryButton: {
          backgroundColor: theme.primary,
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: 'center',
          marginBottom: 10,
        },
        primaryButtonText: {
          fontSize: 17,
          fontWeight: '700',
          color: '#FFFFFF',
        },
        navRow: {
          flexDirection: 'row-reverse',
          gap: 10,
          marginBottom: 10,
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
        backButton: {
          paddingVertical: 12,
          borderRadius: 14,
          alignItems: 'center',
          backgroundColor: theme.surfaceVariant,
        },
        backButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.textSecondary,
        },
      }),
    [theme],
  );

  if (messages.length === 0) return <></>;

  const isDetail = selectedIndex !== null;
  const msg = isDetail ? messages[selectedIndex] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (isDetail) {
          setSelectedIndex(null);
        } else {
          onClose();
        }
      }}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => {
          if (isDetail) {
            setSelectedIndex(null);
          } else {
            onClose();
          }
        }}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          {/* ── LIST VIEW ── */}
          {!isDetail && (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>הודעות</Text>
                <Text style={styles.counter}>{messages.length} הודעות</Text>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 400 }}>
                {messages.slice(0, 5).map((m, i) => (
                  <View key={i} style={styles.listRow}>
                    <View style={styles.listAvatar}>
                      <Text style={styles.listAvatarText}>
                        {getInitial(m.address)}
                      </Text>
                    </View>
                    <View style={styles.listContent}>
                      <Text style={styles.listSender}>{m.address}</Text>
                      <Text
                        style={styles.listPreview}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {m.body}
                      </Text>
                      {m.date > 0 && (
                        <Text style={styles.listDate}>
                          {formatDate(m.date)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.listActions}>
                      <TouchableOpacity
                        style={styles.readSmallButton}
                        onPress={() =>
                          onReadAloud(`מ-${m.address}: ${m.body}`)
                        }
                        activeOpacity={0.7}>
                        <Text style={styles.readSmallButtonText}>🔊</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setSelectedIndex(i)}
                        activeOpacity={0.7}>
                        <Text style={styles.expandButtonText}>{'◁'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.backButton}
                onPress={onClose}
                activeOpacity={0.7}>
                <Text style={styles.backButtonText}>סגור</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── DETAIL VIEW ── */}
          {isDetail && msg && (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>הודעה</Text>
                <Text style={styles.counter}>
                  {selectedIndex + 1} / {messages.length}
                </Text>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={true}
                style={{ maxHeight: 350 }}>
                <View style={styles.detailCard}>
                  <View style={styles.detailSenderRow}>
                    <View style={styles.detailAvatar}>
                      <Text style={styles.detailAvatarText}>
                        {getInitial(msg.address)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.detailSender}>{msg.address}</Text>
                      {msg.date > 0 && (
                        <Text style={styles.detailDate}>
                          {formatDate(msg.date)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.detailBody}>{msg.body}</Text>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() =>
                  onReadAloud(`מ-${msg.address}: ${msg.body}`)
                }
                activeOpacity={0.7}>
                <Text style={styles.primaryButtonText}>הקרא בקול</Text>
              </TouchableOpacity>

              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    selectedIndex <= 0 && styles.navButtonDisabled,
                  ]}
                  onPress={() =>
                    setSelectedIndex((i) => Math.max((i ?? 1) - 1, 0))
                  }
                  disabled={selectedIndex <= 0}
                  activeOpacity={0.7}>
                  <Text style={styles.navButtonText}>{'הבא >'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    selectedIndex >= messages.length - 1 &&
                      styles.navButtonDisabled,
                  ]}
                  onPress={() =>
                    setSelectedIndex((i) =>
                      Math.min((i ?? 0) + 1, messages.length - 1),
                    )
                  }
                  disabled={selectedIndex >= messages.length - 1}
                  activeOpacity={0.7}>
                  <Text style={styles.navButtonText}>{'< הקודם'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectedIndex(null)}
                activeOpacity={0.7}>
                <Text style={styles.backButtonText}>חזרה לרשימה</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
