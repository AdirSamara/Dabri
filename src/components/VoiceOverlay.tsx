import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
    ScrollView
} from 'react-native';
import { MicButton } from './MicButton';

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

  const getStatusColor = () => {
    if (voiceStatus === 'listening') return '#E74C3C'; // אדום "הקלטה"
    if (voiceStatus === 'processing') return '#3498DB'; // כחול "עיבוד"
    return '#666';
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

            {/* נורית סטטוס קטנה וטקסט */}
            <View style={styles.headerRow}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
            </View>

            <View style={styles.micContainer}>
              <MicButton status={voiceStatus} onPress={onMicPress} />
            </View>

            {/* אזור התמליל המשופר */}
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)', // כהה יותר בשביל מיקוד
    justifyContent: 'flex-end', // ממוקם למטה - נפוץ יותר בממשקי קול (כמו סירי/גוגל)
  },
  card: {
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: '45%', // נותן מקום לטקסט לגדול
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { fontSize: 16, color: '#999' },
  micContainer: {
    marginVertical: 10,
  },
  transcriptWrapper: {
    width: '100%',
    backgroundColor: '#F8F9FA', // רקע עדין שמפריד את הטקסט
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    maxHeight: 150, // מניעה מהכרטיס לקפוץ למעלה מדי
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  transcriptText: {
    fontSize: 22, // גדול משמעותית
    fontWeight: '500',
    color: '#2C3E50',
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 30,
  },
  placeholderText: {
    fontSize: 18,
    color: '#BDC3C7',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});