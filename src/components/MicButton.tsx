import React, { useEffect, useRef } from 'react';
import {
  Animated,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { VoiceStatus } from '../types';

interface MicButtonProps {
  status: VoiceStatus;
  onPress: () => void;
}

const STATUS_COLORS: Record<VoiceStatus, string> = {
  idle: '#2196F3',
  listening: '#F44336',
  processing: '#FF9800',
  speaking: '#4CAF50',
};

export function MicButton({ status, onPress }: MicButtonProps): React.JSX.Element {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'listening') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
      return undefined;
    }
  }, [status, pulseAnim]);

  const color = STATUS_COLORS[status];

  return (
    <View style={styles.container}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: color,
            opacity: status === 'listening' ? 0.3 : 0,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Main button */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: color }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Mic icon made of Views */}
        <View style={styles.micContainer}>
          {/* Mic body */}
          <View style={[styles.micBody, { borderColor: '#fff', backgroundColor: '#fff' }]} />
          {/* Mic base arc */}
          <View style={[styles.micBase, { borderColor: '#fff' }]} />
          {/* Mic stand */}
          <View style={[styles.micStand, { backgroundColor: '#fff' }]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBody: {
    width: 14,
    height: 24,
    borderRadius: 7,
  },
  micBase: {
    width: 24,
    height: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 2.5,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    marginTop: -2,
  },
  micStand: {
    width: 2.5,
    height: 8,
    marginTop: 0,
  },
});
