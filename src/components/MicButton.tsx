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

/** Base height ratios for the five waveform bars. */
const BAR_RATIOS = [0.38, 0.68, 1, 0.58, 0.32];

/** Each bar animates to a random target between these bounds (fraction of max). */
const ANIM_MIN = 0.2;
const ANIM_MAX = 1.0;

export function MicButton({ status, onPress }: MicButtonProps): React.JSX.Element {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // One animated value per bar for the wave dance
  const barAnims = useRef(BAR_RATIOS.map(() => new Animated.Value(1))).current;

  // Pulse ring animation
  useEffect(() => {
    if (status === 'listening' || status === 'speaking') {
      const speed = status === 'listening' ? 600 : 900;
      const scale = status === 'listening' ? 1.2 : 1.15;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: scale,
            duration: speed,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: speed,
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

  // Bar wave animation — each bar continuously bounces to random heights
  useEffect(() => {
    if (status === 'listening' || status === 'speaking') {
      let cancelled = false;

      const animateBar = (anim: Animated.Value) => {
        if (cancelled) { return; }
        const target = ANIM_MIN + Math.random() * (ANIM_MAX - ANIM_MIN);
        const speed = status === 'listening' ? 150 + Math.random() * 200 : 300 + Math.random() * 300;
        Animated.timing(anim, {
          toValue: target,
          duration: speed,
          useNativeDriver: false, // height can't use native driver
        }).start(() => animateBar(anim));
      };

      barAnims.forEach((anim) => animateBar(anim));

      return () => {
        cancelled = true;
        barAnims.forEach((anim) => anim.stopAnimation());
        // Smoothly reset to resting heights
        Animated.parallel(
          barAnims.map((anim) =>
            Animated.timing(anim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
            }),
          ),
        ).start();
      };
    } else if (status === 'processing') {
      // Gentle uniform pulse for processing
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(barAnims[2], { toValue: 0.5, duration: 400, useNativeDriver: false }),
          Animated.timing(barAnims[2], { toValue: 1, duration: 400, useNativeDriver: false }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
        barAnims[2].setValue(1);
      };
    } else {
      barAnims.forEach((anim) => anim.setValue(1));
      return undefined;
    }
  }, [status, barAnims]);

  const color = STATUS_COLORS[status];
  const maxBarHeight = 28;
  const barWidth = 5.5;
  const barGap = 4;

  return (
    <View style={styles.container}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: color,
            opacity: (status === 'listening' || status === 'speaking') ? 0.3 : 0,
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
        {status === 'speaking' ? (
          /* Stop icon (square) when TTS is speaking */
          <View style={styles.stopIcon} />
        ) : (
          /* Waveform bars */
          <View style={[styles.barsContainer, { gap: barGap }]}>
            {BAR_RATIOS.map((ratio, i) => {
              const restHeight = maxBarHeight * ratio;
              // Animated height: barAnims[i] interpolates from rest height
              const animatedHeight = barAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [maxBarHeight * ANIM_MIN, restHeight],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={i}
                  style={{
                    width: barWidth,
                    height: animatedHeight,
                    borderRadius: barWidth / 2,
                    backgroundColor: `rgba(255,255,255,${0.65 + ratio * 0.35})`,
                  }}
                />
              );
            })}
          </View>
        )}
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
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});
