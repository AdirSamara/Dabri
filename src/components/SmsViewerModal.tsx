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
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          paddingHorizontal: 16,
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.border,
          alignSelf: 'center',
          marginBottom: 12,
        },
        // ── Header ──
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        },
        title: {
          fontSize: 18,
          fontWeight: '700',
          color: theme.text,
        },
        counter: {
          fontSize: 13,
          color: theme.textSecondary,
          fontWeight: '500',
        },
        // ── Compact list row ──
        listRowContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6,
          gap: 8,
        },
        listRow: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          gap: 10,
        },
        listAvatar: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: theme.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        listAvatarText: {
          fontSize: 14,
          color: theme.primary,
          fontWeight: '700',
        },
        listContent: {
          flex: 1,
        },
        listTopRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 2,
        },
        listSender: {
          fontSize: 13,
          fontWeight: '600',
          color: theme.text,
          writingDirection: 'rtl',
        },
        listDate: {
          fontSize: 10,
          color: theme.textTertiary,
        },
        listPreview: {
          fontSize: 12,
          color: theme.textSecondary,
          writingDirection: 'rtl',
          textAlign: 'right',
        },
        readIconButton: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: theme.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        readIconEmoji: {
          fontSize: 16,
        },
        // ── Detail view ──
        detailCard: {
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        },
        detailSenderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
          gap: 10,
        },
        detailAvatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        detailAvatarText: {
          fontSize: 16,
          color: theme.primary,
          fontWeight: '700',
        },
        detailSenderInfo: {
          flex: 1,
        },
        detailSender: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
        },
        detailDate: {
          fontSize: 12,
          color: theme.textTertiary,
          writingDirection: 'rtl',
          textAlign: 'right',
        },
        detailBody: {
          fontSize: 15,
          color: theme.text,
          writingDirection: 'rtl',
          textAlign: 'right',
          lineHeight: 24,
        },
        // ── Buttons ──
        primaryButton: {
          backgroundColor: theme.primary,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: 'center',
          marginBottom: 8,
        },
        primaryButtonText: {
          fontSize: 16,
          fontWeight: '700',
          color: '#FFFFFF',
        },
        navRow: {
          flexDirection: 'row',
          gap: 8,
          marginBottom: 8,
        },
        navButton: {
          flex: 1,
          paddingVertical: 10,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: theme.surfaceVariant,
        },
        navButtonDisabled: {
          opacity: 0.3,
        },
        navButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.text,
        },
        backButton: {
          paddingVertical: 10,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: theme.surfaceVariant,
        },
        backButtonText: {
          fontSize: 14,
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
      onRequestClose={() => (isDetail ? setSelectedIndex(null) : onClose())}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => (isDetail ? setSelectedIndex(null) : onClose())}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          {/* ── LIST VIEW ── */}
          {!isDetail && (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>הודעות</Text>
                <Text style={styles.counter}>{messages.length} הודעות</Text>
              </View>

              {messages.slice(0, 5).map((m, i) => (
                <View key={i} style={styles.listRowContainer}>
                  <TouchableOpacity
                    style={styles.readIconButton}
                    onPress={() => onReadAloud(`מ-${m.address}: ${m.body}`)}
                    activeOpacity={0.7}>
                    <Text style={styles.readIconEmoji}>🔊</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.listRow}
                    onPress={() => setSelectedIndex(i)}
                    activeOpacity={0.7}>
                    <View style={styles.listAvatar}>
                      <Text style={styles.listAvatarText}>
                        {getInitial(m.address)}
                      </Text>
                    </View>
                    <View style={styles.listContent}>
                      <View style={styles.listTopRow}>
                        <Text style={styles.listSender}>{m.address}</Text>
                        {m.date > 0 && (
                          <Text style={styles.listDate}>{formatDate(m.date)}</Text>
                        )}
                      </View>
                      <Text
                        style={styles.listPreview}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {m.body}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}

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
                showsVerticalScrollIndicator
                style={{ maxHeight: 300 }}
                nestedScrollEnabled>
                <View style={styles.detailCard}>
                  <View style={styles.detailSenderRow}>
                    <View style={styles.detailAvatar}>
                      <Text style={styles.detailAvatarText}>
                        {getInitial(msg.address)}
                      </Text>
                    </View>
                    <View style={styles.detailSenderInfo}>
                      <Text style={styles.detailSender}>{msg.address}</Text>
                      {msg.date > 0 && (
                        <Text style={styles.detailDate}>{formatDate(msg.date)}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.detailBody}>{msg.body}</Text>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => onReadAloud(`מ-${msg.address}: ${msg.body}`)}
                activeOpacity={0.7}>
                <Text style={styles.primaryButtonText}>הקרא בקול</Text>
              </TouchableOpacity>

              <View style={styles.navRow}>
                {/* Right side in RTL: הבא = next = index+1 */}
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    selectedIndex >= messages.length - 1 && styles.navButtonDisabled,
                  ]}
                  onPress={() => setSelectedIndex((i) => Math.min((i ?? 0) + 1, messages.length - 1))}
                  disabled={selectedIndex >= messages.length - 1}
                  activeOpacity={0.7}>
                  <Text style={styles.navButtonText}>{'הבא >'}</Text>
                </TouchableOpacity>
                {/* Left side in RTL: הקודם = previous = index-1 */}
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    selectedIndex <= 0 && styles.navButtonDisabled,
                  ]}
                  onPress={() => setSelectedIndex((i) => Math.max((i ?? 1) - 1, 0))}
                  disabled={selectedIndex <= 0}
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
