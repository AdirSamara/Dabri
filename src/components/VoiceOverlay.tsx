import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MicButton } from './MicButton';
import { useTheme } from '../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  voiceStatus: 'idle' | 'listening' | 'processing' | 'speaking';
  transcript: string;
  onMicPress: () => void;
}

export function VoiceOverlay({
                               visible,
                               onClose,
                               voiceStatus,
                               transcript,
                               onMicPress,
                             }: Props): React.JSX.Element {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    card: {
      width: '100%',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      backgroundColor: theme.overlayCard,
      paddingTop: 40,
      paddingBottom: 50,
      paddingHorizontal: 24,
      alignItems: 'center',
      minHeight: '45%',
    },
    headerRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      marginBottom: 20,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
    statusText: { fontSize: 16, fontWeight: '700', writingDirection: 'rtl' },
    closeButton: {
      position: 'absolute',
      top: 20,
      right: 20,
      zIndex: 10,
      backgroundColor: theme.surfaceVariant,
      borderRadius: 20,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeText: { fontSize: 16, color: theme.textTertiary },
    micContainer: { marginVertical: 10 },
    transcriptWrapper: {
      width: '100%',
      backgroundColor: theme.transcriptBackground,
      borderRadius: 16,
      padding: 16,
      marginTop: 10,
      maxHeight: 150,
    },
    scrollContent: { flexGrow: 1, justifyContent: 'center' },
    transcriptText: {
      fontSize: 22,
      fontWeight: '500',
      color: theme.transcriptText,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: 30,
    },
    placeholderText: {
      fontSize: 18,
      color: theme.placeholderText,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  }), [theme]);

  const getStatusColor = () => {
    if (voiceStatus === 'listening') { return '#E74C3C'; }
    if (voiceStatus === 'processing') { return '#3498DB'; }
    return theme.textSecondary;
  };

  const getStatusText = () => {
    switch (voiceStatus) {
      case 'listening': return 'מקשיב לך...';
      case 'processing': return 'מעבד נתונים...';
      case 'speaking': return 'הנה התשובה:';
      default: return 'לחץ כדי להתחיל';
    }
  };

  return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.headerRow}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
            </View>

            <View style={styles.micContainer}>
              <MicButton status={voiceStatus} onPress={onMicPress} />
            </View>

            <View style={styles.transcriptWrapper}>
              <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
              >
                {transcript ? (
                    <Text style={styles.transcriptText}>{transcript}</Text>
                ) : (
                    <Text style={styles.placeholderText}>
                      {voiceStatus === 'listening' ? 'התחל לדבר...' : 'ממתין לפקודה קולית'}
                    </Text>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
  );
}
