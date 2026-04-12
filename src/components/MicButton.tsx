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

// Background color per state
const STATUS_COLORS: Record<VoiceStatus, string> = {
  idle:       '#1565C0',
  listening:  '#C62828',
  processing: '#E65100',
  speaking:   '#2E7D32',
};

// Depth circle color — lighter shade of the background, same pattern as AppIcon
const DEPTH_COLORS: Record<VoiceStatus, string> = {
  idle:       '#1976D2',
  listening:  '#E53935',
  processing: '#F57C00',
  speaking:   '#388E3C',
};

// Shadow glow color per state
const SHADOW_COLORS: Record<VoiceStatus, string> = {
  idle:       '#1565C0',
  listening:  '#C62828',
  processing: '#E65100',
  speaking:   '#2E7D32',
};

// Bar color sets — outer bars tinted, centre bar white, mirrors AppIcon idle pattern
const STATE_BAR_COLORS: Record<VoiceStatus, string[]> = {
  idle:       ['#A3B8E8', '#C8D8F4', '#FFFFFF', '#BBC9EF', '#96ABDF'],
  listening:  ['#EF9A9A', '#FFCDD2', '#FFFFFF', '#FFCDD2', '#EF9A9A'],
  processing: ['#FFCC80', '#FFE0B2', '#FFFFFF', '#FFE0B2', '#FFCC80'],
  speaking:   ['#A5D6A7', '#C8E6C9', '#FFFFFF', '#C8E6C9', '#A5D6A7'],
};

const BAR_RATIOS = [0.38, 0.68, 1, 0.58, 0.32];
const ANIM_MIN   = 0.2;
const ANIM_MAX   = 1.0;

export function MicButton({ status, onPress }: MicButtonProps): React.JSX.Element {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barAnims  = useRef(BAR_RATIOS.map(() => new Animated.Value(1))).current;

  // Pulse ring
  useEffect(() => {
    if (status === 'listening' || status === 'speaking') {
      const speed = status === 'listening' ? 600 : 900;
      const scale = status === 'listening' ? 1.2 : 1.15;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: scale, duration: speed, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,     duration: speed, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
      return undefined;
    }
  }, [status, pulseAnim]);

  // Bar wave animation
  useEffect(() => {
    if (status === 'listening' || status === 'speaking') {
      let cancelled = false;
      const animateBar = (anim: Animated.Value) => {
        if (cancelled) { return; }
        const target = ANIM_MIN + Math.random() * (ANIM_MAX - ANIM_MIN);
        const speed  = status === 'listening' ? 150 + Math.random() * 200 : 300 + Math.random() * 300;
        Animated.timing(anim, { toValue: target, duration: speed, useNativeDriver: false })
          .start(() => animateBar(anim));
      };
      barAnims.forEach(animateBar);
      return () => {
        cancelled = true;
        barAnims.forEach(a => a.stopAnimation());
        Animated.parallel(
          barAnims.map(a => Animated.timing(a, { toValue: 1, duration: 300, useNativeDriver: false })),
        ).start();
      };
    } else if (status === 'processing') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(barAnims[2], { toValue: 0.5, duration: 400, useNativeDriver: false }),
          Animated.timing(barAnims[2], { toValue: 1,   duration: 400, useNativeDriver: false }),
        ]),
      );
      loop.start();
      return () => { loop.stop(); barAnims[2].setValue(1); };
    } else {
      barAnims.forEach(a => a.setValue(1));
      return undefined;
    }
  }, [status, barAnims]);

  const bgColor    = STATUS_COLORS[status];
  const depthColor = DEPTH_COLORS[status];
  const barColors  = STATE_BAR_COLORS[status];
  const maxBarH    = 42;
  const barWidth   = 8;
  const barGap     = 6;

  return (
    <View style={styles.container}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: bgColor,
            opacity: (status === 'listening' || status === 'speaking') ? 0.3 : 0,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Main button */}
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: bgColor,
            shadowColor: SHADOW_COLORS[status],
          },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Depth circle — consistent across all states */}
        <View style={[styles.depthCircle, { backgroundColor: depthColor }]} />

        {status === 'speaking' ? (
          <View style={styles.stopIcon} />
        ) : (
          <View style={[styles.barsContainer, { gap: barGap }]}>
            {BAR_RATIOS.map((ratio, i) => {
              const restHeight     = maxBarH * ratio;
              const animatedHeight = barAnims[i].interpolate({
                inputRange:  [0, 1],
                outputRange: [maxBarH * ANIM_MIN, restHeight],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={i}
                  style={{
                    width:        barWidth,
                    height:       animatedHeight,
                    borderRadius: barWidth / 2,
                    backgroundColor: barColors[i],
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
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
  },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 12,
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius:  12,
  },
  depthCircle: {
    position:     'absolute',
    width:        110,
    height:       110,
    borderRadius: 55,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems:    'center',
    zIndex:        1,
  },
  stopIcon: {
    width:        36,
    height:       36,
    borderRadius: 6,
    backgroundColor: '#fff',
    zIndex:       1,
  },
});
