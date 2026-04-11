import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VoiceStatus } from '../types';

interface StatusIndicatorProps {
  status: VoiceStatus;
  transcript: string;
}

const STATUS_TEXT: Record<VoiceStatus, string> = {
  idle: 'לחץ על המיקרופון כדי לדבר',
  listening: 'מקשיב...',
  processing: 'מעבד...',
  speaking: 'מדבר...',
};

export function StatusIndicator({ status, transcript }: StatusIndicatorProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>{STATUS_TEXT[status]}</Text>
      {transcript.length > 0 && (
        <Text style={styles.transcriptText}>{transcript}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#555',
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    writingDirection: 'rtl',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
